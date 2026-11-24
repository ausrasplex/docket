"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { normaliseUrl } from "@/lib/documents"
import { atLeast } from "@/lib/roles"
import { removeStored } from "@/lib/storage"
import { releaseCovers } from "@/lib/cover"
import { setMembers, shareFiled, sharedKind } from "@/lib/doc-sets"
import { docPlaces, PLACE_SELECT } from "@/lib/doc-place"
import { date } from "@/lib/format"
import { fileTargets } from "@/lib/targets"
import type { TargetOption } from "@/components/documents/target-picker"
import type { DocumentKind } from "@/generated/prisma/enums"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export type DocInput = { title: string; kind: DocumentKind; notes: string; documentDate: string | null }

function refresh() {
  revalidatePath("/capture")
  revalidatePath("/documents")
  revalidatePath("/rooms", "layout")
  revalidatePath("/")
}

async function ownDoc(householdId: string, id: string) {
  return db.document.findFirst({ where: { id, householdId } })
}

function parseDate(v: string | null) {
  if (!v) return null
  const d = new Date(`${v}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function updateDocument(id: string, input: DocInput): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  if (!(await ownDoc(c.householdId, id))) return { ok: false, error: "That document no longer exists." }
  const title = input.title.trim()
  if (!title) return { ok: false, error: "Give it a title." }
  await db.document.update({
    where: { id },
    data: { title, kind: input.kind, notes: input.notes.trim() || null, documentDate: parseDate(input.documentDate), updatedById: c.user.id },
  })
  // now a manual or warranty (say, no longer a photo): the other copies of the items it's on get it too
  const on = await db.documentLink.findMany({ where: { documentId: id, fixtureId: { not: null } }, select: { fixtureId: true } })
  await shareFiled(on.map((l) => l.fixtureId))
  refresh()
  revalidatePath("/fixtures", "layout")
  return { ok: true }
}

/** Where a document can be filed. Jobs and receipts join this as they're built. */
export type Target = { type: "space" | "fixture" | "finish" | "job" | "expense"; id: string }

/** The target's display name, or null when it isn't in this household. */
async function targetName(householdId: string, t: Target) {
  if (t.type === "space") return (await db.space.findFirst({ where: { id: t.id, householdId }, select: { name: true } }))?.name ?? null
  if (t.type === "job") return (await db.job.findFirst({ where: { id: t.id, householdId }, select: { title: true } }))?.title ?? null
  if (t.type === "expense") {
    const e = await db.expense.findFirst({ where: { id: t.id, householdId }, select: { description: true, vendor: true } })
    return e ? (e.description ?? e.vendor ?? "Cost") : null
  }
  if (t.type === "finish") {
    const f = await db.finish.findFirst({ where: { id: t.id, householdId }, select: { colourName: true, colourCode: true, product: true, space: { select: { name: true } } } })
    return f ? `${f.colourName ?? f.colourCode ?? f.product ?? "Finish"} (${f.space.name})` : null
  }
  const f = await db.fixture.findFirst({ where: { id: t.id, householdId }, select: { name: true, parent: { select: { name: true } } } })
  return f ? (f.parent ? `${f.parent.name} › ${f.name}` : f.name) : null
}

function linkData(t: Target) {
  return { [`${t.type}Id`]: t.id } as { spaceId?: string; fixtureId?: string; finishId?: string; jobId?: string; expenseId?: string }
}

/** Files a document to a room, an item or one of its parts. Filing it again just updates the label. */
export async function fileTo(id: string, target: Target, label: string | null): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const [doc, name] = await Promise.all([ownDoc(c.householdId, id), targetName(c.householdId, target)])
  if (!doc || !name) return { ok: false, error: "That document or place no longer exists." }
  const existing = await db.documentLink.findFirst({ where: { documentId: id, ...linkData(target) } })
  if (existing) await db.documentLink.update({ where: { id: existing.id }, data: { label: label?.trim() || null } })
  else await db.documentLink.create({ data: { documentId: id, ...linkData(target), label: label?.trim() || null } })
  if (target.type === "fixture") await shareFiled([target.id]) // and to the other copies of that item
  await logActivity(c, { action: "linked", entityType: "Document", entityId: id, summary: `${c.user.name} filed “${doc.title}” to ${name}` })
  refresh()
  revalidatePath("/fixtures", "layout")
  return { ok: true }
}

const FILE_TYPES = ["space", "fixture", "finish", "job"] as const
const sameTarget = (a: Target, b: Target) => a.type === b.type && a.id === b.id
/** A link's target, for the kinds of place the picker offers (costs are filed from their job, not here). */
function linkTarget(l: { spaceId: string | null; fixtureId: string | null; finishId: string | null; jobId: string | null }): Target | null {
  for (const t of FILE_TYPES) {
    const id = l[`${t}Id`]
    if (id) return { type: t, id }
  }
  return null
}

/** Everywhere this document could be filed, and where it's filed now: for ticking places in Edit Details. */
export async function filingOf(id: string): Promise<Result<{ options: TargetOption[]; filed: Target[] }>> {
  const c = await requireHousehold("MEMBER")
  if (!(await ownDoc(c.householdId, id))) return { ok: false, error: "That document no longer exists." }
  const [options, links] = await Promise.all([
    fileTargets(c.householdId, c.property.id),
    db.documentLink.findMany({ where: { documentId: id }, select: { spaceId: true, fixtureId: true, finishId: true, jobId: true } }),
  ])
  return { ok: true, options, filed: links.map(linkTarget).filter((t) => t != null) }
}

/**
 * Files a document to exactly these places: adds the newly ticked ones (with `label`) and takes it off the
 * unticked ones. Places the picker doesn't offer (an archived item, an older job, a cost) are left alone.
 */
export async function setFiling(id: string, wanted: Target[], label: string | null): Promise<Result<{ added: number; removed: number }>> {
  const c = await requireHousehold("MEMBER")
  const doc = await ownDoc(c.householdId, id)
  if (!doc) return { ok: false, error: "That document no longer exists." }
  const options = await fileTargets(c.householdId, c.property.id)
  const offered = (t: Target) => options.some((o) => sameTarget(o, t))
  if (!wanted.every(offered)) return { ok: false, error: "One of those places no longer exists. Reopen and try again." }

  const links = await db.documentLink.findMany({ where: { documentId: id }, select: { id: true, spaceId: true, fixtureId: true, finishId: true, jobId: true } })
  const current = links.map((l) => ({ link: l, t: linkTarget(l) }))
  const add = wanted.filter((t) => !current.some((x) => x.t && sameTarget(x.t, t)))
  const drop = current.filter((x) => x.t && offered(x.t) && !wanted.some((t) => sameTarget(t, x.t!)))
  const keepItems = new Set(wanted.filter((t) => t.type === "fixture").map((t) => t.id))

  await db.$transaction(async (tx) => {
    for (const { link, t } of drop) {
      // a shared document comes off every copy of the item (except copies still ticked)
      if (t!.type === "fixture" && sharedKind(doc.kind)) {
        const copies = (await setMembers(t!.id, tx)).filter((f) => !keepItems.has(f))
        await tx.documentLink.deleteMany({ where: { documentId: id, fixtureId: { in: copies } } })
      } else await tx.documentLink.deleteMany({ where: { id: link.id } })
    }
    if (add.length) await tx.documentLink.createMany({ data: add.map((t) => ({ documentId: id, ...linkData(t), label: label?.trim() || null })) })
    await shareFiled([...keepItems], tx)
  })

  if (add.length) {
    const names = add.map((t) => options.find((o) => sameTarget(o, t))!.name)
    await logActivity(c, { action: "linked", entityType: "Document", entityId: id, summary: `${c.user.name} filed “${doc.title}” to ${names.join(", ")}` })
  }
  refresh()
  revalidatePath("/fixtures", "layout")
  revalidatePath("/jobs", "layout")
  revalidatePath("/paint")
  return { ok: true, added: add.length, removed: drop.length }
}

export type ExistingDoc = { id: string; title: string; kind: DocumentKind; hasThumb: boolean; isLink: boolean; when: string; place: string | null }

/** The household's documents not yet filed to this place, newest first: for "Add Existing". */
export async function existingFor(target: Target): Promise<Result<{ docs: ExistingDoc[] }>> {
  const c = await requireHousehold("MEMBER")
  if (!(await targetName(c.householdId, target))) return { ok: false, error: "That place no longer exists." }
  const docs = await db.document.findMany({
    where: { householdId: c.householdId, archivedAt: null, links: { none: linkData(target) } },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: { id: true, title: true, kind: true, thumbnailKey: true, url: true, createdAt: true, documentDate: true, links: { take: 2, select: PLACE_SELECT } },
  })
  return {
    ok: true,
    docs: docs.map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      hasThumb: !!d.thumbnailKey,
      isLink: !!d.url,
      when: date(d.documentDate ?? d.createdAt),
      place: docPlaces(d.links) || null,
    })),
  }
}

/** Files several existing documents to one place (Add Existing on an item, part or job). */
export async function fileMany(ids: string[], target: Target): Promise<Result<{ filed: number }>> {
  const c = await requireHousehold("MEMBER")
  const name = await targetName(c.householdId, target)
  if (!name) return { ok: false, error: "That place no longer exists." }
  const docs = await db.document.findMany({ where: { id: { in: ids }, householdId: c.householdId }, select: { id: true, title: true } })
  if (!docs.length) return { ok: false, error: "Those documents no longer exist." }
  await db.documentLink.createMany({ data: docs.map((d) => ({ documentId: d.id, ...linkData(target) })), skipDuplicates: true })
  if (target.type === "fixture") await shareFiled([target.id])
  await logActivity(c, {
    action: "linked",
    entityType: "Document",
    entityId: docs[0].id,
    summary: docs.length === 1 ? `${c.user.name} filed “${docs[0].title}” to ${name}` : `${c.user.name} filed ${docs.length} documents to ${name}`,
  })
  refresh()
  revalidatePath("/fixtures", "layout")
  revalidatePath("/jobs", "layout")
  revalidatePath("/paint")
  return { ok: true, filed: docs.length }
}

export async function unlink(linkId: string): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const l = await db.documentLink.findFirst({ where: { id: linkId, document: { householdId: c.householdId } }, include: { document: { select: { kind: true } } } })
  if (!l) return { ok: false, error: "That link no longer exists." }
  // a shared document comes off every copy of the item; anything else just this one
  if (l.fixtureId && sharedKind(l.document.kind)) {
    await db.documentLink.deleteMany({ where: { documentId: l.documentId, fixtureId: { in: await setMembers(l.fixtureId) } } })
  } else await db.documentLink.delete({ where: { id: linkId } })
  refresh()
  revalidatePath("/fixtures", "layout")
  return { ok: true }
}

export async function setDocumentArchived(id: string, archived: boolean): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const doc = await ownDoc(c.householdId, id)
  if (!doc) return { ok: false, error: "That document no longer exists." }
  await db.document.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } })
  await logActivity(c, { action: archived ? "archived" : "restored", entityType: "Document", entityId: id, summary: `${c.user.name} ${archived ? "archived" : "restored"} “${doc.title}”` })
  refresh()
  return { ok: true }
}

/**
 * Deletes a document for good: the file (and its preview) is removed from storage and it disappears from
 * everywhere it was filed. Only the person who added it, or an Admin/Owner, can delete it. If it was a room's
 * photo, the room goes back to its icon.
 */
export async function deleteDocument(id: string): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const doc = await ownDoc(c.householdId, id)
  if (!doc) return { ok: false, error: "That document no longer exists." }
  if (doc.createdById !== c.user.id && !atLeast(c.role, "ADMIN")) {
    return { ok: false, error: "Only the person who added it, or an admin, can delete it." }
  }
  // rooms and items using it as their photo go back to their icons (and lose the cropped copy)
  const cropped = await releaseCovers(id)
  await db.document.delete({ where: { id } }) // its links go with it
  const files = [doc.storageKey, doc.thumbnailKey, ...cropped].filter((k): k is string => !!k)
  await Promise.all(files.map((k) => removeStored(k).catch(() => {})))
  await logActivity(c, { action: "deleted", entityType: "Document", entityId: id, summary: `${c.user.name} deleted “${doc.title}”` })
  refresh()
  revalidatePath("/fixtures", "layout")
  revalidatePath("/paint")
  revalidatePath("/jobs", "layout")
  return { ok: true }
}

/** Saves a web link as a document: an online manual, a support page, a driver download. */
export async function addWebLink(input: { url: string; title: string; kind: DocumentKind; target: Target | null; label?: string }): Promise<Result<{ id: string }>> {
  const c = await requireHousehold("MEMBER")
  const url = normaliseUrl(input.url)
  if (!url) return { ok: false, error: "Enter a web address, like daikin.com.au/support." }
  const title = input.title.trim() || new URL(url).hostname.replace(/^www\./, "")
  if (input.target && !(await targetName(c.householdId, input.target))) {
    return { ok: false, error: "That place no longer exists." }
  }
  const doc = await db.document.create({
    data: {
      householdId: c.householdId,
      kind: input.kind,
      title,
      url,
      createdById: c.user.id,
      ...(input.target ? { links: { create: { ...linkData(input.target), label: input.label?.trim() || null } } } : {}),
    },
  })
  if (input.target?.type === "fixture") await shareFiled([input.target.id])
  await logActivity(c, { action: "created", entityType: "Document", entityId: doc.id, summary: `${c.user.name} added the link “${title}”` })
  refresh()
  revalidatePath("/fixtures", "layout")
  return { ok: true, id: doc.id }
}
