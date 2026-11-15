// Australian formats throughout (en-AU, AUD).

const money0 = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })
const money2 = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" })

export function money(v: number | string | { toString(): string } | null | undefined, cents = false) {
  if (v == null) return ""
  const n = Number(v.toString())
  return (cents ? money2 : money0).format(n)
}

export function date(d: Date | null | undefined) {
  if (!d) return ""
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
}

export function bytes(n: number | null | undefined) {
  if (!n) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** The Australian financial year (1 July – 30 June) containing `d`. */
export function financialYear(d: Date) {
  const startYear = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
  return {
    start: new Date(Date.UTC(startYear, 6, 1)),
    end: new Date(Date.UTC(startYear + 1, 5, 30)),
    label: `Jul ${startYear} – Jun ${startYear + 1}`,
  }
}

export function plural(n: number, one: string, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`
}
