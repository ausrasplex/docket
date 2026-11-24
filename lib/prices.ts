import "server-only"
import { db } from "@/lib/db"
import { fetchPrice } from "@/lib/price-fetch"

// Price tracking: each item can have shop pages (PriceSource) that Docket checks about once a week. A check
// adds a PriceCheck row only when the price changes, so the history stays small; the lowest and highest
// recorded prices are read from those rows. Shown on the item page, as its own section of the Insurance
// Report, and in full in Settings › Exports › Price History. Failed checks are listed in Settings › Price Checks.
//
//   PRICE_CHECK_DAYS=7        how often each page is checked
//   PRICE_CHECKS_DISABLED=1   no scheduled checks (Check Now still works)

const DAYS = Math.max(1, Number(process.env.PRICE_CHECK_DAYS) || 7)
const DAY = 86_400_000
/** a reading this far from the last one is held until the next check confirms it */
const JUMP_DOWN = 0.4
const JUMP_UP = 2.5

const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d.toString()))

export type CheckOutcome = { ok: true; price: number; held: boolean; changed: boolean } | { ok: false; error: string }

/** Checks one shop page now and records the result. Never throws. */
export async function checkSource(id: string): Promise<CheckOutcome> {
  const s = await db.priceSource.findUnique({ where: { id }, select: { id: true, url: true, selector: true, lastPrice: true, pendingPrice: true, failingSince: true } })
  if (!s) return { ok: false, error: "That shop page no longer exists." }
  const now = new Date()
  const r = await fetchPrice(s.url, s.selector)
  if (!r.ok) {
    await db.priceSource.update({ where: { id }, data: { lastCheckedAt: now, lastError: r.error, failingSince: s.failingSince ?? now } })
    return r
  }
  const price = r.reading.price
  const last = num(s.lastPrice)
  const pending = num(s.pendingPrice)
  // a big jump is held for one more check: a sale is real twice, a wrong number read usually isn't
  const jump = last != null && (price < last * JUMP_DOWN || price > last * JUMP_UP)
  const confirmed = pending != null && Math.abs(price - pending) <= pending * 0.02
  if (jump && !confirmed) {
    await db.priceSource.update({ where: { id }, data: { lastCheckedAt: now, lastError: null, failingSince: null, pendingPrice: price } })
    return { ok: true, price, held: true, changed: false }
  }
  const latest = await db.priceCheck.findFirst({ where: { sourceId: id }, orderBy: { checkedAt: "desc" }, select: { price: true } })
  const changed = !latest || num(latest.price) !== price
  await db.$transaction([
    ...(changed ? [db.priceCheck.create({ data: { sourceId: id, price, currency: r.reading.currency, inStock: r.reading.inStock, checkedAt: now } })] : []),
    db.priceSource.update({ where: { id }, data: { lastPrice: price, lastOkAt: now, lastCheckedAt: now, lastError: null, failingSince: null, pendingPrice: null } }),
  ])
  return { ok: true, price, held: false, changed }
}

/** After a reading is deleted: the source's latest price follows the history that's left. */
export async function resyncSource(id: string) {
  const latest = await db.priceCheck.findFirst({ where: { sourceId: id }, orderBy: { checkedAt: "desc" }, select: { price: true } })
  await db.priceSource.update({ where: { id }, data: { lastPrice: latest?.price ?? null, ...(latest ? {} : { lastOkAt: null }), pendingPrice: null } })
}

/** Which pages are due: weekly, a held reading the next day, and a failing page daily for its first week. */
function dueWhere(now: Date) {
  const ago = (days: number) => new Date(now.getTime() - days * DAY)
  return {
    fixture: { archivedAt: null },
    OR: [
      { lastCheckedAt: null },
      { lastCheckedAt: { lt: ago(DAYS) } },
      { pendingPrice: { not: null }, lastCheckedAt: { lt: ago(0.8) } },
      { failingSince: { gt: ago(7) }, lastCheckedAt: { lt: ago(0.8) } },
    ],
  }
}

let running: Promise<number> | null = null

