"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { normaliseUrl } from "@/lib/documents"

type Result = { ok: true } | { ok: false; error: string }

export type SpareInput = {
  name: string
  partNumber: string
  buyUrl: string
  onHand: string
  lowAt: string
  everyMonths: string
  lastReplacedAt: string | null // yyyy-mm-dd
  notes: string
}

const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null)
/** "3" → 3; blank → null; anything else → undefined. */
const whole = (v: string, min: number, max: number) => {
  const s = v.trim()
  if (!s) return null
  return /^\d+$/.test(s) && Number(s) >= min && Number(s) <= max ? Number(s) : undefined
}

function refresh(id: string) {
  revalidatePath(`/fixtures/${id}`)
  revalidatePath("/")
}

function parse(input: SpareInput) {
  const name = input.name.trim().slice(0, 80)
  if (!name) return { error: "Give it a name, like Water Filter." }
  const onHand = whole(input.onHand, 0, 9999)
  if (onHand === undefined) return { error: "On Hand is a whole number." }
  const lowAt = whole(input.lowAt, 0, 9999)
  if (lowAt === undefined) return { error: "Running Low At is a whole number." }
  const everyMonths = whole(input.everyMonths, 1, 240)
  if (everyMonths === undefined) return { error: "Replace Every is a number of months, from 1 to 240." }
  if (input.buyUrl.trim() && !normaliseUrl(input.buyUrl)) return { error: "Where to Buy isn't a web address." }
  const last = day(input.lastReplacedAt)
  if (last && last.getTime() > Date.now() + 86_400_000) return { error: "It can't have been replaced in the future." }
  return {
    data: {
      name,
      partNumber: input.partNumber.trim().slice(0, 80) || null,
      buyUrl: normaliseUrl(input.buyUrl),
      onHand: onHand ?? 0,
      lowAt,
      everyMonths,
      lastReplacedAt: last,
      notes: input.notes.trim() || null,
    },
  }
}

async function own(householdId: string, id: string) {
  return db.spare.findFirst({ where: { id, householdId }, include: { fixture: { select: { name: true } } } })
}

export async function createSpare(fixtureId: string, input: SpareInput): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const f = await db.fixture.findFirst({ where: { id: fixtureId, householdId: c.householdId, parentId: null }, select: { id: true, name: true } })
  if (!f) return { ok: false, error: "That item no longer exists." }
  const p = parse(input)
  if (!p.data) return { ok: false, error: p.error }
  const last = await db.spare.aggregate({ where: { fixtureId }, _max: { sortOrder: true } })
  await db.spare.create({ data: { ...p.data, householdId: c.householdId, fixtureId, sortOrder: (last._max.sortOrder ?? 0) + 1, createdById: c.user.id } })
  await db.fixture.update({ where: { id: fixtureId }, data: { sparesEnabled: true } })
  await logActivity(c, { action: "updated", entityType: "Fixture", entityId: fixtureId, summary: `${c.user.name} added ${p.data.name} to the spares for ${f.name}` })
  refresh(fixtureId)
  return { ok: true }
}

export async function updateSpare(id: string, input: SpareInput): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const s = await own(c.householdId, id)
  if (!s) return { ok: false, error: "That spare no longer exists." }
  const p = parse(input)
  if (!p.data) return { ok: false, error: p.error }
  await db.spare.update({ where: { id }, data: p.data })
  refresh(s.fixtureId)
  return { ok: true }
}

export async function deleteSpare(id: string): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const s = await own(c.householdId, id)
  if (!s) return { ok: false, error: "That spare is already gone." }
  await db.spare.delete({ where: { id } })
  await logActivity(c, { action: "updated", entityType: "Fixture", entityId: s.fixtureId, summary: `${c.user.name} removed ${s.name} from the spares for ${s.fixture.name}` })
  refresh(s.fixtureId)
  return { ok: true }
}

/** One was fitted today: one comes out of stock (if any) and the next replacement is counted from today. */
export async function replacedSpare(id: string): Promise<Result & { left?: number }> {
  const c = await requireHousehold("MEMBER")
  const s = await own(c.householdId, id)
  if (!s) return { ok: false, error: "That spare no longer exists." }
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z")
  const left = Math.max(0, s.onHand - 1)
  await db.spare.update({ where: { id }, data: { onHand: left, lastReplacedAt: today } })
  await logActivity(c, { action: "updated", entityType: "Fixture", entityId: s.fixtureId, summary: `${c.user.name} replaced the ${s.name} in ${s.fixture.name}` })
  refresh(s.fixtureId)
  return { ok: true, left }
}

/** Bought more, or found one fewer: changes the count on hand by `by`. */
export async function adjustSpare(id: string, by: number): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const s = await own(c.householdId, id)
  if (!s) return { ok: false, error: "That spare no longer exists." }
  if (!Number.isInteger(by) || Math.abs(by) > 999) return { ok: false, error: "That isn't a count." }
  await db.spare.update({ where: { id }, data: { onHand: Math.min(9999, Math.max(0, s.onHand + by)) } })
  refresh(s.fixtureId)
  return { ok: true }
}
