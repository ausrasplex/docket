"use server"

import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { DOC_KINDS } from "@/lib/documents"
import { NO_SEARCH, searchDocs, type DocSearch } from "@/lib/doc-search"
import { docPlaces, PLACE_SELECT } from "@/lib/doc-place"
import { normQuery } from "@/lib/pdf-find"
import type { DocumentKind } from "@/generated/prisma/enums"

const DOC_SELECT = { id: true, title: true, url: true, mimeType: true, textStatus: true } as const

/** Searches inside one item's documents (its PDFs' text and every document's title). */
export async function searchFixtureDocs(fixtureId: string, q: string): Promise<DocSearch> {
  const c = await requireHousehold()
  if (normQuery(q).length < 2) return NO_SEARCH
  const links = await db.documentLink.findMany({
    where: { fixtureId, fixture: { householdId: c.householdId }, document: { archivedAt: null } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { document: { select: DOC_SELECT } },
  })
  // back to this search on the item's page
  const back = `/fixtures/${fixtureId}?${new URLSearchParams({ docq: q.trim() })}#documents`
  return searchDocs(
    links.map((l) => l.document),
    q,
    back,
  )
}

/** Searches every document in the household, or only one kind (the filter chosen on Documents). */
export async function searchAllDocs(q: string, kind: string | null): Promise<DocSearch> {
  const c = await requireHousehold()
  if (normQuery(q).length < 2) return NO_SEARCH
  const k = DOC_KINDS.find((x) => x.id === kind)?.id as DocumentKind | undefined
  const docs = await db.document.findMany({
    where: { householdId: c.householdId, archivedAt: null, ...(k ? { kind: k } : {}) },
    orderBy: { createdAt: "desc" },
    select: { ...DOC_SELECT, links: { take: 2, select: PLACE_SELECT } },
  })
  const sp = new URLSearchParams({ q: q.trim() })
  if (k) sp.set("kind", k)
  return searchDocs(
    docs.map(({ links, ...d }) => ({ ...d, place: docPlaces(links) })),
    q,
    `/documents?${sp}`,
  )
}
