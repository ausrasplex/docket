// When an item's service plan is next due, from the latest service record that covered it.
// A plan can be by time ("every 12 months"), by distance ("every 15,000 km") or both (whichever comes first).

export type DueTone = "ok" | "soon" | "overdue" | "none"
export type Due = { tone: DueTone; text: string; dueDate: Date | null; dueKm: number | null }

/** How close "soon" is: a month, or 1,000 km. */
const SOON_DAYS = 30
const SOON_KM = 1000

const km = (n: number) => `${n.toLocaleString("en-AU")} km`
const day = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

function addMonths(d: Date, months: number) {
  const r = new Date(d)
  r.setUTCMonth(r.getUTCMonth() + months)
  return r
}

export function serviceDue(
  plan: { everyMonths: number | null; everyKm: number | null },
  last: { date: Date; odometer: number | null } | null,
  currentKm: number | null,
  now = new Date()
): Due {
  if (!plan.everyMonths && !plan.everyKm) return { tone: "none", text: "No interval set", dueDate: null, dueKm: null }
  if (!last) return { tone: "none", text: "Not logged yet", dueDate: null, dueKm: null }

  const dueDate = plan.everyMonths ? addMonths(last.date, plan.everyMonths) : null
  const dueKm = plan.everyKm && last.odometer != null ? last.odometer + plan.everyKm : null
  const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / 86_400_000) : null
  const kmLeft = dueKm != null && currentKm != null ? dueKm - currentKm : null

  const overdue = (daysLeft != null && daysLeft < 0) || (kmLeft != null && kmLeft <= 0)
  const soon = !overdue && ((daysLeft != null && daysLeft <= SOON_DAYS) || (kmLeft != null && kmLeft <= SOON_KM))
  const parts = [dueDate ? day(dueDate) : null, dueKm != null ? km(dueKm) : null].filter(Boolean).join(" or ")

  if (overdue) {
    const why = kmLeft != null && kmLeft <= 0 ? `${km(-kmLeft)} over` : `${-daysLeft!} day${daysLeft === -1 ? "" : "s"} late`
    return { tone: "overdue", text: `Overdue · ${why}`, dueDate, dueKm }
  }
  if (soon) {
    const when = daysLeft != null && daysLeft <= SOON_DAYS ? (daysLeft === 0 ? "today" : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`) : `in ${km(kmLeft!)}`
    return { tone: "soon", text: `Due ${when}`, dueDate, dueKm }
  }
  return { tone: "ok", text: `Due ${parts}`, dueDate, dueKm }
}

/** "Every 12 months or 15,000 km". */
export function intervalText(plan: { everyMonths: number | null; everyKm: number | null }) {
  const parts = [
    plan.everyMonths ? `${plan.everyMonths} month${plan.everyMonths === 1 ? "" : "s"}` : null,
    plan.everyKm ? km(plan.everyKm) : null,
  ].filter(Boolean)
  return parts.length ? `Every ${parts.join(" or ")}` : "No interval set"
}

/** Registration renewal, like a warranty: soon within a month, overdue once past. */
export function regoDue(expires: Date | null, now = new Date()): Due {
  if (!expires) return { tone: "none", text: "No rego expiry recorded", dueDate: null, dueKm: null }
  const days = Math.ceil((expires.getTime() - now.getTime()) / 86_400_000)
  if (days < 0) return { tone: "overdue", text: `Rego expired ${day(expires)}`, dueDate: expires, dueKm: null }
  if (days <= SOON_DAYS) return { tone: "soon", text: `Rego due in ${days} day${days === 1 ? "" : "s"}`, dueDate: expires, dueKm: null }
  return { tone: "ok", text: `Rego to ${day(expires)}`, dueDate: expires, dueKm: null }
}

export const DUE_TONE: Record<DueTone, string> = {
  ok: "bg-t3",
  soon: "bg-t2",
  overdue: "bg-danger-soft text-danger",
  none: "bg-surface2 text-muted-foreground",
}

export { km as formatKm }
