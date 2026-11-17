import "server-only"
import { db } from "@/lib/db"
import { category } from "@/lib/fixtures"
import type { DocumentKind } from "@/generated/prisma/enums"

// The insurance export: every item at the property with what an insurer asks for after a loss (what it is,
// its serial, when it was bought, what it cost and would cost to replace) and the proof (photo, receipt).
// Shared by the printable report (/exports/insurance) and the download pack (/api/exports/insurance).

/** The documents that prove ownership and value, packed with the report. */
const PROOF: DocumentKind[] = ["RECEIPT", "INVOICE", "WARRANTY", "PHOTO"]

export type ProofDoc = { id: string; title: string; kind: DocumentKind; storageKey: string; mimeType: string | null; fileName: string | null }

export type InsuranceLine = {
  id: string
  name: string
  /** set on a part: the item it belongs to */
  partOf: string | null
  category: string
  brand: string | null
  model: string | null
  serial: string | null
  /** Contents (taken when you move) or Building (fixed to the house): insurers cover them under different policies */
  cover: "Contents" | "Building"
  purchasedAt: Date | null
  purchasePrice: number | null
  replacementValue: number | null
  warrantyExpiresAt: Date | null
  photo: ProofDoc | null
  /** the cropped photo's address, for the printed report */
  photoSrc: string | null
  proof: ProofDoc[]
  notes: string | null
}

/** What a line is worth for the report: its replacement value, or what was paid when that's all there is. */
export const lineValue = (l: InsuranceLine) => l.replacementValue ?? l.purchasePrice ?? 0

export type InsuranceGroup = { room: string; lines: InsuranceLine[] }

const num = (d: { toString(): string } | null) => (d == null ? null : Number(d.toString()))

const docSelect = {
  where: { document: { archivedAt: null, storageKey: { not: null }, kind: { in: PROOF } } },
  orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
  select: { document: { select: { id: true, title: true, kind: true, storageKey: true, mimeType: true, fileName: true } } },
}

const fixtureSelect = {
  id: true,
  name: true,
  category: true,
  model: true,
  serial: true,
  includedInSale: true,
  portable: true,
  purchasedAt: true,
  purchasePrice: true,
  replacementValue: true,
  warrantyExpiresAt: true,
  notes: true,
  coverCropKey: true,
  brand: { select: { name: true } },
  cover: { select: { id: true, title: true, kind: true, storageKey: true, mimeType: true, fileName: true, archivedAt: true } },
  links: docSelect,
} as const

export async function insuranceReport(householdId: string, propertyId: string) {
  const [property, items] = await Promise.all([
    db.property.findUnique({ where: { id: propertyId }, select: { name: true, address: true, household: { select: { name: true } } } }),
    db.fixture.findMany({
      where: { householdId, propertyId, archivedAt: null, parentId: null },
      orderBy: { name: "asc" },
      select: {
        ...fixtureSelect,
        space: { select: { name: true, sortOrder: true } },
        parts: { where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: fixtureSelect },
      },
    }),
  ])

  type Row = (typeof items)[number] | (typeof items)[number]["parts"][number]
  const line = (f: Row, partOf: string | null, parentCover: "Contents" | "Building"): InsuranceLine => {
    const photo = f.cover && !f.cover.archivedAt && f.cover.storageKey ? { ...f.cover, storageKey: f.cover.storageKey } : null
    const proof = f.links.map((l) => ({ ...l.document, storageKey: l.document.storageKey! })).filter((d) => d.id !== photo?.id)
    return {
      id: f.id,
      name: f.name,
      partOf,
      category: category(f.category).label,
      brand: f.brand?.name ?? null,
      model: f.model,
      serial: f.serial,
      cover: partOf ? parentCover : f.includedInSale && !f.portable ? "Building" : "Contents",
      purchasedAt: f.purchasedAt,
      purchasePrice: num(f.purchasePrice),
      replacementValue: num(f.replacementValue),
      warrantyExpiresAt: f.warrantyExpiresAt,
      photo,
      photoSrc: photo ? `/api/fixtures/${f.id}/photo?v=${(f.coverCropKey ?? photo.id).replace(/[^a-zA-Z0-9]/g, "").slice(-16)}` : null,
      proof,
      notes: f.notes,
    }
  }

  // grouped by room, in the rooms' own order; portable items and items without a room come last
  const groups = new Map<string, { order: number; lines: InsuranceLine[] }>()
  for (const f of items) {
    const room = f.portable ? "Portable" : (f.space?.name ?? "No Room")
    const order = f.portable ? 1e6 : (f.space?.sortOrder ?? 1e6 + 1)
    const g = groups.get(room) ?? { order, lines: [] }
    const top = line(f, null, "Contents")
    g.lines.push(top)
    // parts are listed when they're worth listing on their own (a serial, a value or proof of their own)
    for (const p of f.parts) {
      const l = line(p, f.name, top.cover)
      if (l.serial || l.purchasePrice != null || l.replacementValue != null || l.proof.length || l.photo) g.lines.push(l)
    }
    groups.set(room, g)
  }
  const rooms: InsuranceGroup[] = [...groups.entries()].sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0])).map(([room, g]) => ({ room, lines: g.lines }))

  const all = rooms.flatMap((r) => r.lines)
  const top = all.filter((l) => !l.partOf)
  const sum = (ls: InsuranceLine[], k: "purchasePrice" | "replacementValue") => ls.reduce((n, l) => n + (l[k] ?? 0), 0)
  const worth = (ls: InsuranceLine[]) => ls.reduce((n, l) => n + lineValue(l), 0)
  const totals = {
    items: top.length,
    purchase: sum(all, "purchasePrice"),
    replacement: sum(all, "replacementValue"),
    /** each line's replacement value, or what was paid where that's all there is */
    value: worth(all),
    contents: worth(all.filter((l) => l.cover === "Contents")),
    building: worth(all.filter((l) => l.cover === "Building")),
  }
  // what to fix before you need it (top-level items only: parts are optional detail)
  const gaps = {
    noValue: top.filter((l) => l.replacementValue == null && l.purchasePrice == null),
    noPhoto: top.filter((l) => !l.photo),
    noProof: top.filter((l) => !l.proof.some((d) => d.kind !== "PHOTO")),
  }

  return {
    household: property?.household.name ?? "",
    property: property?.name ?? "",
    address: property?.address ?? null,
    rooms,
    totals,
    gaps,
  }
}

export type InsuranceReport = Awaited<ReturnType<typeof insuranceReport>>
