"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { Prisma } from "@/generated/prisma/client"
import { copyCrop } from "@/lib/cover"
import { removeStored } from "@/lib/storage"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

/** One copy: which room it's in (null for no room) and its serial numbers (the item's, and each part's by id). */
export type DuplicateCopy = { spaceId: string | null; serial: string; partSerials: Record<string, string> }

const MAX_COPIES = 20

const source = {
  links: { select: { documentId: true, label: true, sortOrder: true } },
  tags: { select: { id: true } },
  servicePlans: { where: { archivedAt: null }, select: { name: true, everyMonths: true, everyKm: true, notes: true } },
} as const

/**
 * Copies an item (and its parts) into other rooms: the same details, photo, manuals and links (shared, not
 * re-uploaded) and service routines. The copies join the original's document set, so manuals and warranties
 * added to any of them later reach them all (lib/doc-sets.ts). Each copy gets its own serial numbers; rego,
 * VIN, odometer and the service history stay with the original.
 */
export async function duplicateFixture(id: string, copies: DuplicateCopy[]): Promise<Result<{ ids: string[] }>> {
  const c = await requireHousehold("MEMBER")
  if (!copies.length) return { ok: false, error: "Pick at least one room." }
  if (copies.length > MAX_COPIES) return { ok: false, error: `Up to ${MAX_COPIES} copies at a time.` }

  const f = await db.fixture.findFirst({
    where: { id, householdId: c.householdId },
    include: { ...source, parts: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, include: source } },
  })
  if (!f) return { ok: false, error: "That item no longer exists." }
  if (f.parentId) return { ok: false, error: "Duplicate the item this part belongs to." }

  const roomIds = [...new Set(copies.map((x) => x.spaceId).filter((x): x is string => !!x))]
  const rooms = await db.space.findMany({ where: { id: { in: roomIds }, householdId: c.householdId, archivedAt: null }, select: { id: true, name: true } })
  if (rooms.length !== roomIds.length) return { ok: false, error: "One of those rooms no longer exists." }
  const roomName = new Map(rooms.map((r) => [r.id, r.name]))

  // each copy keeps its own cropped photo file, made before the database writes
  const made: string[] = []
  const crop = async (key: string | null) => {
    const k = await copyCrop(c.householdId, key)
    if (k) made.push(k)
    return k
  }
  const plan: { copy: DuplicateCopy; cropKey: string | null; parts: { p: (typeof f.parts)[number]; cropKey: string | null; serial: string | null }[] }[] = []
  for (const copy of copies) {
    const cropKey = await crop(f.coverCropKey)
    const parts = []
    for (const p of f.parts) parts.push({ p, cropKey: await crop(p.coverCropKey), serial: copy.partSerials?.[p.id]?.trim() || null })
    plan.push({ copy, cropKey, parts })
  }

  type Src = typeof f | (typeof f.parts)[number]
  const fields = (x: Src, cropKey: string | null) => ({
    docSetId: x.docSetId ?? x.id,
    householdId: x.householdId,
    propertyId: x.propertyId,
    sortOrder: x.sortOrder,
    name: x.name,
    category: x.category,
    brandId: x.brandId,
    model: x.model,
    productUrl: x.productUrl,
    store: x.store,
    colour: x.colour,
    size: x.size,
    coverId: x.coverId,
    // without its cropped file the photo shows centred, so the crop goes too
    coverCrop: cropKey && x.coverCrop ? (x.coverCrop as Prisma.InputJsonValue) : Prisma.DbNull,
    coverCropKey: cropKey,
    purchasedAt: x.purchasedAt,
    installedAt: x.installedAt,
    warrantyExpiresAt: x.warrantyExpiresAt,
    installerId: x.installerId,
    purchasePrice: x.purchasePrice,
    replacementValue: x.replacementValue,
    replacementFromPrices: false, // the copy has no shops of its own
    includedInSale: x.includedInSale,
    serviceEnabled: x.serviceEnabled,
    notes: x.notes,
    createdById: c.user.id,
    links: { create: x.links.map((l) => ({ documentId: l.documentId, label: l.label, sortOrder: l.sortOrder })) },
    tags: { connect: x.tags },
    servicePlans: { create: x.servicePlans.map((s) => ({ ...s, householdId: x.householdId })) },
  })

  let ids: string[]
  try {
    ids = await db.$transaction(async (tx) => {
      // the original (and each part) starts a document set if it isn't in one yet
      for (const x of [f, ...f.parts]) if (!x.docSetId) await tx.fixture.update({ where: { id: x.id }, data: { docSetId: x.id } })
      const out: string[] = []
      for (const { copy, cropKey, parts } of plan) {
        const item = await tx.fixture.create({ data: { ...fields(f, cropKey), spaceId: copy.spaceId, serial: copy.serial.trim() || null } })
        for (const { p, cropKey: pk, serial } of parts) {
          // a part in the item's own room follows the copy; one kept elsewhere (an outdoor unit) stays there
          const spaceId = p.spaceId && p.spaceId !== f.spaceId ? p.spaceId : null
          await tx.fixture.create({ data: { ...fields(p, pk), parentId: item.id, spaceId, serial } })
        }
        out.push(item.id)
      }
      return out
    })
  } catch (e) {
    await Promise.all(made.map((k) => removeStored(k)))
    throw e
  }

  const where = copies.map((x) => (x.spaceId ? roomName.get(x.spaceId)! : "no room"))
  const list = where.length <= 3 ? where.join(", ").replace(/, ([^,]*)$/, " and $1") : `${where.length} rooms`
  await logActivity(c, { action: "created", entityType: "Fixture", entityId: ids[0], summary: `${c.user.name} copied ${f.name} to ${list}` })
  revalidatePath("/fixtures", "layout")
  revalidatePath("/rooms", "layout")
  revalidatePath("/")
  return { ok: true, ids }
}
