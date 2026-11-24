import "server-only"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import * as cheerio from "cheerio"

// Reads the price off a shop's product page with a plain web request (no browser), in this order:
//   1. the household's own CSS selector, when they've set one for the page
//   2. JSON-LD (schema.org Product → offers), which most large shops publish for Google Shopping
//   3. price meta tags (product:price:amount, og:price:amount)
//   4. microdata (itemprop="price")
// Sites that build the price with JavaScript, or that block automated requests, fail with a readable reason
// that Settings › Price Checks lists.

export type Reading = { price: number; currency: string; inStock: boolean | null; via: "selector" | "json-ld" | "meta" | "microdata" }
export type FetchResult = { ok: true; reading: Reading } | { ok: false; error: string }

const TIMEOUT = 15_000
const MAX_BYTES = 4 * 1024 * 1024
const MAX_REDIRECTS = 5
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-AU,en;q=0.9",
}

/** True for addresses on this machine or the local network: the server must not be pointed at those. */
function privateAddress(ip: string) {
  const v = ip.startsWith("::ffff:") ? ip.slice(7) : ip
  if (isIP(v) === 4) {
    const [a, b] = v.split(".").map(Number)
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  const s = v.toLowerCase()
  return s === "::" || s === "::1" || s.startsWith("fc") || s.startsWith("fd") || s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb")
}

async function publicUrl(u: URL) {
  if (u.protocol !== "http:" && u.protocol !== "https:") return "Only http and https addresses can be checked."
  if (u.username || u.password) return "The address can't include a login."
  const host = u.hostname.replace(/^\[|\]$/g, "")
  try {
    const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true })
    if (!addrs.length) return "The site's address doesn't exist."
    if (addrs.some((a) => privateAddress(a.address))) return "That address is on a private network, so it isn't checked."
  } catch {
    return "The site's address doesn't exist."
  }
  return null
}

async function readCapped(res: Response) {
  if (!res.body) return ""
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MAX_BYTES) {
      await reader.cancel()
      break // the price is near the top of the page; what's read so far is enough
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks).toString("utf8")
}

const reasons: Record<number, string> = {
  401: "The site wants a login (401).",
  403: "Blocked by the site (403): it refuses automated requests.",
  404: "Page not found (404): the product may have been removed.",
  410: "Page removed (410).",
  429: "The site asked to slow down (429); it'll be tried again later.",
  503: "The site is unavailable or blocking automated requests (503).",
}

/** Fetches a product page (following redirects, each checked to be a public address). */
async function fetchPage(url: string): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { ok: false, error: "That isn't a web address." }
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const bad = await publicUrl(u)
    if (bad) return { ok: false, error: bad }
    let res: Response
    try {
      res = await fetch(u, { headers: HEADERS, redirect: "manual", signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" })
    } catch (e) {
      const name = e instanceof Error ? e.name : ""
      return { ok: false, error: name === "TimeoutError" ? "The site took too long to answer." : "Couldn't reach the site." }
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      u = new URL(res.headers.get("location")!, u)
      continue
    }
    if (!res.ok) return { ok: false, error: reasons[res.status] ?? `The site answered with an error (${res.status}).` }
    const type = res.headers.get("content-type") ?? ""
    if (type && !/html|xml/i.test(type)) return { ok: false, error: "That address isn't a web page." }
    return { ok: true, html: await readCapped(res) }
  }
  return { ok: false, error: "The site redirected too many times." }
}

