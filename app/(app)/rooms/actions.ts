"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import type { SpaceKind } from "@/generated/prisma/enums"
import { Prisma } from "@/generated/prisma/client"
import sharp from "sharp"
import { cropPixels, validCrop } from "@/lib/crop"
import { uniqueSlug } from "@/lib/slug"
import { readStored, removeStored, storeDerived } from "@/lib/storage"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const KINDS: SpaceKind[] = ["ROOM", "FLOOR", "EXTERIOR", "GARAGE", "WHOLE_HOUSE", "OTHER"]

export type SpaceInput = { name: string; kind: SpaceKind; parentId: string | null; notes: string }

async function checkParent(householdId: string, parentId: string | null, selfId?: string) {
  if (!parentId) return null
  if (parentId === selfId) return "A room can't be inside itself."
  const p = await db.space.findFirst({ where: { id: parentId, householdId, kind: "FLOOR", archivedAt: null } })
  return p ? null : "Pick a floor from the list."
}

export async function createSpace(input: SpaceInput): Promise<Result<{ id: string; slug: string }>> {
  const c = await requireHousehold("MEMBER")
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Give it a name." }
  if (!KINDS.includes(input.kind)) return { ok: false, error: "Pick a type." }
  const parentId = input.kind === "FLOOR" ? null : input.parentId
  const bad = await checkParent(c.householdId, parentId)
  if (bad) return { ok: false, error: bad }
  const last = await db.space.aggregate({ where: { propertyId: c.property.id }, _max: { sortOrder: true } })
  const s = await db.space.create({
    data: {
      householdId: c.householdId,
      propertyId: c.property.id,
      name,
      slug: await uniqueSlug("space", c.householdId, name),
      kind: input.kind,
      parentId,
      notes: input.notes.trim() || null,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  })
  await logActivity(c, { action: "created", entityType: "Space", entityId: s.id, summary: `${c.user.name} added ${name}` })
  revalidatePath("/rooms")
  return { ok: true, id: s.id, slug: s.slug }
}

/** Renaming a room changes its address too; the new slug comes back so the page can follow it. */
export async function updateSpace(id: string, input: SpaceInput): Promise<Result<{ slug: string }>> {
  const c = await requireHousehold("MEMBER")
  const s = await db.space.findFirst({ where: { id, householdId: c.householdId } })
  if (!s) return { ok: false, error: "That room no longer exists." }
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Give it a name." }
  if (!KINDS.includes(input.kind)) return { ok: false, error: "Pick a type." }
  const parentId = input.kind === "FLOOR" ? null : input.parentId
  const bad = await checkParent(c.householdId, parentId, id)
  if (bad) return { ok: false, error: bad }
  const slug = name === s.name ? s.slug : await uniqueSlug("space", c.householdId, name, id)
  await db.space.update({ where: { id }, data: { name, slug, kind: input.kind, parentId, notes: input.notes.trim() || null } })
  revalidatePath("/rooms", "layout")
  return { ok: true, slug }
}

/**
 * Sets the photo shown in place of a room's icon (one of the household's photos), or clears it.
 * The photo is also filed to the room so it stays with it.
 */
export async function setSpaceCover(id: string, documentId: string | null): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const s = await db.space.findFirst({ where: { id, householdId: c.householdId } })
  if (!s) return { ok: false, error: "That room no longer exists." }
  if (documentId) {
    const doc = await db.document.findFirst({ where: { id: documentId, householdId: c.householdId, archivedAt: null, thumbnailKey: { not: null } } })
    if (!doc) return { ok: false, error: "Pick one of your photos." }
    const filed = await db.documentLink.findFirst({ where: { documentId, spaceId: id } })
    if (!filed) await db.documentLink.create({ data: { documentId, spaceId: id } })
  }
  if (documentId !== s.coverId) {
    // a different photo starts with a centred crop again
    await db.space.update({ where: { id }, data: { coverId: documentId, coverCrop: Prisma.DbNull, coverCropKey: null } })
    if (s.coverCropKey) await removeStored(s.coverCropKey)
  }
  revalidatePath("/rooms", "layout")
  return { ok: true }
}

/**
 * Saves how the room's photo is cropped (a square, as fractions of the photo) and makes a 512px copy cut
 * from the full-size original, so tiles stay sharp. The original photo is never changed.
 */
export async function saveSpaceCrop(id: string, input: unknown): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const crop = validCrop(input)
  if (!crop) return { ok: false, error: "That crop doesn't fit the photo." }
  const s = await db.space.findFirst({ where: { id, householdId: c.householdId }, include: { cover: true } })
  if (!s?.cover?.storageKey) return { ok: false, error: "This room has no photo to crop." }
  let out: Buffer
  try {
    const { data } = await readStored(s.cover.storageKey)
    const rotated = await sharp(data).rotate().toBuffer({ resolveWithObject: true })
    const area = cropPixels(crop, rotated.info.width, rotated.info.height)
    out = await sharp(rotated.data).extract(area).resize(512, 512, { fit: "cover" }).webp({ quality: 82 }).toBuffer()
  } catch {
    return { ok: false, error: "That photo couldn't be cropped." }
  }
  const key = await storeDerived(c.householdId, out, "webp")
  await db.space.update({ where: { id }, data: { coverCrop: crop, coverCropKey: key } })
  if (s.coverCropKey) await removeStored(s.coverCropKey)
  revalidatePath("/rooms", "layout")
  return { ok: true }
}

/** Nothing is hard-deleted: archived rooms can be restored, and keep their history. */
export async function setSpaceArchived(id: string, archived: boolean): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const s = await db.space.findFirst({ where: { id, householdId: c.householdId } })
  if (!s) return { ok: false, error: "That room no longer exists." }
  await db.space.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } })
  await logActivity(c, { action: archived ? "archived" : "restored", entityType: "Space", entityId: id, summary: `${c.user.name} ${archived ? "archived" : "restored"} ${s.name}` })
  revalidatePath("/rooms", "layout")
  return { ok: true }
}
