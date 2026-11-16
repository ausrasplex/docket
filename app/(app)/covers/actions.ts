"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { coverCopiesOf, saveCrop, setCover, type CoverKind } from "@/lib/cover"
import { validCrop } from "@/lib/crop"

type Result = { ok: true } | { ok: false; error: string }

const KINDS: CoverKind[] = ["space", "fixture"]

function refresh() {
  revalidatePath("/rooms", "layout")
  revalidatePath("/fixtures", "layout")
}

/**
 * Sets the photo shown in place of a room's or item's icon (any of the household's photos), or clears it.
 * `alsoCopies` does the same for the item's other copies.
 */
export async function setCoverPhoto(kind: CoverKind, id: string, documentId: string | null, alsoCopies = false): Promise<Result> {
  if (!KINDS.includes(kind)) return { ok: false, error: "Unknown kind." }
  const c = await requireHousehold("MEMBER")
  const error = await setCover(kind, c.householdId, id, documentId)
  if (error) return { ok: false, error }
  if (alsoCopies && kind === "fixture") for (const x of await coverCopiesOf(c.householdId, id)) await setCover(kind, c.householdId, x.id, documentId)
  refresh()
  return { ok: true }
}

/** Saves how the photo is cropped (a square, as fractions of the photo). */
export async function saveCoverCrop(kind: CoverKind, id: string, input: unknown): Promise<Result> {
  if (!KINDS.includes(kind)) return { ok: false, error: "Unknown kind." }
  const c = await requireHousehold("MEMBER")
  const crop = validCrop(input)
  if (!crop) return { ok: false, error: "That crop doesn't fit the photo." }
  const error = await saveCrop(kind, c.householdId, id, crop)
  if (error) return { ok: false, error }
  refresh()
  return { ok: true }
}

export type LibraryPhoto = { id: string; title: string; where: string }
export type PhotoLibrary = { sameProduct: LibraryPhoto[]; others: LibraryPhoto[]; copies: number }

const MAX_OTHERS = 90

/**
 * Photos from elsewhere in the household that could be this room's or item's photo: the photos other items and
 * rooms use or have filed to them. For an item, ones from the same product (its copies, or the same brand and
 * model, or the same name) come first, so a generic product shot can be reused across identical items.
 */
export async function listCoverPhotos(kind: CoverKind, id: string): Promise<PhotoLibrary> {
  const c = await requireHousehold("MEMBER")
  const h = c.householdId
  const me =
    kind === "fixture"
      ? await db.fixture.findFirst({ where: { id, householdId: h }, select: { name: true, brandId: true, model: true, docSetId: true } })
      : null

  // photos already filed here are offered separately
  const own = new Set(
    (await db.documentLink.findMany({ where: kind === "fixture" ? { fixtureId: id } : { spaceId: id }, select: { documentId: true } })).map((l) => l.documentId),
  )

  const docs = await db.document.findMany({
    where: {
      householdId: h,
      archivedAt: null,
      thumbnailKey: { not: null },
      // photos of things, not receipts: ones shown on a room or item, or filed to one
      OR: [
        { coverOfFixtures: { some: {} } },
        { coverOf: { some: {} } },
        { kind: "PHOTO", links: { some: { OR: [{ fixtureId: { not: null } }, { spaceId: { not: null } }] } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 400,
    select: {
      id: true,
      title: true,
      coverOfFixtures: { take: 3, select: { id: true, name: true, brandId: true, model: true, docSetId: true } },
      coverOf: { take: 2, select: { name: true } },
      links: {
        where: { OR: [{ fixtureId: { not: null } }, { spaceId: { not: null } }] },
        take: 3,
        select: { fixture: { select: { id: true, name: true, brandId: true, model: true, docSetId: true } }, space: { select: { name: true } } },
      },
    },
  })

  const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase()
  const same = (f: { id: string; name: string; brandId: string | null; model: string | null; docSetId: string | null }) =>
    !!me &&
    f.id !== id &&
    ((!!me.docSetId && f.docSetId === me.docSetId) ||
      (!!me.brandId && !!norm(me.model) && f.brandId === me.brandId && norm(f.model) === norm(me.model)) ||
      norm(f.name) === norm(me.name))

  const sameProduct: LibraryPhoto[] = []
  const others: LibraryPhoto[] = []
  for (const d of docs) {
    if (own.has(d.id)) continue
    const items = [...d.coverOfFixtures, ...d.links.map((l) => l.fixture).filter((f): f is NonNullable<typeof f> => !!f)]
    const names = [...new Set([...items.map((f) => f.name), ...d.coverOf.map((s) => s.name), ...d.links.map((l) => l.space?.name).filter((n): n is string => !!n)])]
    const photo = { id: d.id, title: d.title, where: names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : "") }
    if (items.some(same)) sameProduct.push(photo)
    else if (others.length < MAX_OTHERS) others.push(photo)
  }

  const copies = kind === "fixture" ? (await coverCopiesOf(h, id)).length : 0
  return { sameProduct, others, copies }
}
