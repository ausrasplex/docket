"use client"

import { useState } from "react"
import { FileText, FolderInput, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FileDrawer, type EditableDoc } from "@/components/documents/file-drawer"
import type { TargetOption } from "@/components/documents/target-picker"
import { docHref, docKind, LINK_ICON, viewHref } from "@/lib/documents"
import type { DocumentKind } from "@/generated/prisma/enums"
import { ConfirmDelete } from "@/components/documents/doc-menu"

export type InboxItem = {
  id: string
  title: string
  kind: DocumentKind
  notes: string | null
  documentDate: string | null
  hasThumb: boolean
  isPdf: boolean
  isLink: boolean
  url: string | null
  when: string
  by: string | null
}

/** Captures not yet filed anywhere, as a grid of previews. Tap one to name and file it. */
export function Inbox({ items, targets, canEdit }: { items: InboxItem[]; targets: TargetOption[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<EditableDoc | null>(null)
  const [deleting, setDeleting] = useState<{ id: string; title: string; isLink: boolean } | null>(null)
  return (
    <>
      <div className="grid grid-cols-2 gap-3 desk:grid-cols-4">
        {items.map((d) => {
          const k = docKind(d.kind)
          const Icon = d.isLink ? LINK_ICON : d.isPdf ? FileText : k.icon
          return (
            <div key={d.id} className="flex flex-col overflow-hidden rounded-3xl bg-surface">
              <a
                href={d.isPdf && !d.isLink ? viewHref(d.id, { back: "/capture" }) : docHref(d)}
                {...(d.isPdf && !d.isLink ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                className="block aspect-[4/3] bg-surface2"
              >
                {d.hasThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file
                  <img src={`/api/files/${d.id}?v=thumb`} alt="" loading="lazy" className="size-full object-cover" />
                ) : (
                  <span className="flex size-full items-center justify-center text-muted-foreground">
                    <Icon className="size-10" />
                  </span>
                )}
              </a>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <span className="flex flex-col">
                  <b className="line-clamp-2 text-sm font-bold">{d.title}</b>
                  <span className="text-xs text-muted-foreground">
                    {k.label} · {d.when}
                    {d.by ? ` · ${d.by}` : ""}
                  </span>
                </span>
                {canEdit ? (
                  <div className="mt-auto flex gap-1.5">
                    <Button
                      size="xs"
                      className="flex-1"
                      onClick={() =>
                        setEditing({ id: d.id, title: d.title, kind: d.kind, notes: d.notes, documentDate: d.documentDate, isLink: d.isLink })
                      }
                    >
                      <FolderInput />
                      File
                    </Button>
                    <Button size="icon-xs" variant="ghost" aria-label={`Delete ${d.title}`} onClick={() => setDeleting({ id: d.id, title: d.title, isLink: d.isLink })}>
                      <Trash2 />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
      {deleting ? <ConfirmDelete open onOpenChange={(o) => !o && setDeleting(null)} doc={deleting} /> : null}
      <FileDrawer doc={editing} targets={targets} onOpenChange={(o) => !o && setEditing(null)} />
    </>
  )
}
