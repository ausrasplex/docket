"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { normaliseUrl } from "@/lib/documents"
import { EXPENSE_CLASSES, JOB_STATUSES } from "@/lib/jobs"
import { parseDay, parseMoney } from "@/lib/parse"
import { money } from "@/lib/format"
import type { ExpenseClass, JobStatus } from "@/generated/prisma/enums"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

function refresh(jobId?: string | null) {
  revalidatePath("/jobs")
  if (jobId) revalidatePath(`/jobs/${jobId}`)
  revalidatePath("/rooms", "layout")
  revalidatePath("/")
}

// ───────── Tradespeople ─────────

export type ContactInput = { name: string; business: string; trade: string; phone: string; email: string; website: string; abn: string; licence: string; notes: string }

function contactData(i: ContactInput) {
  return {
    name: i.name.trim(),
    business: i.business.trim() || null,
    trade: i.trade.trim() || null,
    phone: i.phone.trim() || null,
    email: i.email.trim() || null,
    website: normaliseUrl(i.website),
    abn: i.abn.replace(/\s/g, "") || null,
    licence: i.licence.trim() || null,
    notes: i.notes.trim() || null,
  }
}

export async function saveContact(id: string | null, input: ContactInput): Promise<Result<{ id: string }>> {
  const c = await requireHousehold("MEMBER")
  if (!input.name.trim()) return { ok: false, error: "Add their name." }
  if (input.website.trim() && !normaliseUrl(input.website)) return { ok: false, error: "The website isn't a web address." }
  if (input.abn.trim() && !/^\d{11}$/.test(input.abn.replace(/\s/g, ""))) return { ok: false, error: "An ABN has 11 digits." }
  if (id) {
    const existing = await db.contact.findFirst({ where: { id, householdId: c.householdId } })
    if (!existing) return { ok: false, error: "That person no longer exists." }
    await db.contact.update({ where: { id }, data: contactData(input) })
    refresh()
    return { ok: true, id }
  }
  const created = await db.contact.create({ data: { ...contactData(input), householdId: c.householdId } })
  refresh()
  return { ok: true, id: created.id }
}

export async function setContactArchived(id: string, archived: boolean): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const r = await db.contact.updateMany({ where: { id, householdId: c.householdId }, data: { archivedAt: archived ? new Date() : null } })
  if (!r.count) return { ok: false, error: "That person no longer exists." }
  refresh()
  return { ok: true }
}

// ───────── Jobs ─────────

export type JobInput = {
  title: string
  status: JobStatus
  spaceIds: string[]
  contactId: string | null
  startedAt: string | null
  finishedAt: string | null
  permitNumber: string
  description: string
}

async function checkJob(householdId: string, i: JobInput) {
  if (!i.title.trim()) return "Give the job a title."
  if (!JOB_STATUSES.some((s) => s.id === i.status)) return "Pick a status."
  if (i.contactId && !(await db.contact.findFirst({ where: { id: i.contactId, householdId } }))) return "That tradesperson no longer exists."
  const ids = [...new Set(i.spaceIds)]
  if (ids.length && (await db.space.count({ where: { id: { in: ids }, householdId } })) !== ids.length) return "One of those rooms no longer exists."
  const s = parseDay(i.startedAt), f = parseDay(i.finishedAt)
  if (s && f && f < s) return "The finish date is before the start date."
  return null
}

function jobData(i: JobInput) {
  return {
    title: i.title.trim(),
    status: i.status,
    contactId: i.contactId,
    startedAt: parseDay(i.startedAt),
    finishedAt: parseDay(i.finishedAt),
    permitNumber: i.permitNumber.trim() || null,
    description: i.description.trim() || null,
  }
}

export async function createJob(input: JobInput): Promise<Result<{ id: string }>> {
  const c = await requireHousehold("MEMBER")
  const bad = await checkJob(c.householdId, input)
  if (bad) return { ok: false, error: bad }
  const job = await db.job.create({
    data: {
      ...jobData(input),
      householdId: c.householdId,
      propertyId: c.property.id,
      createdById: c.user.id,
      spaces: { create: [...new Set(input.spaceIds)].map((spaceId) => ({ spaceId })) },
    },
  })
  await logActivity(c, { action: "created", entityType: "Job", entityId: job.id, summary: `${c.user.name} added the job “${job.title}”` })
  refresh(job.id)
  return { ok: true, id: job.id }
}

