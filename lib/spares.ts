import type { Due } from "@/lib/service"

// Spares and consumables: when one is next due for replacing (from the last time it was replaced and how
// often), and whether stock is running low. Shared by the item page, Coming Up and the reminders.

const DAY = 86_400_000
/** How close "soon" is for a replacement: two weeks. */
const SOON_DAYS = 14
const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

export function addMonths(d: Date, months: number) {
  const r = new Date(d)
  r.setUTCMonth(r.getUTCMonth() + months)
  return r
}

/** When it's next due for replacing; "none" when it has no interval, or hasn't been replaced yet. */
export function replaceDue(s: { everyMonths: number | null; lastReplacedAt: Date | null }, now = new Date()): Due {
  if (!s.everyMonths) return { tone: "none", text: "Replaced when needed", dueDate: null, dueKm: null }
  if (!s.lastReplacedAt) return { tone: "none", text: "Not replaced yet", dueDate: null, dueKm: null }
  const due = addMonths(s.lastReplacedAt, s.everyMonths)
  const days = Math.ceil((due.getTime() - now.getTime()) / DAY)
  if (days < 0) return { tone: "overdue", text: `Replace now · ${-days} day${days === -1 ? "" : "s"} late`, dueDate: due, dueKm: null }
  if (days <= SOON_DAYS) return { tone: "soon", text: days === 0 ? "Replace today" : `Replace in ${days} day${days === 1 ? "" : "s"}`, dueDate: due, dueKm: null }
  return { tone: "ok", text: `Next ${fmt(due)}`, dueDate: due, dueKm: null }
}

/** Stock on hand: low at or below its reorder level (none left counts as low once a level is set). */
export function stock(s: { onHand: number; lowAt: number | null }): { low: boolean; text: string } {
  const low = s.lowAt != null && s.onHand <= s.lowAt
  const text = s.onHand === 0 ? "None left" : `${s.onHand} on hand`
  return { low, text: low && s.onHand > 0 ? `Low · ${s.onHand} left` : text }
}
