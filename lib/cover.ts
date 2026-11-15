import "server-only"
import sharp from "sharp"
import { db } from "@/lib/db"
import { Prisma } from "@/generated/prisma/client"
import { cropPixels, type Crop } from "@/lib/crop"
import { readStored, removeStored, storeDerived } from "@/lib/storage"

// Photos that stand in for an icon: a room's photo and an item's (or part's) photo. Both work the same way:
// a photo document (also filed to the room or item), a square crop of it, and a 512px cropped copy.

export type CoverKind = "space" | "fixture"

const select = {
  id: true,
  coverId: true,
  coverCropKey: true,
  cover: { select: { storageKey: true, thumbnailKey: true, archivedAt: true } },
} as const

type Owned = {
  id: string
  coverId: string | null
  coverCropKey: string | null
  cover: { storageKey: string | null; thumbnailKey: string | null; archivedAt: Date | null } | null
}

async function find(kind: CoverKind, householdId: string, id: string): Promise<Owned | null> {
  const where = { id, householdId }
  return kind === "space" ? db.space.findFirst({ where, select }) : db.fixture.findFirst({ where, select })
}

async function update(kind: CoverKind, id: string, data: { coverId?: string | null; coverCrop: Crop | typeof Prisma.DbNull; coverCropKey: string | null }) {
  if (kind === "space") await db.space.update({ where: { id }, data })
  else await db.fixture.update({ where: { id }, data })
}

const NAMES: Record<CoverKind, string> = { space: "room", fixture: "item" }

/**
 * Sets (or clears) the photo. A different photo starts with a centred crop again. The photo is filed to the
 * room or item too, so it stays with it. Returns an error message, or null when done.
 */
export async function setCover(kind: CoverKind, householdId: string, id: string, documentId: string | null) {
  const rec = await find(kind, householdId, id)
  if (!rec) return `That ${NAMES[kind]} no longer exists.`
  if (documentId) {
    const doc = await db.document.findFirst({ where: { id: documentId, householdId, archivedAt: null, thumbnailKey: { not: null } } })
    if (!doc) return "Pick one of your photos."
    const target = kind === "space" ? { spaceId: id } : { fixtureId: id }
    if (!(await db.documentLink.findFirst({ where: { documentId, ...target } }))) await db.documentLink.create({ data: { documentId, ...target } })
  }
  if (documentId !== rec.coverId) {
    await update(kind, id, { coverId: documentId, coverCrop: Prisma.DbNull, coverCropKey: null })
    if (rec.coverCropKey) await removeStored(rec.coverCropKey)
  }
  return null
}

/** Saves the crop and makes a 512px copy cut from the full-size original (never changed). Error or null. */
export async function saveCrop(kind: CoverKind, householdId: string, id: string, crop: Crop) {
  const rec = await find(kind, householdId, id)
  if (!rec?.cover?.storageKey || rec.cover.archivedAt) return `This ${NAMES[kind]} has no photo to crop.`
  let out: Buffer
  try {
    const { data } = await readStored(rec.cover.storageKey)
    const rotated = await sharp(data).rotate().toBuffer({ resolveWithObject: true })
    const area = cropPixels(crop, rotated.info.width, rotated.info.height)
    out = await sharp(rotated.data).extract(area).resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toBuffer()
  } catch {
    return "That photo couldn't be cropped."
  }
  const key = await storeDerived(householdId, out, "webp")
  await update(kind, id, { coverCrop: crop, coverCropKey: key })
  if (rec.coverCropKey) await removeStored(rec.coverCropKey)
  return null
}

/** When a new photo is uploaded straight into the photo slot: point at it and drop the old crop. */
export async function adoptUploadedCover(kind: CoverKind, id: string, documentId: string) {
  const rec = kind === "space" ? await db.space.findUnique({ where: { id }, select }) : await db.fixture.findUnique({ where: { id }, select })
  await update(kind, id, { coverId: documentId, coverCrop: Prisma.DbNull, coverCropKey: null })
  if (rec?.coverCropKey) await removeStored(rec.coverCropKey)
}

/**
 * A copy of a cropped photo for another room or item (each keeps its own, since changing one's crop removes
 * its file). Null when there's nothing to copy or the file has gone missing.
 */
export async function copyCrop(householdId: string, key: string | null) {
  if (!key) return null
  try {
    return await storeDerived(householdId, (await readStored(key)).data, "webp")
  } catch {
    return null
  }
}

/**
 * Before a photo document is deleted: rooms and items using it go back to their icons. Returns the cropped
 * copies to remove from storage once the document is gone.
 */
export async function releaseCovers(documentId: string) {
  const [spaces, fixtures] = await Promise.all([
    db.space.findMany({ where: { coverId: documentId }, select: { coverCropKey: true } }),
    db.fixture.findMany({ where: { coverId: documentId }, select: { coverCropKey: true } }),
  ])
  const reset = { coverId: null, coverCrop: Prisma.DbNull, coverCropKey: null }
  await db.space.updateMany({ where: { coverId: documentId }, data: reset })
  await db.fixture.updateMany({ where: { coverId: documentId }, data: reset })
  return [...spaces, ...fixtures].map((r) => r.coverCropKey).filter((k): k is string => !!k)
}

/** Serves the photo (the cropped copy, or the preview shown centred) to members of its household. */
export async function coverResponse(kind: CoverKind, userId: string, activeHouseholdId: string | null | undefined, idOrSlug: string) {
  // by id (what the tiles use); rooms also by their readable address, which is only unique within a
  // household, so the current household wins if two of theirs share one. Items only have ids.
  const household = { memberships: { some: { userId } } }
  const s2 = { householdId: true, ...select }
  const found =
    kind === "space"
      ? await db.space.findMany({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], household }, select: s2, take: 10 })
      : await db.fixture.findMany({ where: { id: idOrSlug, household }, select: s2, take: 10 })
  const rec = found.find((x) => x.householdId === activeHouseholdId) ?? found[0]
  if (!rec?.cover || rec.cover.archivedAt) return new Response("Not found", { status: 404 })
  const key = rec.coverCropKey ?? rec.cover.thumbnailKey
  if (!key) return new Response("Not found", { status: 404 })
  let file
  try {
    file = await readStored(key)
  } catch {
    return new Response("The photo is missing from storage", { status: 404 })
  }
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(file.data.length),
      "Cache-Control": "private, max-age=31536000, immutable", // the ?v= in the address changes with each photo and crop
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
    },
  })
}
