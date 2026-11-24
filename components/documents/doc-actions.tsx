"use client"

import { useState } from "react"
import { DocMenu } from "./doc-menu"
import { FileDrawer, type EditableDoc } from "./file-drawer"

/**
 * The ⋯ menu for a document in a list (Documents page, a room): Edit Details opens the details drawer
 * (title, type, date, notes, and everywhere it's filed); Delete asks first.
 */
export function DocActions({ doc }: { doc: EditableDoc }) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <DocMenu doc={{ id: doc.id, title: doc.title, isLink: doc.isLink }} onEdit={() => setEditing(true)} />
      <FileDrawer doc={editing ? doc : null} onOpenChange={(o) => !o && setEditing(false)} title="Edit Details" />
    </>
  )
}
