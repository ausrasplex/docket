// Parsing form values on the server (shared by the actions).

/** "$1,299.95" → "1299.95"; blank → null; anything else → undefined (invalid). */
export function parseMoney(v: string): string | null | undefined {
  const s = v.replace(/[$,\s]/g, "")
  if (!s) return null
  return /^\d{1,10}(\.\d{1,2})?$/.test(s) ? s : undefined
}

/** "2026-11-15" → a UTC date; blank or invalid → null. */
export function parseDay(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(`${v}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null)

/** GST included in a GST-inclusive Australian price (10%): amount ÷ 11, to the cent. */
export function gstOf(amount: string): string {
  const n = Number(amount)
  return Number.isFinite(n) ? (Math.round((n / 11) * 100) / 100).toFixed(2) : ""
}
