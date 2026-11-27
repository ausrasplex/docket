"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { normaliseUrl } from "@/lib/documents"
import type { FixtureCategory } from "@/generated/prisma/enums"
import { CATEGORIES } from "@/lib/fixtures"
import { syncReplacement } from "@/lib/prices"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export type FixtureInput = {
  name: string
  category: FixtureCategory
  spaceId: string | null
  /** moves around the house, so it has no room (items only, not parts) */
  portable: boolean
  brand: string // a brand name: matched to an existing brand (any case) or created
  model: string
  serial: string
  productUrl: string
  store: string
  colour: string
  size: string
  purchasedAt: string | null // yyyy-mm-dd
  installedAt: string | null
  warrantyExpiresAt: string | null
  purchasePrice: string
  replacementValue: string
  /** Replacement Cost follows the cheapest current price at its tracked shops */
  replacementFromPrices: boolean
  includedInSale: boolean
  /** shows the Service section (items only) */
  serviceEnabled: boolean
  /** shows the Parts section (items only); stays on while the item has parts */
  partsEnabled: boolean
  sparesEnabled: boolean
  notes: string
  // vehicles
  registration: string
  vin: string
  registrationExpiresAt: string | null
  odometer: string // km
}

function refresh() {
  revalidatePath("/fixtures", "layout")
  revalidatePath("/rooms", "layout")
  revalidatePath("/")
}

/** "84,250" or "84250 km" → 84250; blank → null; anything else → undefined (invalid). */
const km = (v: string) => {
  const s = v.replace(/[,\s]|km$/gi, "")
  if (!s) return null
  return /^\d{1,7}$/.test(s) ? Number(s) : undefined
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
  if (km(input.odometer) === undefined) return "The odometer is a number of kilometres, like 84250."
  return null
}

function data(input: FixtureInput) {
  return {
    name: input.name.trim(),
    category: input.category,
    // a portable item has no room
    spaceId: input.portable ? null : input.spaceId,
    portable: input.portable,
    model: input.model.trim() || null,
    serial: input.serial.trim() || null,
    productUrl: normaliseUrl(input.productUrl),
    store: input.store.trim() || null,
    colour: input.colour.trim() || null,
    size: input.size.trim() || null,
    purchasedAt: day(input.purchasedAt),
    installedAt: day(input.installedAt),
    warrantyExpiresAt: day(input.warrantyExpiresAt),
    purchasePrice: money(input.purchasePrice) ?? null,
    replacementValue: money(input.replacementValue) ?? null,
    replacementFromPrices: input.replacementFromPrices,
    includedInSale: input.includedInSale,
    serviceEnabled: input.serviceEnabled,
    partsEnabled: input.partsEnabled,
    sparesEnabled: input.sparesEnabled,
    notes: input.notes.trim() || null,
    registration: input.registration.trim().toUpperCase() || null,
    vin: input.vin.trim().toUpperCase() || null,
    registrationExpiresAt: day(input.registrationExpiresAt),
    odometer: km(input.odometer) ?? null,
  }
}

/** A new vehicle's servicing, from the Add Item form: its interval, and its last service if known. */
export type FirstService = { everyMonths: string; everyKm: string; lastDate: string | null; lastKm: string }

/** "12" → 12; blank → null; anything else → undefined. */
const count = (v: string, max: number) => {
  const s = v.trim()
  if (!s) return null
  return /^\d+$/.test(s) && Number(s) >= 1 && Number(s) <= max ? Number(s) : undefined
}

/**
 * Adds an item, or a part of one when parentId is given (a part defaults to its item's room). A vehicle can
 * start with its service interval (a "Logbook service" routine) and its last service, so the countdown to the
 * next one starts straight away.
 */
export async function createFixture(input: FixtureInput, parentId: string | null = null, service?: FirstService): Promise<Result<{ id: string }>> {
  const c = await requireHousehold("MEMBER")
  const bad = await check(c, input)
  if (bad) return { ok: false, error: bad }
  const everyMonths = service ? count(service.everyMonths, 240) : null
  const everyKm = service ? km(service.everyKm) : null
  const lastDate = service ? day(service.lastDate) : null
  const lastKm = service ? km(service.lastKm) : null
  if (everyMonths === undefined) return { ok: false, error: "Service every so many months is a whole number, like 12." }
  if (everyKm === undefined || lastKm === undefined) return { ok: false, error: "Kilometres are a number, like 15000." }
  if (lastDate && lastDate > new Date()) return { ok: false, error: "The last service is a date that's passed. Book future ones from the item's page." }
  if ((lastDate || lastKm) && !everyMonths && !everyKm) return { ok: false, error: "Say how often it's serviced, so the last service has something to count from." }
  let parent = null
  if (parentId) {
    parent = await db.fixture.findFirst({ where: { id: parentId, householdId: c.householdId, parentId: null } })
    if (!parent) return { ok: false, error: "Parts can only be added to an item, not to another part." }
  }
  // adding a part turns its item's Parts section on
  if (parent && !parent.partsEnabled) await db.fixture.update({ where: { id: parent.id }, data: { partsEnabled: true } })
  const last = parent ? await db.fixture.aggregate({ where: { parentId }, _max: { sortOrder: true } }) : null
  const f = await db.fixture.create({
    data: {
      ...data(input),
      householdId: c.householdId,
      propertyId: c.property.id,
      parentId,
      portable: parentId ? false : input.portable, // parts go where their item goes
      // a new vehicle given a service interval is tracked, whatever the box said
      ...(!parentId && (everyMonths || everyKm) ? { serviceEnabled: true } : {}),
      sortOrder: (last?._max.sortOrder ?? 0) + 1,
      brandId: await brandId(c.householdId, input.brand),
      createdById: c.user.id,
    },
  })
  if (!parent && (everyMonths || everyKm)) {
    const plan = await db.servicePlan.create({ data: { householdId: c.householdId, fixtureId: f.id, name: "Logbook service", everyMonths, everyKm } })
    if (lastDate) {
      await db.serviceRecord.create({
        data: { householdId: c.householdId, fixtureId: f.id, date: lastDate, odometer: lastKm, title: "Logbook service", plans: { connect: [{ id: plan.id }] }, createdById: c.user.id },
      })
    }
    if (lastKm != null && (f.odometer == null || lastKm > f.odometer)) await db.fixture.update({ where: { id: f.id }, data: { odometer: lastKm } })
  }
  await logActivity(c, {
    action: "created",
    entityType: "Fixture",
    entityId: f.id,
    summary: parent ? `${c.user.name} added the part “${f.name}” to ${parent.name}` : `${c.user.name} added ${f.name}`,
  })
  refresh()
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
    data: {
      ...data(input),
      ...(f.parentId ? { portable: false } : {}),
      // Parts can only be turned off once the item has none left
      ...(!input.partsEnabled && (await db.fixture.count({ where: { parentId: id, archivedAt: null } })) ? { partsEnabled: true } : {}),
      brandId: await brandId(c.householdId, input.brand), updatedById: c.user.id },
  })
  await syncReplacement(id)
  refresh()
  revalidatePath("/exports/insurance")
  return { ok: true }
}

export async function setFixtureArchived(id: string, archived: boolean): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const f = await db.fixture.findFirst({ where: { id, householdId: c.householdId } })
  if (!f) return { ok: false, error: "That item no longer exists." }
  await db.fixture.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } })
  await logActivity(c, { action: archived ? "archived" : "restored", entityType: "Fixture", entityId: id, summary: `${c.user.name} ${archived ? "archived" : "restored"} ${f.name}` })
  refresh()
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
