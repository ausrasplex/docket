import type { EditableDoc } from "./file-drawer"

// Shared by server pages and client components (so it must not live in a "use client" file).

/** The editable fields of a document, from a database row. */
export function editable(d: {
  id: string
  title: string
  kind: EditableDoc["kind"]
  notes: string | null
  documentDate: Date | null
  url: string | null
}): EditableDoc {
  return { id: d.id, title: d.title, kind: d.kind, notes: d.notes, documentDate: d.documentDate ? d.documentDate.toISOString().slice(0, 10) : null, isLink: !!d.url }
}
