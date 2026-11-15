"use client"

import { useState } from "react"
import { DocMenu } from "./doc-menu"
import { FileDrawer, type EditableDoc } from "./file-drawer"
import type { TargetOption } from "./target-picker"

/**
 * The ⋯ menu for a document in a list (Documents page, a room): Edit Details opens the details drawer
 * (title, type, date, notes, and filing it somewhere else too); Delete asks first.
 */
export function DocActions({ doc, targets }: { doc: EditableDoc; targets?: TargetOption[] }) {
  const [editing, setEditing] = useState(false)
  return (
    <>
      <DocMenu doc={{ id: doc.id, title: doc.title, isLink: doc.isLink }} onEdit={() => setEditing(true)} />
      <FileDrawer doc={editing ? doc : null} onOpenChange={(o) => !o && setEditing(false)} targets={targets} title="Edit Details" />
    </>
  )
}
