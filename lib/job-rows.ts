import "server-only"
import { db } from "@/lib/db"
import { date } from "@/lib/format"
import { isoDay } from "@/lib/parse"
import type { Prisma } from "@/generated/prisma/client"
import type { ExpenseRowData } from "@/components/jobs/expense-list"
import type { ContactFull } from "@/components/jobs/contact-card"
import type { InboxDoc } from "@/components/documents/doc-groups"

/** Costs shaped for the client list (newest first). */
export async function loadExpenses(where: Prisma.ExpenseWhereInput): Promise<ExpenseRowData[]> {
  const rows = await db.expense.findMany({
    where: { archivedAt: null, ...where },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      contact: { select: { name: true } },
      job: { select: { id: true, title: true } },
      links: { where: { document: { archivedAt: null } }, orderBy: { createdAt: "asc" }, include: { document: true } },
    },
  })
  return rows.map((e) => ({
    id: e.id,
    payee: e.contact?.name ?? e.vendor,
    job: e.job,
    receipts: e.links.map((l) => ({ linkId: l.id, doc: l.document })),
    input: {
      description: e.description ?? "",
      vendor: e.vendor ?? "",
      contactId: e.contactId,
      jobId: e.jobId,
      date: isoDay(e.date),
      amount: e.amount.toFixed(2),
      gst: e.gst ? e.gst.toFixed(2) : "",
      classification: e.classification,
      category: e.category ?? "",
      paymentMethod: e.paymentMethod ?? "",
      notes: e.notes ?? "",
    },
  }))
}

export async function loadContacts(householdId: string): Promise<ContactFull[]> {
  const rows = await db.contact.findMany({
    where: { householdId, archivedAt: null },
    orderBy: { name: "asc" },
    include: { _count: { select: { jobs: { where: { archivedAt: null } } } } },
  })
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    business: c.business ?? "",
    trade: c.trade ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    website: c.website ?? "",
    abn: c.abn ?? "",
    licence: c.licence ?? "",
    notes: c.notes ?? "",
    jobs: c._count.jobs,
  }))
}

/** For the pickers: ContactFull → the short form ContactPicker needs. */
export const contactLite = (c: ContactFull) => ({ id: c.id, name: c.name, business: c.business || null, trade: c.trade || null, phone: c.phone || null })

/** Unfiled captures, newest first, for "From Inbox" pickers. */
export async function loadInbox(householdId: string): Promise<InboxDoc[]> {
  const docs = await db.document.findMany({
    where: { householdId, archivedAt: null, links: { none: {} } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: { id: true, title: true, kind: true, thumbnailKey: true, url: true, createdAt: true },
  })
  return docs.map((d) => ({ id: d.id, title: d.title, kind: d.kind, hasThumb: !!d.thumbnailKey, isLink: !!d.url, when: date(d.createdAt) }))
}