export async function updateJob(id: string, input: JobInput): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const job = await db.job.findFirst({ where: { id, householdId: c.householdId } })
  if (!job) return { ok: false, error: "That job no longer exists." }
  const bad = await checkJob(c.householdId, input)
  if (bad) return { ok: false, error: bad }
  await db.$transaction([
    db.job.update({ where: { id }, data: { ...jobData(input), updatedById: c.user.id } }),
    db.jobSpace.deleteMany({ where: { jobId: id } }),
    db.jobSpace.createMany({ data: [...new Set(input.spaceIds)].map((spaceId) => ({ jobId: id, spaceId })) }),
  ])
  if (job.status !== input.status) {
    await logActivity(c, { action: "updated", entityType: "Job", entityId: id, summary: `${c.user.name} marked “${input.title.trim()}” ${input.status.toLowerCase().replace("_", " ")}` })
  }
  refresh(id)
  return { ok: true }
}

export async function setJobArchived(id: string, archived: boolean): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const job = await db.job.findFirst({ where: { id, householdId: c.householdId } })
  if (!job) return { ok: false, error: "That job no longer exists." }
  await db.job.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } })
  await logActivity(c, { action: archived ? "archived" : "restored", entityType: "Job", entityId: id, summary: `${c.user.name} ${archived ? "archived" : "restored"} the job “${job.title}”` })
  refresh(id)
  return { ok: true }
}

// ───────── Costs (expenses) ─────────

export type ExpenseInput = {
  description: string
  vendor: string
  contactId: string | null
  jobId: string | null
  date: string | null
  amount: string
  gst: string
  classification: ExpenseClass
  category: string
  paymentMethod: string
  notes: string
}

async function checkExpense(householdId: string, i: ExpenseInput) {
  if (!i.description.trim() && !i.vendor.trim()) return "Say what it was for, or who it was paid to."
  if (!parseDay(i.date)) return "Add the date on the receipt."
  const amount = parseMoney(i.amount)
  if (!amount) return "Add the amount, like 1299 or 1299.95."
  const gst = parseMoney(i.gst)
  if (gst === undefined) return "GST should be an amount, like 118.18."
  if (gst && Number(gst) > Number(amount)) return "GST can't be more than the total."
  if (!EXPENSE_CLASSES.some((x) => x.id === i.classification)) return "Pick how it's treated."
  if (i.jobId && !(await db.job.findFirst({ where: { id: i.jobId, householdId } }))) return "That job no longer exists."
  if (i.contactId && !(await db.contact.findFirst({ where: { id: i.contactId, householdId } }))) return "That tradesperson no longer exists."
  return null
}

function expenseData(i: ExpenseInput) {
  return {
    description: i.description.trim() || null,
    vendor: i.vendor.trim() || null,
    contactId: i.contactId,
    jobId: i.jobId,
    date: parseDay(i.date)!,
    amount: parseMoney(i.amount)!,
    gst: parseMoney(i.gst) ?? null,
    classification: i.classification,
    category: i.category.trim() || null,
    paymentMethod: i.paymentMethod.trim() || null,
    notes: i.notes.trim() || null,
  }
}

export async function createExpense(input: ExpenseInput): Promise<Result<{ id: string }>> {
  const c = await requireHousehold("MEMBER")
  const bad = await checkExpense(c.householdId, input)
  if (bad) return { ok: false, error: bad }
  const e = await db.expense.create({ data: { ...expenseData(input), householdId: c.householdId, createdById: c.user.id } })
  await logActivity(c, {
    action: "created",
    entityType: "Expense",
    entityId: e.id,
    summary: `${c.user.name} added a ${money(e.amount, true)} cost${e.description ? ` for ${e.description}` : e.vendor ? ` from ${e.vendor}` : ""}`,
  })
  refresh(e.jobId)
  return { ok: true, id: e.id }
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const e = await db.expense.findFirst({ where: { id, householdId: c.householdId } })
  if (!e) return { ok: false, error: "That cost no longer exists." }
  const bad = await checkExpense(c.householdId, input)
  if (bad) return { ok: false, error: bad }
  await db.expense.update({ where: { id }, data: { ...expenseData(input), updatedById: c.user.id } })
  refresh(e.jobId)
  if (input.jobId !== e.jobId) refresh(input.jobId)
  return { ok: true }
}

export async function setExpenseArchived(id: string, archived: boolean): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const e = await db.expense.findFirst({ where: { id, householdId: c.householdId } })
  if (!e) return { ok: false, error: "That cost no longer exists." }
  await db.expense.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } })
  refresh(e.jobId)
  return { ok: true }
}
