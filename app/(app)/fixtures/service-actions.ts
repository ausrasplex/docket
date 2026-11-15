"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { parseDay, parseMoney } from "@/lib/parse"
import { formatKm } from "@/lib/service"
import { money } from "@/lib/format"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

function refresh() {
  revalidatePath("/fixtures", "layout")
  revalidatePath("/jobs", "layout") // service costs are costs too
  revalidatePath("/")
}

/** "84,250" or "84250 km" → 84250; blank → null; anything else → undefined (invalid). */
function parseKm(v: string) {
  const s = v.replace(/[,\s]|km$/gi, "")
  if (!s) return null
  return /^\d{1,7}$/.test(s) ? Number(s) : undefined
}
/** "12" → 12; blank → null; anything else → undefined. */
function parseCount(v: string, max: number) {
  const s = v.trim()
  if (!s) return null
  return /^\d+$/.test(s) && Number(s) >= 1 && Number(s) <= max ? Number(s) : undefined
}

async function ownItem(householdId: string, fixtureId: string) {
  return db.fixture.findFirst({ where: { id: fixtureId, householdId }, select: { id: true, name: true, odometer: true } })
}

// ───────── Plans ─────────

export type PlanInput = { name: string; everyMonths: string; everyKm: string; notes: string }

export async function savePlan(fixtureId: string, id: string | null, input: PlanInput): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const item = await ownItem(c.householdId, fixtureId)
  if (!item) return { ok: false, error: "That item no longer exists." }
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Name the routine, like “Logbook service”." }
  const everyMonths = parseCount(input.everyMonths, 240)
  const everyKm = parseKm(input.everyKm)
  if (everyMonths === undefined) return { ok: false, error: "Months is a whole number, like 12." }
  if (everyKm === undefined) return { ok: false, error: "Kilometres is a number, like 15000." }
  if (!everyMonths && !everyKm) return { ok: false, error: "Say how often: every so many months, kilometres, or both." }
  const data = { name, everyMonths, everyKm, notes: input.notes.trim() || null }
  if (id) {
    const r = await db.servicePlan.updateMany({ where: { id, fixtureId, householdId: c.householdId }, data })
    if (!r.count) return { ok: false, error: "That routine no longer exists." }
  } else {
    await db.servicePlan.create({ data: { ...data, householdId: c.householdId, fixtureId } })
  }
  refresh()
  return { ok: true }
}

export async function archivePlan(id: string): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const r = await db.servicePlan.updateMany({ where: { id, householdId: c.householdId }, data: { archivedAt: new Date() } })
  if (!r.count) return { ok: false, error: "That routine no longer exists." }
  refresh()
  return { ok: true }
}

// ───────── Service log ─────────

export type RecordInput = {
  date: string | null
  odometer: string
  title: string
  notes: string
  planIds: string[]
  contactId: string | null
  vendor: string
  amount: string // blank = no cost recorded
  gst: string
}

/**
 * Logs (or edits) a service. A cost becomes a normal "Repair" expense for the item, so it shows in Jobs
 * and the yearly totals; its receipt is attached to that expense. A higher odometer reading moves the
 * item's odometer up.
 */
export async function saveRecord(fixtureId: string, id: string | null, input: RecordInput): Promise<Result<{ id: string; expenseId: string | null }>> {
  const c = await requireHousehold("MEMBER")
  const item = await ownItem(c.householdId, fixtureId)
  if (!item) return { ok: false, error: "That item no longer exists." }
  const date = parseDay(input.date)
  if (!date) return { ok: false, error: "Add the date of the service." }
  const title = input.title.trim()
  if (!title) return { ok: false, error: "Say what was done, like “12-month logbook service”." }
  const odometer = parseKm(input.odometer)
  if (odometer === undefined) return { ok: false, error: "The odometer is a number of kilometres, like 84250." }
  const amount = parseMoney(input.amount)
  if (amount === undefined) return { ok: false, error: "The cost is an amount, like 389 or 389.50." }
  const gst = parseMoney(input.gst)
  if (gst === undefined) return { ok: false, error: "GST is an amount, like 35.36." }
  if (amount && gst && Number(gst) > Number(amount)) return { ok: false, error: "GST can't be more than the cost." }
  const planIds = [...new Set(input.planIds)]
  if (planIds.length && (await db.servicePlan.count({ where: { id: { in: planIds }, fixtureId } })) !== planIds.length) {
    return { ok: false, error: "One of those routines no longer exists." }
  }
  if (input.contactId && !(await db.contact.findFirst({ where: { id: input.contactId, householdId: c.householdId } }))) {
    return { ok: false, error: "That tradesperson no longer exists." }
  }

  const existing = id ? await db.serviceRecord.findFirst({ where: { id, fixtureId, householdId: c.householdId } }) : null
  if (id && !existing) return { ok: false, error: "That service no longer exists." }

  // the cost, as an expense: create, update, or remove when the cost was cleared
  const expenseData = {
    date,
    amount: amount ?? "0",
    gst: gst ?? null,
    description: `${item.name}: ${title}`,
    vendor: input.vendor.trim() || null,
    contactId: input.contactId,
    classification: "REPAIR_MAINTENANCE" as const,
    category: "Service",
  }
  let expenseId = existing?.expenseId ?? null
  if (amount) {
    if (expenseId) await db.expense.update({ where: { id: expenseId }, data: { ...expenseData, archivedAt: null, updatedById: c.user.id } })
    else expenseId = (await db.expense.create({ data: { ...expenseData, householdId: c.householdId, createdById: c.user.id } })).id
  } else if (expenseId) {
    await db.expense.update({ where: { id: expenseId }, data: { archivedAt: new Date() } })
    expenseId = null
  }

  const data = {
    date,
    odometer,
    title,
    notes: input.notes.trim() || null,
    contactId: input.contactId,
    expenseId,
    plans: { set: planIds.map((p) => ({ id: p })) },
  }
  const rec = existing
    ? await db.serviceRecord.update({ where: { id: existing.id }, data })
    : await db.serviceRecord.create({
        data: { ...data, plans: { connect: planIds.map((p) => ({ id: p })) }, householdId: c.householdId, fixtureId, createdById: c.user.id },
      })

  if (odometer != null && (item.odometer == null || odometer > item.odometer)) {
    await db.fixture.update({ where: { id: fixtureId }, data: { odometer } })
  }
  if (!existing) {
    await logActivity(c, {
      action: "created",
      entityType: "ServiceRecord",
      entityId: rec.id,
      summary: `${c.user.name} logged “${title}” for ${item.name}${odometer != null ? ` at ${formatKm(odometer)}` : ""}${amount ? ` (${money(amount, true)})` : ""}`,
    })
  }
  refresh()
  return { ok: true, id: rec.id, expenseId }
}

/** Removes a service from the log; its cost is archived with it (the receipt stays in Documents). */
export async function deleteRecord(id: string): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const rec = await db.serviceRecord.findFirst({ where: { id, householdId: c.householdId } })
  if (!rec) return { ok: false, error: "That service no longer exists." }
  await db.serviceRecord.delete({ where: { id } })
  if (rec.expenseId) await db.expense.update({ where: { id: rec.expenseId }, data: { archivedAt: new Date() } })
  refresh()
  return { ok: true }
}
