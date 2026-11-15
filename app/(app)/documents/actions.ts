"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { normaliseUrl } from "@/lib/documents"
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
  refresh()
  return { ok: true }
}

/** Files a document to a room (fixtures, jobs and receipts join this list as they're built). */
export async function fileToSpace(id: string, spaceId: string, label: string | null): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const [doc, space] = await Promise.all([
    ownDoc(c.householdId, id),
    db.space.findFirst({ where: { id: spaceId, householdId: c.householdId } }),
  ])
  if (!doc || !space) return { ok: false, error: "That document or room no longer exists." }
  await db.documentLink.upsert({
    where: { documentId_spaceId: { documentId: id, spaceId } },
    create: { documentId: id, spaceId, label: label?.trim() || null },
    update: { label: label?.trim() || null },
  })
  await logActivity(c, { action: "linked", entityType: "Document", entityId: id, summary: `${c.user.name} filed “${doc.title}” to ${space.name}` })
  refresh()
  return { ok: true }
}

export async function unlink(linkId: string): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const l = await db.documentLink.findFirst({ where: { id: linkId, document: { householdId: c.householdId } } })
  if (!l) return { ok: false, error: "That link no longer exists." }
  await db.documentLink.delete({ where: { id: linkId } })
  refresh()
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

/** Saves a web link as a document: an online manual, a support page, a driver download. */
export async function addWebLink(input: { url: string; title: string; kind: DocumentKind; spaceId: string | null }): Promise<Result<{ id: string }>> {
  const c = await requireHousehold("MEMBER")
  const url = normaliseUrl(input.url)
  if (!url) return { ok: false, error: "Enter a web address, like daikin.com.au/support." }
  const title = input.title.trim() || new URL(url).hostname.replace(/^www\./, "")
  if (input.spaceId && !(await db.space.findFirst({ where: { id: input.spaceId, householdId: c.householdId } }))) {
    return { ok: false, error: "That room no longer exists." }
  }
  const doc = await db.document.create({
    data: {
      householdId: c.householdId,
      kind: input.kind,
      title,
      url,
      createdById: c.user.id,
      ...(input.spaceId ? { links: { create: { spaceId: input.spaceId } } } : {}),
    },
  })
  await logActivity(c, { action: "created", entityType: "Document", entityId: doc.id, summary: `${c.user.name} added the link “${title}”` })
  refresh()
  return { ok: true, id: doc.id }
}