/** Checks the pages that are due, one at a time with a pause between, so no shop gets a burst. */
export function runDueChecks(limit = 30): Promise<number> {
  running ??= (async () => {
    const due = await db.priceSource.findMany({ where: dueWhere(new Date()), orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } }, take: limit, select: { id: true } })
    for (const [i, s] of due.entries()) {
      if (i) await new Promise((r) => setTimeout(r, 4_000))
      await checkSource(s.id)
    }
    return due.length
  })()
    .catch((e) => {
      console.error("Docket: price checks failed:", e)
      return 0
    })
    .finally(() => {
      running = null
    })
  return running
}

/** Checks a household's failing pages now (Settings › Price Checks › Try Again). */
export async function retryFailing(householdId: string) {
  const failing = await db.priceSource.findMany({ where: { householdId, lastError: { not: null }, fixture: { archivedAt: null } }, select: { id: true }, take: 40 })
  let fixed = 0
  for (const [i, s] of failing.entries()) {
    if (i) await new Promise((r) => setTimeout(r, 2_000))
    if ((await checkSource(s.id)).ok) fixed++
  }
  return { tried: failing.length, fixed }
}

/** Started once from instrumentation.ts: looks for due pages every 30 minutes. */
export function schedulePriceChecks() {
  if (process.env.PRICE_CHECKS_DISABLED === "1") return
  const g = globalThis as unknown as { docketPriceTimer?: NodeJS.Timeout }
  if (g.docketPriceTimer) return
  setTimeout(() => void runDueChecks(), 3 * 60_000).unref()
  g.docketPriceTimer = setInterval(() => void runDueChecks(), 30 * 60_000)
  g.docketPriceTimer.unref()
}

export const priceSettings = () => ({ days: DAYS, enabled: process.env.PRICE_CHECKS_DISABLED !== "1" })

// ───────────────────────── reading it back ─────────────────────────

/** "jbhifi.com.au" for a page with no label of its own. */
export function siteName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

export type PricePoint = { id: string; price: number; currency: string; inStock: boolean | null; at: Date }
export type Extreme = { price: number; at: Date; store: string } | null

export type SourceSummary = {
  id: string
  url: string
  store: string
  label: string | null
  selector: string | null
  latest: number | null
  latestAt: Date | null
  lastCheckedAt: Date | null
  error: string | null
  failingSince: Date | null
  pending: number | null
  low: Extreme
  high: Extreme
  since: Date | null
  history: PricePoint[]
}

/** The lowest and highest price in a history, each at the first time it was recorded. */
function extremes(points: PricePoint[], store: string) {
  let low: Extreme = null
  let high: Extreme = null
  for (const p of points) {
    if (!low || p.price < low.price) low = { price: p.price, at: p.at, store }
    if (!high || p.price > high.price) high = { price: p.price, at: p.at, store }
  }
  return { low, high }
}

const sourceSelect = {
  id: true,
  url: true,
  label: true,
  selector: true,
  lastPrice: true,
  lastOkAt: true,
  lastCheckedAt: true,
  lastError: true,
  failingSince: true,
  pendingPrice: true,
  checks: { orderBy: { checkedAt: "asc" as const }, select: { id: true, price: true, currency: true, inStock: true, checkedAt: true } },
} as const

type SourceRow = {
  id: string
  url: string
  label: string | null
  selector: string | null
  lastPrice: { toString(): string } | null
  lastOkAt: Date | null
  lastCheckedAt: Date | null
  lastError: string | null
  failingSince: Date | null
  pendingPrice: { toString(): string } | null
  checks: { id: string; price: { toString(): string }; currency: string; inStock: boolean | null; checkedAt: Date }[]
}

export function summarise(s: SourceRow): SourceSummary {
  const store = s.label?.trim() || siteName(s.url)
  const history = s.checks.map((c) => ({ id: c.id, price: num(c.price)!, currency: c.currency, inStock: c.inStock, at: c.checkedAt }))
  return {
    id: s.id,
    url: s.url,
    store,
    label: s.label,
    selector: s.selector,
    latest: num(s.lastPrice),
    latestAt: s.lastOkAt,
    lastCheckedAt: s.lastCheckedAt,
    error: s.lastError,
    failingSince: s.failingSince,
    pending: num(s.pendingPrice),
    ...extremes(history, store),
    since: history[0]?.at ?? null,
    history,
  }
}