/** "$1,299.00", "1299", "AU$ 1 299.95" → 1299 / 1299.95; null when there's no price-like number. */
export function parsePrice(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? Math.round(v * 100) / 100 : null
  if (typeof v !== "string") return null
  const m = v.replace(/ /g, " ").match(/\d{1,3}(?:[, ]\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?/)
  if (!m) return null
  const n = Number(m[0].replace(/[, ]/g, ""))
  return Number.isFinite(n) && n > 0 && n < 1e9 ? Math.round(n * 100) / 100 : null
}

const types = (o: Record<string, unknown>) => [o["@type"]].flat().map((t) => String(t ?? "").replace(/^.*[/#]/, ""))

const stock = (v: unknown) => {
  const s = String(v ?? "").toLowerCase()
  if (!s) return null
  return /instock|limitedavailability|onlineonly|instoreonly|presale|preorder/.test(s.replace(/[^a-z]/g, "")) ? true : /outofstock|soldout|discontinued/.test(s.replace(/[^a-z]/g, "")) ? false : null
}

/** The lowest offer price on a schema.org Product (an Offer, an AggregateOffer, or a list of them). */
function offerPrice(offers: unknown): { price: number; currency: string | null; inStock: boolean | null } | null {
  const list = [offers].flat().filter((o): o is Record<string, unknown> => !!o && typeof o === "object")
  let best: { price: number; currency: string | null; inStock: boolean | null } | null = null
  for (const o of list) {
    const spec = [o.priceSpecification].flat().find((s): s is Record<string, unknown> => !!s && typeof s === "object")
    const price = parsePrice(o.price) ?? parsePrice(o.lowPrice) ?? parsePrice(spec?.price)
    const nested = o.offers ? offerPrice(o.offers) : null
    const cand = price != null ? { price, currency: (o.priceCurrency ?? spec?.priceCurrency ?? null) as string | null, inStock: stock(o.availability) } : nested
    if (cand && (!best || cand.price < best.price)) best = cand
  }
  return best
}

function fromJsonLd($: cheerio.CheerioAPI) {
  const found: { price: number; currency: string | null; inStock: boolean | null }[] = []
  const visit = (node: unknown, depth: number) => {
    if (!node || typeof node !== "object" || depth > 8) return
    if (Array.isArray(node)) return node.forEach((n) => visit(n, depth + 1))
    const o = node as Record<string, unknown>
    const t = types(o)
    if (t.some((x) => x === "Product" || x === "ProductGroup" || x === "IndividualProduct") && o.offers) {
      const p = offerPrice(o.offers)
      if (p) found.push(p)
    }
    for (const k of ["@graph", "hasVariant", "mainEntity", "itemListElement", "item"]) if (o[k]) visit(o[k], depth + 1)
  }
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim().replace(/^<!\[CDATA\[|\]\]>$/g, "")
    try {
      visit(JSON.parse(raw), 0)
    } catch {
      // some sites publish broken JSON-LD; the other methods still get a go
    }
  })
  // a page about one product lists it first; variants (hasVariant) can follow, so take the first found
  return found[0] ?? null
}

function fromMeta($: cheerio.CheerioAPI) {
  const meta = (names: string[]) => {
    for (const n of names) {
      const v = $(`meta[property="${n}"], meta[name="${n}"], meta[itemprop="${n}"]`).first().attr("content")
      if (v) return v
    }
    return null
  }
  const price = parsePrice(meta(["product:price:amount", "og:price:amount", "product:sale_price:amount"]))
  if (price == null) return null
  return { price, currency: meta(["product:price:currency", "og:price:currency"]), inStock: stock(meta(["product:availability", "og:availability"])) }
}

function fromMicrodata($: cheerio.CheerioAPI) {
  const el = $('[itemprop="price"]').first()
  if (!el.length) return null
  const price = parsePrice(el.attr("content") ?? el.text())
  if (price == null) return null
  const cur = $('[itemprop="priceCurrency"]').first()
  return { price, currency: cur.attr("content") ?? (cur.text().trim() || null), inStock: stock($('[itemprop="availability"]').first().attr("href") ?? $('[itemprop="availability"]').first().attr("content")) }
}

function fromSelector($: cheerio.CheerioAPI, selector: string) {
  let el
  try {
    el = $(selector).first()
  } catch {
    return "bad"
  }
  if (!el.length) return null
  const price = parsePrice(el.attr("content") ?? el.text())
  return price == null ? null : { price, currency: null, inStock: null }
}

/** Reads a price from a page's HTML (exported so it can be tried against saved pages). */
export function extractPrice(html: string, selector?: string | null): FetchResult {
  const $ = cheerio.load(html)
  if (selector?.trim()) {
    const r = fromSelector($, selector.trim())
    if (r === "bad") return { ok: false, error: "The CSS selector isn't valid." }
    if (r) return { ok: true, reading: { ...r, currency: "AUD", via: "selector" } }
  }
  const tries: [Reading["via"], ReturnType<typeof fromMeta>][] = [
    ["json-ld", fromJsonLd($)],
    ["meta", fromMeta($)],
    ["microdata", fromMicrodata($)],
  ]
  for (const [via, r] of tries) {
    if (r) return { ok: true, reading: { price: r.price, currency: (r.currency || "AUD").toUpperCase().slice(0, 3), inStock: r.inStock, via } }
  }
  if (selector?.trim()) return { ok: false, error: "The CSS selector didn't match a price on the page." }
  // bot-check pages (Cloudflare, Imperva, PerimeterX, Akamai); the title can be inside <noscript>, so the raw page is searched
  if (/<title>[^<]*(just a moment|attention required|access denied|captcha|are you a robot|pardon our interruption)|_Incapsula_Resource|px-captcha|cf-chl-|challenge-platform/i.test(html.slice(0, 200_000))) {
    return { ok: false, error: "Blocked by the site's bot check: it wants a real browser." }
  }
  return { ok: false, error: "No price found on the page. It may be loaded by JavaScript; try a CSS selector, or another shop." }
}

/** Fetches a product page and reads its price. Never throws. */
export async function fetchPrice(url: string, selector?: string | null): Promise<FetchResult> {
  try {
    const page = await fetchPage(url)
    if (!page.ok) return page
    return extractPrice(page.html, selector)
  } catch (e) {
    return { ok: false, error: `Couldn't read the page: ${e instanceof Error ? e.message : String(e)}` }
  }
}
