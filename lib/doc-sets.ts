import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"
import type { DocumentKind } from "@/generated/prisma/enums"

/**
 * Document sets: copies of the same product (Fixture.docSetId) share their documents. Filing a manual,
 * warranty or link to one files it to every copy; taking it off one takes it off all of them. Receipts,
 * invoices and photos belong to the one copy they were added to.
 */
export const PER_COPY_KINDS: DocumentKind[] = ["RECEIPT", "INVOICE", "PHOTO"]
export const sharedKind = (k: DocumentKind) => !PER_COPY_KINDS.includes(k)

type Db = Prisma.TransactionClient | typeof db

/** Gives every member of these sets the shared documents any member has. */
export async function syncSets(setIds: (string | null | undefined)[], tx: Db = db) {
  const ids = [...new Set(setIds.filter((x): x is string => !!x))]
  if (!ids.length) return
  const members = await tx.fixture.findMany({ where: { docSetId: { in: ids } }, select: { id: true, docSetId: true } })
  const links = await tx.documentLink.findMany({
    where: { fixtureId: { in: members.map((m) => m.id) }, document: { kind: { notIn: PER_COPY_KINDS } } },
    orderBy: { createdAt: "asc" },
    select: { documentId: true, fixtureId: true, label: true, sortOrder: true },
  })
  const setOf = new Map(members.map((m) => [m.id, m.docSetId!]))
  const have = new Set(links.map((l) => `${l.fixtureId}:${l.documentId}`))
  const docs = new Map<string, Map<string, (typeof links)[number]>>() // set → document → its first link
  for (const l of links) {
    const s = setOf.get(l.fixtureId!)!
    if (!docs.has(s)) docs.set(s, new Map())
    if (!docs.get(s)!.has(l.documentId)) docs.get(s)!.set(l.documentId, l)
  }
  const data = members.flatMap((m) =>
    [...(docs.get(m.docSetId!)?.values() ?? [])]
      .filter((l) => !have.has(`${m.id}:${l.documentId}`))
      .map((l) => ({ documentId: l.documentId, fixtureId: m.id, label: l.label, sortOrder: l.sortOrder })),
  )
  if (data.length) await tx.documentLink.createMany({ data, skipDuplicates: true })
}

/** The sets these items belong to, for syncing after documents are filed to them. */
export async function setsOf(fixtureIds: (string | null | undefined)[], tx: Db = db) {
  const ids = fixtureIds.filter((x): x is string => !!x)
  if (!ids.length) return []
  const rows = await tx.fixture.findMany({ where: { id: { in: ids }, docSetId: { not: null } }, select: { docSetId: true } })
  return rows.map((r) => r.docSetId)
}

/** Shares newly filed documents across the sets of the items they were filed to. */
export async function shareFiled(fixtureIds: (string | null | undefined)[], tx: Db = db) {
  await syncSets(await setsOf(fixtureIds, tx), tx)
}

/** Every item in the same set as this one (including it), for taking a shared document off all of them. */
export async function setMembers(fixtureId: string, tx: Db = db) {
  const f = await tx.fixture.findUnique({ where: { id: fixtureId }, select: { docSetId: true } })
  if (!f?.docSetId) return [fixtureId]
  return (await tx.fixture.findMany({ where: { docSetId: f.docSetId }, select: { id: true } })).map((x) => x.id)
}
