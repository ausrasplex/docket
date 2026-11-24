import "server-only"
import { db } from "@/lib/db"
import { warranty } from "@/lib/fixtures"
import { regoDue, serviceOutlook, type Due } from "@/lib/service"

/** `itemId` is the item whose page to open (a part opens its item). */
export type ComingUp = { fixtureId: string; itemId: string; item: string; what: string; due: Due; sortAt: number }

/**
 * Everything needing attention soon or already overdue in a property: services (by date or km),
 * vehicle registrations, and warranties ending within a month. Most urgent first.
 */
export async function comingUp(householdId: string, propertyId: string, now = new Date()): Promise<ComingUp[]> {
  const items = await db.fixture.findMany({
    where: { householdId, propertyId, archivedAt: null },
    select: {
      id: true,
      name: true,
      category: true,
      odometer: true,
      registrationExpiresAt: true,
      warrantyExpiresAt: true,
      parent: { select: { id: true, name: true } },
      servicePlans: { where: { archivedAt: null }, select: { id: true, name: true, everyMonths: true, everyKm: true, bookedFor: true, bookedWith: true } },
      serviceRecords: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], select: { date: true, odometer: true, plans: { select: { id: true } } } },
    },
  })
  const out: ComingUp[] = []
  const urgent = (d: Due) => d.tone === "soon" || d.tone === "overdue"
  const at = (d: Due) => (d.tone === "overdue" ? 0 : 1) * 1e13 + (d.dueDate?.getTime() ?? now.getTime())
  for (const f of items) {
    // parts open their item, and are named with it
    const itemId = f.parent?.id ?? f.id
    const item = f.parent ? `${f.parent.name} › ${f.name}` : f.name
    const readings = f.serviceRecords.map((r) => ({ date: r.date, odometer: r.odometer }))
    for (const p of f.servicePlans) {
      const done = f.serviceRecords.filter((r) => r.plans.some((x) => x.id === p.id)).map((r) => ({ date: r.date, odometer: r.odometer }))
      // a booking, or the sooner of the due date and the estimate (a km interval as a date)
      const due = serviceOutlook(p, done, readings, f.odometer, now).status
      if (urgent(due)) out.push({ fixtureId: f.id, itemId, item, what: p.name, due, sortAt: at(due) })
    }
    if (f.category === "VEHICLE") {
      const due = regoDue(f.registrationExpiresAt, now)
      if (urgent(due)) out.push({ fixtureId: f.id, itemId, item, what: "Registration", due, sortAt: at(due) })
    }
    const w = warranty(f.warrantyExpiresAt, now)
    if (w.tone === "soon") {
      const due: Due = { tone: "soon", text: w.text, dueDate: f.warrantyExpiresAt, dueKm: null }
      out.push({ fixtureId: f.id, itemId, item, what: "Warranty", due, sortAt: at(due) })
    }
  }
  return out.sort((a, b) => a.sortAt - b.sortAt)
}
