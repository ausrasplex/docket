"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { normaliseUrl } from "@/lib/documents"
import type { FixtureCategory } from "@/generated/prisma/enums"
import { CATEGORIES } from "@/lib/fixtures"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export type FixtureInput = {
  name: string
  category: FixtureCategory
  spaceId: string | null
  brand: string // a brand name: matched to an existing brand (any case) or created
  model: string
  serial: string
  productUrl: string
  purchasedAt: string | null // yyyy-mm-dd
  installedAt: string | null
  warrantyExpiresAt: string | null
  purchasePrice: string
  replacementValue: string
  includedInSale: boolean
  notes: string
}

function refresh(id?: string) {
  revalidatePath("/fixtures")
  if (id) revalidatePath(`/fixtures/${id}`)
  revalidatePath("/rooms", "layout")
  revalidatePath("/")
}

const day = (v: string | null) => {
  if (!v) return null
  const d = new Date(`${v}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "$1,299.00" → "1299.00"; blank → null; anything else → undefined (invalid). */
const money = (v: string) => {
  const s = v.replace(/[$,\s]/g, "")
  if (!s) return null
  return /^\d{1,10}(\.\d{1,2})?$/.test(s) ? s : undefined
}

async function brandId(householdId: string, name: string) {
  const n = name.trim()
  if (!n) return null
  const existing = await db.brand.findFirst({ where: { householdId, name: { equals: n, mode: "insensitive" } } })
  if (existing) return existing.id
  return (await db.brand.create({ data: { householdId, name: n } })).id
}

async function check(c: { householdId: string }, input: FixtureInput) {
  if (!input.name.trim()) return "Give it a name."
  if (!CATEGORIES.some((x) => x.id === input.category)) return "Pick a category."
  if (input.spaceId && !(await db.space.findFirst({ where: { id: input.spaceId, householdId: c.householdId } }))) return "That room no longer exists."
  if (input.productUrl.trim() && !normaliseUrl(input.productUrl)) return "The product page isn't a web address."
  if (money(input.purchasePrice) === undefined || money(input.replacementValue) === undefined) return "Prices are numbers, like 1299 or 1299.95."
  return null
}

function data(input: FixtureInput) {
  return {
    name: input.name.trim(),
    category: input.category,
    spaceId: input.spaceId,
    model: input.model.trim() || null,
    serial: input.serial.trim() || null,
    productUrl: normaliseUrl(input.productUrl),
    purchasedAt: day(input.purchasedAt),
    installedAt: day(input.installedAt),
    warrantyExpiresAt: day(input.warrantyExpiresAt),
    purchasePrice: money(input.purchasePrice) ?? null,
    replacementValue: money(input.replacementValue) ?? null,
    includedInSale: input.includedInSale,
    notes: input.notes.trim() || null,
  }
}

/** Adds an item, or a part of one when parentId is given (a part defaults to its item's room). */
export async function createFixture(input: FixtureInput, parentId: string | null = null): Promise<Result<{ id: string }>> {
  const c = await requireHousehold("MEMBER")
  const bad = await check(c, input)
  if (bad) return { ok: false, error: bad }
  let parent = null
  if (parentId) {
    parent = await db.fixture.findFirst({ where: { id: parentId, householdId: c.householdId, parentId: null } })
    if (!parent) return { ok: false, error: "Parts can only be added to an item, not to another part." }
  }
  const last = parent ? await db.fixture.aggregate({ where: { parentId }, _max: { sortOrder: true } }) : null
  const f = await db.fixture.create({
    data: {
      ...data(input),
      householdId: c.householdId,
      propertyId: c.property.id,
      parentId,
      sortOrder: (last?._max.sortOrder ?? 0) + 1,
      brandId: await brandId(c.householdId, input.brand),
      createdById: c.user.id,
    },
  })
  await logActivity(c, {
    action: "created",
    entityType: "Fixture",
    entityId: f.id,
    summary: parent ? `${c.user.name} added the part “${f.name}” to ${parent.name}` : `${c.user.name} added ${f.name}`,
  })
  refresh(parentId ?? f.id)
  return { ok: true, id: f.id }
}

export async function updateFixture(id: string, input: FixtureInput): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const f = await db.fixture.findFirst({ where: { id, householdId: c.householdId } })
  if (!f) return { ok: false, error: "That item no longer exists." }
  const bad = await check(c, input)
  if (bad) return { ok: false, error: bad }
  await db.fixture.update({
    where: { id },
    data: { ...data(input), brandId: await brandId(c.householdId, input.brand), updatedById: c.user.id },
  })
  refresh(f.parentId ?? id)
  return { ok: true }
}

export async function setFixtureArchived(id: string, archived: boolean): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const f = await db.fixture.findFirst({ where: { id, householdId: c.householdId } })
  if (!f) return { ok: false, error: "That item no longer exists." }
  await db.fixture.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } })
  await logActivity(c, { action: archived ? "archived" : "restored", entityType: "Fixture", entityId: id, summary: `${c.user.name} ${archived ? "archived" : "restored"} ${f.name}` })
  refresh(f.parentId ?? id)
  return { ok: true }
}

export type BrandInput = { website: string; supportUrl: string; supportPhone: string; supportEmail: string; notes: string }

/** A brand's support details, shared by every item of that brand. */
export async function updateBrand(id: string, input: BrandInput): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const b = await db.brand.findFirst({ where: { id, householdId: c.householdId } })
  if (!b) return { ok: false, error: "That brand no longer exists." }
  for (const u of [input.website, input.supportUrl]) {
    if (u.trim() && !normaliseUrl(u)) return { ok: false, error: `“${u}” isn't a web address.` }
  }
  await db.brand.update({
    where: { id },
    data: {
      website: normaliseUrl(input.website),
      supportUrl: normaliseUrl(input.supportUrl),
      supportPhone: input.supportPhone.trim() || null,
      supportEmail: input.supportEmail.trim() || null,
      notes: input.notes.trim() || null,
    },
  })
  revalidatePath("/fixtures", "layout")
  return { ok: true }
}
