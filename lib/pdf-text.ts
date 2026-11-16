import "server-only"
import { db } from "@/lib/db"
import { readStored } from "@/lib/storage"
import { pageText, type TextItem } from "@/lib/pdf-find"

/**
 * Reads the text out of stored PDFs into DocumentPage rows so they can be searched. Only the PDF's own text
 * layer for now: a scan has none and is marked EMPTY, which is what an OCR pass would later pick up (writing
 * its pages with source OCR).
 */

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs")
let lib: Promise<PdfJs> | null = null

function pdfjs() {
  lib ??= (async () => {
    const m = await import("pdfjs-dist/legacy/build/pdf.mjs")
    // loading the worker module here lets pdf.js run it in-process (Node has no web workers)
    // @ts-expect-error -- the worker has no type declarations; it's only imported for its side effect
    await import("pdfjs-dist/legacy/build/pdf.worker.mjs")
    return m
  })()
  return lib
}

/** Each page's text, collapsed for searching. */
export async function extractPages(data: Uint8Array) {
  const { getDocument, VerbosityLevel } = await pdfjs()
  const task = getDocument({ data, verbosity: VerbosityLevel.ERRORS })
  const doc = await task.promise
  try {
    const pages: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const tc = await page.getTextContent()
      pages.push(pageText(tc.items.filter((x): x is TextItem & typeof x => "str" in x)).text)
      page.cleanup()
    }
    return pages
  } finally {
    await task.destroy()
  }
}

/** Reads one document's text (if it's a stored PDF that hasn't been read yet). Never throws. */
export async function indexDocument(id: string) {
  const d = await db.document.findUnique({ where: { id }, select: { storageKey: true, mimeType: true, textStatus: true } })
  if (!d?.storageKey || d.mimeType !== "application/pdf" || d.textStatus) return
  try {
    const { data } = await readStored(d.storageKey)
    const pages = await extractPages(new Uint8Array(data))
    const hasText = pages.some((p) => p.length > 0)
    await db.$transaction([
      db.documentPage.deleteMany({ where: { documentId: id } }),
      db.documentPage.createMany({ data: pages.map((text, i) => ({ documentId: id, page: i + 1, text })).filter((p) => p.text), skipDuplicates: true }),
      db.document.update({ where: { id }, data: { textStatus: hasText ? "DONE" : "EMPTY", pageCount: pages.length } }),
    ])
  } catch (e) {
    console.error(`Couldn't read the text of document ${id}:`, e)
    await db.document.update({ where: { id }, data: { textStatus: "FAILED" } }).catch(() => {})
  }
}

/** Reads any of these that haven't been read yet (older uploads, before search existed), one at a time. */
export async function ensureIndexed(ids: string[]) {
  const todo = await db.document.findMany({
    where: { id: { in: ids }, textStatus: null, mimeType: "application/pdf", storageKey: { not: null } },
    select: { id: true },
  })
  for (const d of todo) await indexDocument(d.id)
}
