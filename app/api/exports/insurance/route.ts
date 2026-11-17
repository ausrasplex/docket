import { requireHousehold } from "@/lib/dal"
import { insuranceReport, type InsuranceLine, type InsuranceReport } from "@/lib/insurance"
import { hasStored, readStored } from "@/lib/storage"
import { zipStream } from "@/lib/zip"

/**
 * The insurance pack as a ZIP: the inventory as a spreadsheet (CSV), each item's photo, and its receipts,
 * invoices, warranties and other photos, in folders by room. Anyone in the household can download it.
 */
export async function GET() {
  const c = await requireHousehold()
  const report = await insuranceReport(c.householdId, c.property.id)
  const today = new Date().toLocaleDateString("en-CA", { timeZone: process.env.TZ || undefined }) // 2026-11-17
  const root = safe(`Insurance - ${report.property || "Home"} - ${today}`)

  // files missing from storage are left out, and the spreadsheet only names what's really in the pack
  const keys = report.rooms.flatMap((g) => g.lines.flatMap((l) => [l.photo, ...l.proof].filter((d) => d != null).map((d) => d.storageKey)))
  const present = new Set((await Promise.all(keys.map(async (k) => ((await hasStored(k)) ? k : null)))).filter((k) => k != null))
  const plan = packPlan(report, root, present)
  async function* files() {
    yield { name: `${root}/Insurance report.csv`, data: Buffer.from("﻿" + csv(report, plan.names), "utf8") }
    for (const f of plan.files) {
      let data: Buffer | null = null
      try {
        data = (await readStored(f.key)).data
      } catch {
        data = null // gone since the check above: left out
      }
      yield { name: f.name, data }
    }
  }

  return new Response(zipStream(files()), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${root.replace(/[^\x20-\x7e]/g, "_")}.zip"; filename*=UTF-8''${encodeURIComponent(root)}.zip`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

/** A name that's safe as a file or folder on Windows, macOS and Linux. */
function safe(s: string) {
  return (
    s
      .replace(/[\\/:*?"<>|\x00-\x1f]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[. ]+$/, "")
      .slice(0, 80) || "Untitled"
  )
}

const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/heic": "heic", "image/heif": "heif", "image/avif": "avif" }
const ext = (d: { mimeType: string | null; storageKey: string }) => (d.mimeType && EXT[d.mimeType]) || d.storageKey.split(".").pop() || "bin"

/** Where each file goes in the pack, with names made unique. Also what the CSV says each line's files are called. */
function packPlan(report: InsuranceReport, root: string, present: Set<string>) {
  const used = new Set<string>()
  const unique = (path: string, extension: string) => {
    let name = `${path}.${extension}`
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${path} (${i}).${extension}`
    used.add(name.toLowerCase())
    return name
  }
  const files: { name: string; key: string }[] = []
  const names = new Map<string, string[]>() // line id → its files, relative to the pack's folder
  for (const g of report.rooms) {
    const room = safe(g.room)
    for (const l of g.lines) {
      const label = safe(l.partOf ? `${l.partOf} - ${l.name}` : l.name)
      const mine: string[] = []
      if (l.photo && present.has(l.photo.storageKey)) {
        const n = unique(`${root}/Photos/${room}/${label}`, ext(l.photo))
        files.push({ name: n, key: l.photo.storageKey })
        mine.push(n.slice(root.length + 1))
      }
      for (const d of l.proof) {
        if (!present.has(d.storageKey)) continue
        const folder = d.kind === "PHOTO" ? "Photos" : "Receipts and Warranties"
        const n = unique(`${root}/${folder}/${room}/${label} - ${safe(d.title)}`, ext(d))
        files.push({ name: n, key: d.storageKey })
        mine.push(n.slice(root.length + 1))
      }
      names.set(l.id, mine)
    }
  }
  return { files, names }
}

const cell = (v: string | number | null | undefined) => {
  if (v == null) return ""
  const s = String(v)
  // quote anything with a comma, quote or line break; and stop a spreadsheet reading text as a formula
  const t = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}
const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "")
const amount = (n: number | null) => (n == null ? "" : n.toFixed(2))

function csv(report: InsuranceReport, names: Map<string, string[]>) {
  const head = ["Room", "Item", "Part", "Category", "Brand", "Model", "Serial", "Cover", "Purchased", "Purchase price (AUD)", "Replacement value (AUD)", "Warranty to", "Files in this pack", "Notes"]
  const row = (room: string, l: InsuranceLine) => [
    room,
    l.partOf ?? l.name,
    l.partOf ? l.name : "",
    l.category,
    l.brand,
    l.model,
    l.serial,
    l.cover,
    day(l.purchasedAt),
    amount(l.purchasePrice),
    amount(l.replacementValue),
    day(l.warrantyExpiresAt),
    (names.get(l.id) ?? []).join("; "),
    l.notes,
  ]
  const lines = [head, ...report.rooms.flatMap((g) => g.lines.map((l) => row(g.room, l)))]
  lines.push([], ["Total", "", "", "", "", "", "", "", "", amount(report.totals.purchase), amount(report.totals.replacement)])
  return lines.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n"
}
