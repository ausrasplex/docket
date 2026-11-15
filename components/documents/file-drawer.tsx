"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, FieldLabel } from "@/components/drawer"
import { DOC_KINDS } from "@/lib/documents"
import type { DocumentKind } from "@/generated/prisma/enums"
import { fileToSpace, updateDocument } from "@/app/(app)/documents/actions"

export type FileTarget = { id: string; name: string }
export type EditableDoc = { id: string; title: string; kind: DocumentKind; notes: string | null; documentDate: string | null; isLink: boolean }

/**
 * Name a capture, say what it is, and file it to a room. Fixtures, jobs and receipts are added
 * to the "File To" list as those sections are built.
 */
export function FileDrawer({
  doc,
  rooms,
  onOpenChange,
}: {
  doc: EditableDoc | null
  rooms: FileTarget[]
  onOpenChange: (o: boolean) => void
}) {
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState<DocumentKind>("OTHER")
  const [notes, setNotes] = useState("")
  const [when, setWhen] = useState("")
  const [roomId, setRoomId] = useState<string | null>(null)
  const [label, setLabel] = useState("")
  const [pending, start] = useTransition()

  // load the chosen capture into the form (reset during render, not in an effect)
  const [shown, setShown] = useState<EditableDoc | null>(null)
  if (doc !== shown) {
    setShown(doc)
    if (doc) {
      setTitle(doc.title)
      setKind(doc.kind)
      setNotes(doc.notes ?? "")
      setWhen(doc.documentDate ?? "")
      setRoomId(null)
      setLabel("")
    }
  }

  const save = () =>
    start(async () => {
      if (!doc) return
      const r = await updateDocument(doc.id, { title, kind, notes, documentDate: when || null })
      if (!r.ok) return void toast.error(r.error)
      if (roomId) {
        const f = await fileToSpace(doc.id, roomId, label || null)
        if (!f.ok) return void toast.error(f.error)
        toast(`Filed to ${rooms.find((x) => x.id === roomId)?.name}`)
      } else toast("Saved")
      onOpenChange(false)
    })

  const kinds = doc?.isLink ? DOC_KINDS : DOC_KINDS.filter((k) => k.id !== "SUPPORT")
  return (
    <Drawer
      open={!!doc}
      onOpenChange={onOpenChange}
      title="File Capture"
      description="Say what it is, then choose where it belongs."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending || !title.trim()} onClick={save}>
            {roomId ? "Save and File" : "Save"}
          </Button>
        </>
      }
    >
      <FieldLabel label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </FieldLabel>

      <div role="radiogroup" aria-label="What is it?" className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted-foreground">What Is It?</span>
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={kind === k.id}
              onClick={() => setKind(k.id)}
              className={cn(
                "flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold",
                kind === k.id ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2"
              )}
            >
              <k.icon className="size-4" />
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <FieldLabel label="Date on It (optional)" hint="The date on the receipt, invoice or certificate.">
        <Input type="date" value={when} onChange={(e) => setWhen(e.target.value)} className="w-48" />
      </FieldLabel>

      <div role="radiogroup" aria-label="File to" className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted-foreground">File To</span>
        {rooms.length ? (
          <div className="flex flex-wrap gap-2">
            {rooms.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={roomId === r.id}
                onClick={() => setRoomId(roomId === r.id ? null : r.id)}
                className={cn(
                  "min-h-10 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold",
                  roomId === r.id ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2"
                )}
              >
                {r.name}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Add rooms first, then file captures to them.</p>
        )}
      </div>
      {roomId ? (
        <FieldLabel label="Label (optional)" hint="What it's for, when a room has several: “Oven manual”, “Tile receipt”.">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </FieldLabel>
      ) : null}

      <FieldLabel label="Notes (optional)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FieldLabel>
    </Drawer>
  )
}
