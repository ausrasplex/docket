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

// ───────── Estimates and bookings ─────────
// A km interval has no date of its own, so it's estimated: from how far the car is driven (odometer readings
// across past services), or failing that, from the usual time between past services. A booked service, once
// made, is the date that counts.

export type Reading = { date: Date; odometer: number | null }
export type Estimate = { date: Date; basis: "distance" | "history"; perDay: number | null; everyDays: number | null }
export type Outlook = {
  /** the firm due date and km, from the interval (unchanged from serviceDue) */
  due: Due
  /** when the km interval will probably be reached; only when it's sooner than the firm date (or there isn't one) */
  estimate: Estimate | null
  booked: { date: Date; with: string | null; past: boolean } | null
  /** what to show on the routine's chip and in Coming Up: the booking, else whichever of due or estimate is sooner */
  status: Due
  /** the one date for calendars: booked, else the sooner of due and estimate */
  next: { date: Date; kind: "booked" | "due" | "estimate" } | null
}

const DAY_MS = 86_400_000
const addDays = (d: Date, n: number) => new Date(d.getTime() + Math.round(n) * DAY_MS)
const daysUntil = (d: Date, now: Date) => Math.ceil((d.getTime() - now.getTime()) / DAY_MS)
const inDays = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : n < 0 ? `${-n} day${n === -1 ? "" : "s"} ago` : `in ${n} days`)

/** Kilometres driven a day, from the first and last odometer readings (at least a month apart). */
export function kmPerDay(readings: Reading[]) {
  const r = readings.filter((x) => x.odometer != null).sort((a, b) => a.date.getTime() - b.date.getTime())
  if (r.length < 2) return null
  const first = r[0], last = r[r.length - 1]
  const days = (last.date.getTime() - first.date.getTime()) / DAY_MS
  const km = last.odometer! - first.odometer!
  if (days < 30 || km <= 0) return null
  return km / days
}

/** The usual number of days between services of this routine (needs two or more). */
export function usualGap(dates: Date[]) {
  const d = [...dates].sort((a, b) => a.getTime() - b.getTime())
  if (d.length < 2) return null
  const gaps = d.slice(1).map((x, i) => (x.getTime() - d[i].getTime()) / DAY_MS).filter((g) => g > 0)
  return gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null
}

export function serviceOutlook(
  plan: { everyMonths: number | null; everyKm: number | null; bookedFor: Date | null; bookedWith: string | null },
  /** services of this routine, newest first */
  done: Reading[],
  /** every odometer reading for the item (its services of any kind), for how far it's driven */
  readings: Reading[],
  currentKm: number | null,
  now = new Date(),
): Outlook {
  const last = done[0] ?? null
  const due = serviceDue(plan, last, currentKm, now)

  // the km interval as a date
  let estimate: Estimate | null = null
  if (plan.everyKm && last) {
    const perDay = kmPerDay(readings)
    const latest = readings.filter((x) => x.odometer != null).sort((a, b) => b.date.getTime() - a.date.getTime())[0]
    if (perDay && due.dueKm != null && latest) {
      estimate = { date: addDays(latest.date, (due.dueKm - latest.odometer!) / perDay), basis: "distance", perDay, everyDays: null }
    } else {
      const gap = usualGap(done.map((x) => x.date))
      if (gap) estimate = { date: addDays(last.date, gap), basis: "history", perDay: null, everyDays: gap }
    }
    if (estimate && due.dueDate && estimate.date >= due.dueDate) estimate = null // the firm date comes first anyway
  }

  const booked = plan.bookedFor ? { date: plan.bookedFor, with: plan.bookedWith, past: daysUntil(plan.bookedFor, now) < 0 } : null

  let status = due
  if (booked) {
    const n = daysUntil(booked.date, now)
    status = {
      tone: n <= SOON_DAYS ? "soon" : "ok",
      text: booked.past ? `Booked for ${day(booked.date)} · was it done?` : `Booked ${n === 0 ? "for today" : n === 1 ? "for tomorrow" : `in ${n} days`}`,
      dueDate: booked.date,
      dueKm: due.dueKm,
    }
  } else if (estimate && due.tone !== "overdue") {
    const n = daysUntil(estimate.date, now)
    if (n <= SOON_DAYS) status = { tone: "soon", text: n <= 0 ? "Probably due now" : `Probably due ${inDays(n)}`, dueDate: estimate.date, dueKm: due.dueKm }
  }

  const firm = due.dueDate
  const next = booked
    ? { date: booked.date, kind: "booked" as const }
    : estimate && (!firm || estimate.date < firm)
      ? { date: estimate.date, kind: "estimate" as const }
      : firm
        ? { date: firm, kind: "due" as const }
        : null
  return { due, estimate, booked, status, next }
}

/** "in 265 days · 12 Aug 2027", for the routine's lines. */
export function whenText(d: Date, now = new Date()) {
  return `${inDays(daysUntil(d, now))} · ${day(d)}`
}
