"use server"

import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { ensureIndexed } from "@/lib/pdf-text"
import { findAll, lowerAligned, normQuery, snippet } from "@/lib/pdf-find"
import { docHref, viewHref } from "@/lib/documents"

export type DocHit = {
  key: string
  docId: string
  title: string
  /** where the match is: a page of a PDF, or the document's title */
  page: number | null
  /** the n-th match on that page (from 0), so the viewer can go to that one */
  hit: number
  before: string
  match: string
  after: string
  href: string
}

export type DocSearch = { hits: DocHit[]; more: boolean; unreadable: number }

const MAX_HITS = 150

/**
 * Searches inside this item's documents: the text of its PDFs (page by page) and every document's title.
 * PDFs uploaded before search existed are read the first time they're searched.
 */
export async function searchFixtureDocs(fixtureId: string, q: string): Promise<DocSearch> {
  const c = await requireHousehold()
  const needle = normQuery(q)
  if (needle.length < 2) return { hits: [], more: false, unreadable: 0 }

  const links = await db.documentLink.findMany({
    where: { fixtureId, fixture: { householdId: c.householdId }, document: { archivedAt: null } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { document: { select: { id: true, title: true, url: true, mimeType: true, textStatus: true } } },
  })
  const docs = links.map((l) => l.document)
  const pdfs = docs.filter((d) => d.mimeType === "application/pdf")
  await ensureIndexed(pdfs.filter((d) => !d.textStatus).map((d) => d.id))

  // back to this search on the item's page
  const back = `/fixtures/${fixtureId}?${new URLSearchParams({ docq: q.trim() })}#documents`
  const hits: DocHit[] = []

  // titles first: "warranty" finds the warranty even when it's a link or a photo
  for (const d of docs) {
    const at = d.title.toLowerCase().replace(/\s+/g, " ").indexOf(needle)
    if (at === -1) continue
    const t = d.title.replace(/\s+/g, " ")
    hits.push({
      key: `${d.id}:t`,
      docId: d.id,
      title: d.title,
      page: null,
      hit: 0,
      before: t.slice(0, at),
      match: t.slice(at, at + needle.length),
      after: t.slice(at + needle.length),
      href: d.mimeType === "application/pdf" ? viewHref(d.id, { back }) : docHref(d),
    })
  }

  // then every match inside the PDFs, in document and page order
  const order = new Map(pdfs.map((d, i) => [d.id, i]))
  const pages = await db.documentPage.findMany({
    where: { documentId: { in: pdfs.map((d) => d.id) }, text: { contains: needle, mode: "insensitive" } },
    orderBy: [{ documentId: "asc" }, { page: "asc" }],
    select: { documentId: true, page: true, text: true },
  })
  pages.sort((a, b) => order.get(a.documentId)! - order.get(b.documentId)! || a.page - b.page)
  const titleOf = new Map(pdfs.map((d) => [d.id, d.title]))
  let more = false
  for (const p of pages) {
    const found = findAll(lowerAligned(p.text), needle)
    for (const [n, at] of found.entries()) {
      if (hits.length >= MAX_HITS) {
        more = true
        break
      }
      hits.push({
        key: `${p.documentId}:${p.page}:${n}`,
        docId: p.documentId,
        title: titleOf.get(p.documentId)!,
        page: p.page,
        hit: n,
        ...snippet(p.text, at, needle.length),
        href: viewHref(p.documentId, { back, page: p.page, q, hit: n }),
      })
    }
    if (more) break
  }

  const unreadable = await db.document.count({ where: { id: { in: pdfs.map((d) => d.id) }, textStatus: { in: ["EMPTY", "FAILED"] } } })
  return { hits, more, unreadable }
}
