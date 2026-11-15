"use client"

import { useState, useTransition } from "react"
import { Archive, FileText, FolderInput } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { FileDrawer, type EditableDoc, type FileTarget } from "@/components/documents/file-drawer"
import { docHref, docKind, LINK_ICON } from "@/lib/documents"
import type { DocumentKind } from "@/generated/prisma/enums"
import { setDocumentArchived } from "../documents/actions"

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
export function Inbox({ items, rooms, canEdit }: { items: InboxItem[]; rooms: FileTarget[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<EditableDoc | null>(null)
  const [, start] = useTransition()
  return (
    <>
      <div className="grid grid-cols-2 gap-3 desk:grid-cols-4">
        {items.map((d) => {
          const k = docKind(d.kind)
          const Icon = d.isLink ? LINK_ICON : d.isPdf ? FileText : k.icon
          return (
            <div key={d.id} className="flex flex-col overflow-hidden rounded-3xl bg-surface">
              <a href={docHref(d)} target="_blank" rel="noopener noreferrer" className="block aspect-[4/3] bg-surface2">
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
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Archive ${d.title}`}
                      onClick={() =>
                        start(async () => {
                          const r = await setDocumentArchived(d.id, true)
                          if (!r.ok) toast.error(r.error)
                          else toast("Archived")
                        })
                      }
                    >
                      <Archive />
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
      <FileDrawer doc={editing} rooms={rooms} onOpenChange={(o) => !o && setEditing(null)} />
    </>
  )
}
