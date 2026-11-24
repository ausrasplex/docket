"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { normaliseUrl } from "@/lib/documents"
import { FINISH_KINDS, SURFACES, normaliseHex } from "@/lib/finishes"
import type { FinishKind, Surface } from "@/generated/prisma/enums"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export type FinishInput = {
  surface: Surface
  surfaceNote: string
  kind: FinishKind
  brand: string
  product: string
  productUrl: string
  colourName: string
  colourCode: string
  hex: string
  sheen: string
  size: string
  store: string
  appliedAt: string | null
  leftoverLocation: string
  notes: string
}

function refresh() {
  revalidatePath("/paint")
  revalidatePath("/rooms", "layout")
  revalidatePath("/")
}

async function brandId(householdId: string, name: string) {
  const n = name.trim()
  if (!n) return null
  const existing = await db.brand.findFirst({ where: { householdId, name: { equals: n, mode: "insensitive" } } })
  return existing?.id ?? (await db.brand.create({ data: { householdId, name: n } })).id
}

function check(input: FinishInput) {
  if (!SURFACES.some((s) => s.id === input.surface)) return "Pick a surface."
  if (!FINISH_KINDS.some((k) => k.id === input.kind)) return "Pick a type."
  if (!input.colourName.trim() && !input.colourCode.trim() && !input.product.trim()) return "Add a colour name, code or product."
  if (input.hex.trim() && !normaliseHex(input.hex)) return "The swatch colour should look like #f2efe6."
  if (input.productUrl.trim() && !normaliseUrl(input.productUrl)) return "The colour's page isn't a web address."
  return null
}

function data(input: FinishInput) {
  const day = input.appliedAt ? new Date(`${input.appliedAt}T00:00:00Z`) : null
  return {
    surface: input.surface,
    surfaceNote: input.surfaceNote.trim() || null,
    kind: input.kind,
    product: input.product.trim() || null,
    productUrl: normaliseUrl(input.productUrl),
    colourName: input.colourName.trim() || null,
    colourCode: input.colourCode.trim().toUpperCase() || null,
    hex: normaliseHex(input.hex),
    sheen: input.sheen.trim() || null,
    size: input.size.trim() || null,
    store: input.store.trim() || null,
    appliedAt: day && !Number.isNaN(day.getTime()) ? day : null,
    leftoverLocation: input.leftoverLocation.trim() || null,
    notes: input.notes.trim() || null,
  }
}

/** Adds the same paint or finish to one or more rooms (one record per room). */
export async function createFinishes(input: FinishInput, spaceIds: string[]): Promise<Result<{ ids: string[] }>> {
  const c = await requireHousehold("MEMBER")
  const bad = check(input)
  if (bad) return { ok: false, error: bad }
  const ids = [...new Set(spaceIds)]
  if (!ids.length) return { ok: false, error: "Pick at least one room." }
  const rooms = await db.space.findMany({ where: { id: { in: ids }, householdId: c.householdId }, select: { id: true, name: true } })
  if (rooms.length !== ids.length) return { ok: false, error: "One of those rooms no longer exists." }
  const bId = await brandId(c.householdId, input.brand)
  const created = await db.$transaction(
    rooms.map((r) => db.finish.create({ data: { ...data(input), householdId: c.householdId, spaceId: r.id, brandId: bId, createdById: c.user.id } }))
  )
  const name = input.colourName.trim() || input.colourCode.trim() || input.product.trim()
  await logActivity(c, {
    action: "created",
    entityType: "Finish",
    entityId: created[0].id,
    summary: `${c.user.name} added ${name} to ${rooms.length === 1 ? rooms[0].name : `${rooms.length} rooms`}`,
  })
  refresh()
  return { ok: true, ids: created.map((f) => f.id) }
}

export async function updateFinish(id: string, input: FinishInput, spaceId: string): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const f = await db.finish.findFirst({ where: { id, householdId: c.householdId } })
  if (!f) return { ok: false, error: "That finish no longer exists." }
  const bad = check(input)
  if (bad) return { ok: false, error: bad }
  if (!(await db.space.findFirst({ where: { id: spaceId, householdId: c.householdId } }))) return { ok: false, error: "That room no longer exists." }
  await db.finish.update({
    where: { id },
    data: { ...data(input), spaceId, brandId: await brandId(c.householdId, input.brand), updatedById: c.user.id },
  })
  refresh()
  return { ok: true }
}

export async function setFinishArchived(id: string, archived: boolean): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const f = await db.finish.findFirst({ where: { id, householdId: c.householdId }, include: { space: { select: { name: true } } } })
  if (!f) return { ok: false, error: "That finish no longer exists." }
  await db.finish.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } })
  const name = f.colourName ?? f.colourCode ?? f.product ?? "a finish"
  await logActivity(c, { action: archived ? "archived" : "restored", entityType: "Finish", entityId: id, summary: `${c.user.name} ${archived ? "archived" : "restored"} ${name} in ${f.space.name}` })
  refresh()
  return { ok: true }
}
