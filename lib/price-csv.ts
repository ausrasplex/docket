import "server-only"
import type { PriceReport } from "@/lib/prices"

// The price spreadsheets: a summary (one row per item) and the full history (one row per recorded price).
// In the Price History pack (/api/exports/prices); the summary is also in the Insurance pack.

const cell = (v: string | number | null | undefined) => {
  if (v == null) return ""
  const s = String(v)
  // quote anything with a comma, quote or line break; and stop a spreadsheet reading text as a formula
  const t = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "")
const amount = (n: number | null | undefined) => (n == null ? "" : n.toFixed(2))
const sheet = (rows: (string | number | null | undefined)[][]) => "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"

export function priceSummaryCsv(r: PriceReport) {
  const head = [
    "Room",
    "Item",
    "Brand and model",
    "Latest price (AUD)",
    "Latest at",
    "Latest checked",
    "Lowest recorded (AUD)",
    "Lowest at",
    "Lowest on",
    "Highest recorded (AUD)",
    "Highest at",
    "Highest on",
    "Tracked since",
    "Shops",
  ]
  const rows = r.rooms.flatMap((g) =>
    g.items.map((i) => [
      g.room,
      i.name,
      i.detail,
      amount(i.latest?.price),
      i.latest?.store,
      day(i.latest?.at),
      amount(i.low?.price),
      i.low?.store,
      day(i.low?.at),
      amount(i.high?.price),
      i.high?.store,
      day(i.high?.at),
      day(i.since),
      i.sources.map((s) => s.store).join("; "),
    ])
  )
  return sheet([head, ...rows])
}

export function priceHistoryCsv(r: PriceReport) {
  const head = ["Room", "Item", "Shop", "Page", "Price", "Currency", "In stock", "Recorded on", "Still this price at last check"]
  const rows = r.rooms.flatMap((g) =>
    g.items.flatMap((i) =>
      i.sources.flatMap((s) =>
        s.history.map((p, n) => [
          g.room,
          i.name,
          s.store,
          s.url,
          amount(p.price),
          p.currency,
          p.inStock == null ? "" : p.inStock ? "Yes" : "No",
          day(p.at),
          n === s.history.length - 1 && s.latestAt ? day(s.latestAt) : "",
        ])
      )
    )
  )
  return sheet([head, ...rows])
}
