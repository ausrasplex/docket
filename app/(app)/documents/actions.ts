"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { normaliseUrl } from "@/lib/documents"
import { atLeast } from "@/lib/roles"
import { removeStored } from "@/lib/storage"
import { releaseCovers } from "@/lib/cover"
import { setMembers, shareFiled, sharedKind } from "@/lib/doc-sets"
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
