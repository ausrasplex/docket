import "server-only"
import { db } from "@/lib/db"
import { warranty } from "@/lib/fixtures"
import { regoDue, serviceOutlook, type Due } from "@/lib/service"
import { dueBack } from "@/lib/moves"
import { replaceDue, stock } from "@/lib/spares"

/** `itemId` is the item whose page to open (a part opens its item). */
export type ComingUp = { fixtureId: string; itemId: string; item: string; what: string; due: Due; sortAt: number; spare?: boolean }

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
      lentTo: true,
      lentDueBack: true,
      serviceEnabled: true,
      sparesEnabled: true,
      spares: { select: { name: true, onHand: true, lowAt: true, everyMonths: true, lastReplacedAt: true } },
      parent: { select: { id: true, name: true, serviceEnabled: true } },
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
    // an item with servicing turned off (or a part of one) keeps its routines but stops reminding
    const servicing = f.serviceEnabled && (f.parent?.serviceEnabled ?? true)
    for (const p of servicing ? f.servicePlans : []) {
      const done = f.serviceRecords.filter((r) => r.plans.some((x) => x.id === p.id)).map((r) => ({ date: r.date, odometer: r.odometer }))
      // a booking, or the sooner of the due date and the estimate (a km interval as a date)
      const due = serviceOutlook(p, done, readings, f.odometer, now).status
      if (urgent(due)) out.push({ fixtureId: f.id, itemId, item, what: p.name, due, sortAt: at(due) })
    }
    if (f.category === "VEHICLE") {
      const due = regoDue(f.registrationExpiresAt, now)
      if (urgent(due)) out.push({ fixtureId: f.id, itemId, item, what: "Registration", due, sortAt: at(due) })
    }
    if (f.lentTo && f.lentDueBack) {
      const due = dueBack(f.lentTo, f.lentDueBack, now)
      if (urgent(due)) out.push({ fixtureId: f.id, itemId, item, what: "Due Back", due, sortAt: at(due) })
    }
    // spares and consumables: due for replacing, or running low (only while the item tracks them)
    for (const s of f.sparesEnabled ? f.spares : []) {
      const due = replaceDue(s, now)
      if (urgent(due)) out.push({ fixtureId: f.id, itemId, item, what: s.name, due, sortAt: at(due), spare: true })
      const st = stock(s)
      if (st.low) {
        const low: Due = { tone: "soon", text: s.onHand === 0 ? "None left · buy more" : `Only ${s.onHand} left · buy more`, dueDate: null, dueKm: null }
        out.push({ fixtureId: f.id, itemId, item, what: `${s.name} Stock`, due: low, sortAt: at(low), spare: true })
      }
    }
    const w = warranty(f.warrantyExpiresAt, now)
    if (w.tone === "soon") {
      const due: Due = { tone: "soon", text: w.text, dueDate: f.warrantyExpiresAt, dueKm: null }
      out.push({ fixtureId: f.id, itemId, item, what: "Warranty", due, sortAt: at(due) })
    }
  }
  return out.sort((a, b) => a.sortAt - b.sortAt)
}
