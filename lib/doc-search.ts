import "server-only"
import { after } from "next/server"
import { db } from "@/lib/db"
import { ensureIndexed } from "@/lib/pdf-text"
import { findAll, lowerAligned, normQuery, snippet } from "@/lib/pdf-find"
import { docHref, viewHref } from "@/lib/documents"

export type DocHit = {
  key: string
  docId: string
  title: string
  /** what it's filed to, when searching across the household */
  place: string | null
  /** where the match is: a page of a PDF, or the document's title (null) */
  page: number | null
  /** the n-th match on that page (from 0), so the viewer can go to that one */
  hit: number
  before: string
  match: string
  after: string
  href: string
}

/** `unreadable`: PDFs with no text (scans); `pending`: PDFs still being read for the first time. */
export type DocSearch = { hits: DocHit[]; more: boolean; unreadable: number; pending: number }

export type SearchDoc = { id: string; title: string; url: string | null; mimeType: string | null; textStatus: string | null; place?: string | null }

const MAX_HITS = 150
// the first search reads PDFs uploaded before search existed; past this it answers with what's read so far
const READ_BUDGET_MS = 6000

export const NO_SEARCH: DocSearch = { hits: [], more: false, unreadable: 0, pending: 0 }

/**
 * Searches these documents (already limited to the household) for `q`: their titles, then the text of each
 * PDF page. `back` is where the viewer's back button returns to (this search).
 */
export async function searchDocs(docs: SearchDoc[], q: string, back: string): Promise<DocSearch> {
  const needle = normQuery(q)
  if (needle.length < 2) return NO_SEARCH

  const pdfs = docs.filter((d) => d.mimeType === "application/pdf" && !d.url)
  const left = await ensureIndexed(
    pdfs.filter((d) => !d.textStatus).map((d) => d.id),
    READ_BUDGET_MS,
  )
  if (left.length) after(() => ensureIndexed(left).then(() => {}))

  const hits: DocHit[] = []
  // titles first: "warranty" finds the warranty even when it's a link or a photo
  for (const d of docs) {
    const t = d.title.replace(/\s+/g, " ")
    const at = lowerAligned(t).indexOf(needle)
    if (at === -1) continue
    hits.push({
      key: `${d.id}:t`,
      docId: d.id,
      title: d.title,
      place: d.place ?? null,
      page: null,
      hit: 0,
      before: t.slice(0, at),
      match: t.slice(at, at + needle.length),
      after: t.slice(at + needle.length),
      href: d.mimeType === "application/pdf" && !d.url ? viewHref(d.id, { back }) : docHref(d),
    })
  }

  // then every match inside the PDFs, in the documents' order and page order
  const order = new Map(pdfs.map((d, i) => [d.id, i]))
  const byId = new Map(pdfs.map((d) => [d.id, d]))
  const pages = await db.documentPage.findMany({
    where: { documentId: { in: pdfs.map((d) => d.id) }, text: { contains: needle, mode: "insensitive" } },
    select: { documentId: true, page: true, text: true },
  })
  pages.sort((a, b) => order.get(a.documentId)! - order.get(b.documentId)! || a.page - b.page)
  let more = false
  outer: for (const p of pages) {
    const d = byId.get(p.documentId)!
    for (const [n, at] of findAll(lowerAligned(p.text), needle).entries()) {
      if (hits.length >= MAX_HITS) {
        more = true
        break outer
      }
      hits.push({
        key: `${p.documentId}:${p.page}:${n}`,
        docId: p.documentId,
        title: d.title,
        place: d.place ?? null,
        page: p.page,
        hit: n,
        ...snippet(p.text, at, needle.length),
        href: viewHref(p.documentId, { back, page: p.page, q, hit: n }),
      })
    }
  }

  const unreadable = await db.document.count({ where: { id: { in: pdfs.map((d) => d.id) }, textStatus: { in: ["EMPTY", "FAILED"] } } })
  return { hits, more, unreadable, pending: left.length }
}