/** One item's shop pages, for its page. */
export async function itemPrices(fixtureId: string) {
  const rows = await db.priceSource.findMany({ where: { fixtureId }, orderBy: { createdAt: "asc" }, select: sourceSelect })
  return rows.map(summarise)
}

export type PricedItem = {
  id: string
  name: string
  detail: string
  room: string
  sources: SourceSummary[]
  /** the cheapest current price across its shops */
  latest: { price: number; at: Date; store: string } | null
  low: Extreme
  high: Extreme
  since: Date | null
}

/** Every item at the property with at least one shop page, grouped by room like the Insurance Report. */
export async function priceReport(householdId: string, propertyId: string) {
  const items = await db.fixture.findMany({
    where: { householdId, propertyId, archivedAt: null, priceSources: { some: {} } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      model: true,
      portable: true,
      brand: { select: { name: true } },
      space: { select: { name: true, sortOrder: true } },
      parent: { select: { name: true, portable: true, space: { select: { name: true, sortOrder: true } } } },
      priceSources: { orderBy: { createdAt: "asc" }, select: sourceSelect },
    },
  })
  const groups = new Map<string, { order: number; items: PricedItem[] }>()
  for (const f of items) {
    const portable = f.parent ? f.parent.portable : f.portable
    const space = f.space ?? f.parent?.space ?? null
    const room = portable ? "Portable" : (space?.name ?? "No Room")
    const order = portable ? 1e6 : (space?.sortOrder ?? 1e6 + 1)
    const sources = f.priceSources.map(summarise)
    const pick = (better: (a: number, b: number) => boolean, get: (s: SourceSummary) => Extreme) =>
      sources.map(get).reduce<Extreme>((best, x) => (x && (!best || better(x.price, best.price) || (x.price === best.price && x.at < best.at)) ? x : best), null)
    const current = sources
      .filter((s) => s.latest != null && s.latestAt)
      .reduce<PricedItem["latest"]>((best, s) => (!best || s.latest! < best.price ? { price: s.latest!, at: s.latestAt!, store: s.store } : best), null)
    const g = groups.get(room) ?? { order, items: [] }
    g.items.push({
      id: f.id,
      name: f.parent ? `${f.parent.name}: ${f.name}` : f.name,
      detail: [f.brand?.name, f.model].filter(Boolean).join(" "),
      room,
      sources,
      latest: current,
      low: pick((a, b) => a < b, (s) => s.low),
      high: pick((a, b) => a > b, (s) => s.high),
      since: sources.map((s) => s.since).filter((d) => d != null).sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
    })
    groups.set(room, g)
  }
  const rooms = [...groups.entries()].sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0])).map(([room, g]) => ({ room, items: g.items }))
  const all = rooms.flatMap((r) => r.items)
  return {
    rooms,
    items: all.length,
    sources: all.reduce((n, i) => n + i.sources.length, 0),
    since: all.map((i) => i.since).filter((d) => d != null).sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
    problems: all.flatMap((i) => i.sources.filter((s) => s.error).map((s) => ({ item: i, source: s }))),
  }
}

export type PriceReport = Awaited<ReturnType<typeof priceReport>>

/** Every failing shop page in the household (all properties), for Settings › Price Checks. */
export async function priceProblems(householdId: string) {
  const [failing, total] = await Promise.all([
    db.priceSource.findMany({
      where: { householdId, lastError: { not: null }, fixture: { archivedAt: null } },
      orderBy: [{ failingSince: "asc" }],
      select: {
        id: true,
        url: true,
        label: true,
        lastError: true,
        lastCheckedAt: true,
        failingSince: true,
        lastOkAt: true,
        fixture: { select: { id: true, name: true, parentId: true, parent: { select: { name: true } } } },
      },
    }),
    db.priceSource.count({ where: { householdId, fixture: { archivedAt: null } } }),
  ])
  return {
    total,
    failing: failing.map((s) => ({
      id: s.id,
      url: s.url,
      store: s.label?.trim() || siteName(s.url),
      error: s.lastError!,
      checkedAt: s.lastCheckedAt,
      failingSince: s.failingSince,
      lastOkAt: s.lastOkAt,
      itemId: s.fixture.parentId ?? s.fixture.id,
      item: s.fixture.parent ? `${s.fixture.parent.name}: ${s.fixture.name}` : s.fixture.name,
    })),
  }
}
