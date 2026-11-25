"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, FieldLabel } from "@/components/drawer"
import type { DocumentKind } from "@/generated/prisma/enums"
import { filingOf, setFiling, updateDocument, type Target } from "@/app/(app)/documents/actions"
import { KindSelect } from "./kind-select"
import { TargetPicker, type TargetOption } from "./target-picker"
export type EditableDoc = { id: string; title: string; kind: DocumentKind; notes: string | null; documentDate: string | null; isLink: boolean }

const same = (a: Target, b: Target) => a.type === b.type && a.id === b.id

/**
 * Name a document, say what it is, and tick everywhere it belongs: items, their parts, rooms, jobs, finishes.
 * Where it's filed already comes ticked; saving files it to the newly ticked places and takes it off the unticked.
 */
export function FileDrawer({
  doc,
  onOpenChange,
  title: drawerTitle = "File Capture",
}: {
  doc: EditableDoc | null
  title?: string
  onOpenChange: (o: boolean) => void
}) {
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState<DocumentKind>("OTHER")
  const [notes, setNotes] = useState("")
  const [when, setWhen] = useState("")
  const [label, setLabel] = useState("")
  /** where it can go and where it is (null while loading) */
  const [filing, setFilingState] = useState<{ id: string; options: TargetOption[]; filed: Target[] } | null>(null)
  const [picked, setPicked] = useState<Target[]>([])
  const [pending, start] = useTransition()

  // load the chosen document into the form (reset during render, not in an effect)
  const [shown, setShown] = useState<EditableDoc | null>(null)
  if (doc !== shown) {
    setShown(doc)
    if (doc) {
      setTitle(doc.title)
      setKind(doc.kind)
      setNotes(doc.notes ?? "")
      setWhen(doc.documentDate ?? "")
      setLabel("")
      setFilingState(null)
      setPicked([])
    }
  }

  const id = doc?.id
  useEffect(() => {
    if (!id) return
    let live = true
    filingOf(id).then((r) => {
      if (!live) return
      if (!r.ok) return void toast.error(r.error)
      setFilingState({ id, options: r.options, filed: r.filed })
      setPicked(r.filed)
    })
    return () => {
      live = false
    }
  }, [id])

  const loaded = filing && filing.id === id ? filing : null
  const ready = !!loaded
  const added = ready ? picked.filter((t) => !loaded.filed.some((f) => same(f, t))) : []
  const removed = ready ? loaded.filed.filter((f) => !picked.some((t) => same(f, t)) && loaded.options.some((o) => same(o, f))) : []

  const save = () =>
    start(async () => {
      if (!doc || !loaded) return
      const r = await updateDocument(doc.id, { title, kind, notes, documentDate: when || null })
      if (!r.ok) return void toast.error(r.error)
      if (added.length || removed.length) {
        const f = await setFiling(doc.id, picked, label || null)
        if (!f.ok) return void toast.error(f.error)
        const name = (t: Target) => loaded.options.find((o) => same(o, t))?.name
        toast(
          [
            f.added ? (f.added === 1 ? `Filed to ${name(added[0])}` : `Filed to ${f.added} more places`) : null,
            f.removed ? (f.removed === 1 ? `taken off ${name(removed[0])}` : `taken off ${f.removed} places`) : null,
          ]
            .filter(Boolean)
            .join(", ")
            .replace(/^t/, "T"),
        )
      } else toast("Saved")
      onOpenChange(false)
    })

  return (
    <Drawer
      open={!!doc}
      onOpenChange={onOpenChange}
      title={drawerTitle}
      description="Say what it is, then tick everywhere it belongs. One manual or receipt can cover several items."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending || !ready || !title.trim()} onClick={save}>
            {added.length ? "Save and File" : "Save"}
          </Button>
        </>
      }
    >
      <FieldLabel label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </FieldLabel>

      <KindSelect value={kind} onChange={setKind} only={doc?.isLink ? undefined : (k) => k !== "SUPPORT"} />

      <FieldLabel label="Date on It (optional)" hint="The date on the receipt, invoice or certificate.">
        <Input type="date" value={when} onChange={(e) => setWhen(e.target.value)} className="w-48" />
      </FieldLabel>

      {loaded ? (
        <TargetPicker options={loaded.options} value={picked} onChange={setPicked} multiple pinned={loaded.filed} label="Filed To" />
      ) : (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-muted-foreground">Filed To</span>
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      )}
      {added.length ? (
        <FieldLabel label="Label (optional)" hint="For the newly ticked places, when there are several: “Installation manual”, “Remote”.">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </FieldLabel>
      ) : null}

      <FieldLabel label="Notes (optional)">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FieldLabel>
    </Drawer>
  )
}
