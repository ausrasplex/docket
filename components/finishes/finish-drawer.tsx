"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Camera, FileUp, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, FieldLabel } from "@/components/drawer"
import { BrandField, Section, StoreField } from "@/components/form-bits"
import { SelectItem, SelectSeparator } from "@/components/ui/select"
import { Dropdown, MultiDropdown } from "@/components/dropdown"
import { DocumentRow } from "@/components/documents/document-row"
import { DocMenu } from "@/components/documents/doc-menu"
import { FINISH_KINDS, SHEENS, SURFACES, normaliseHex } from "@/lib/finishes"
import { createFinishes, updateFinish, type FinishInput } from "@/app/(app)/paint/actions"
import type { FinishRow } from "./finish-types"

// Radix Select can't hold an empty value
const NO_SHEEN = "__none"

/**
 * Add a paint colour or finish to one or more rooms, or edit one. When editing, photos of the tin
 * label or colour card can be added straight to it.
 */
export function FinishDrawer({
  open,
  onOpenChange,
  initial,
  editing,
  presetRooms = [],
  rooms,
  brands,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: FinishInput
  editing?: FinishRow | null
  presetRooms?: string[]
  rooms: { id: string; name: string }[]
  brands: string[]
}) {
  const [v, setV] = useState(initial)
  const [picked, setPicked] = useState<string[]>(presetRooms)
  const [pending, start] = useTransition()
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setV(initial)
      setPicked(editing ? [editing.spaceId] : presetRooms)
    }
  }
  const set = <K extends keyof FinishInput>(k: K, val: FinishInput[K]) => setV((p) => ({ ...p, [k]: val }))
  const swatch = normaliseHex(v.hex)
  const isPaint = v.kind === "PAINT" || v.kind === "STAIN"

  const save = () =>
    start(async () => {
      const r = editing ? await updateFinish(editing.id, v, picked[0]) : await createFinishes(v, picked)
      if (!r.ok) return void toast.error(r.error)
      toast(editing ? "Saved" : picked.length > 1 ? `Added to ${picked.length} rooms` : "Added")
      onOpenChange(false)
    })

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit Paint or Finish" : "Add Paint or Finish"}
      description={editing ? `${editing.room}` : "Pick every room with this colour to add it to all of them at once."}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending || !picked.length} onClick={save}>
            {editing ? "Save" : picked.length > 1 ? `Add to ${picked.length} Rooms` : "Add"}
          </Button>
        </>
      }
    >
      {editing ? (
        <Dropdown label="Room" value={picked[0] ?? ""} onChange={(id) => setPicked([id])}>
          {rooms.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </Dropdown>
      ) : (
        <MultiDropdown label="Rooms" options={rooms} value={picked} onChange={setPicked} placeholder="Pick one or more rooms" />
      )}

      <Dropdown label="Surface" value={v.surface} onChange={(s) => set("surface", s as FinishInput["surface"])}>
        {SURFACES.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.label}
          </SelectItem>
        ))}
      </Dropdown>
      <FieldLabel label="Which Part (optional)">
        <Input value={v.surfaceNote} onChange={(e) => set("surfaceNote", e.target.value)} placeholder="Wall behind the bed" />
      </FieldLabel>

      <Dropdown label="Type" value={v.kind} onChange={(k) => set("kind", k as FinishInput["kind"])}>
        {FINISH_KINDS.map((k) => (
          <SelectItem key={k.id} value={k.id}>
            {k.label}
          </SelectItem>
        ))}
      </Dropdown>

      <Section title="Colour" />
      <div className="flex items-center gap-3 rounded-2xl bg-surface2 p-3">
        <span
          aria-hidden="true"
          className="size-16 flex-none rounded-2xl border border-line"
          style={{ background: swatch ?? "repeating-linear-gradient(45deg, var(--surface), var(--surface) 6px, var(--line) 6px, var(--line) 12px)" }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-bold text-muted-foreground">Swatch (approximate)</span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="Pick swatch colour"
              value={swatch ?? "#ffffff"}
              onChange={(e) => set("hex", e.target.value)}
              className="h-11 w-14 flex-none cursor-pointer rounded-md border border-line bg-surface"
            />
            <Input aria-label="Swatch hex code" value={v.hex} onChange={(e) => set("hex", e.target.value)} placeholder="#f2efe6" className="h-11 font-mono" />
          </div>
        </div>
      </div>
      <BrandField value={v.brand} onChange={(b) => set("brand", b)} brands={brands} placeholder="Dulux" />
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Colour Name">
          <Input value={v.colourName} onChange={(e) => set("colourName", e.target.value)} placeholder="Natural White" />
        </FieldLabel>
        <FieldLabel label="Colour Code">
          <Input value={v.colourCode} onChange={(e) => set("colourCode", e.target.value)} placeholder="SW1F1" />
        </FieldLabel>
      </div>
      <FieldLabel label="Product">
        <Input value={v.product} onChange={(e) => set("product", e.target.value)} placeholder={isPaint ? "Wash&Wear Low Sheen" : "Product or range"} />
      </FieldLabel>
      {isPaint ? (
        <Dropdown label="Sheen" value={v.sheen || NO_SHEEN} onChange={(s) => set("sheen", s === NO_SHEEN ? "" : s)}>
          <SelectItem value={NO_SHEEN}>Not sure</SelectItem>
          <SelectSeparator />
          {[...SHEENS, ...(v.sheen && !(SHEENS as readonly string[]).includes(v.sheen) ? [v.sheen] : [])].map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </Dropdown>
      ) : null}
      <FieldLabel label="Size">
        <Input value={v.size} onChange={(e) => set("size", e.target.value)} placeholder={isPaint ? "4 L" : "1200 x 600mm"} className="w-48" />
      </FieldLabel>
      <StoreField value={v.store} onChange={(s) => set("store", s)} placeholder={isPaint ? "Bunnings" : "National Tiles"} />
      <FieldLabel label="Colour's Web Page (optional)">
        <Input value={v.productUrl} onChange={(e) => set("productUrl", e.target.value)} placeholder="dulux.com.au/colour/…" inputMode="url" />
      </FieldLabel>

      <Section title="Touch-Ups" />
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Applied">
          <Input type="date" value={v.appliedAt ?? ""} onChange={(e) => set("appliedAt", e.target.value || null)} />
        </FieldLabel>
        <FieldLabel label="Leftover">
          <Input value={v.leftoverLocation} onChange={(e) => set("leftoverLocation", e.target.value)} placeholder="Garage shelf, 2 L" />
        </FieldLabel>
      </div>
      <FieldLabel label="Notes (optional)">
        <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Tint formula, coats, who painted it" />
      </FieldLabel>

      {editing ? <FinishPhotos finish={editing} /> : null}
    </Drawer>
  )
}

/** Photos of the tin label or colour card, filed to this finish. */
function FinishPhotos({ finish }: { finish: FinishRow }) {
  const router = useRouter()
  const files = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function upload(list: FileList | null) {
    if (!list?.length) return
    setBusy(true)
    const fd = new FormData()
    ;[...list].forEach((f) => fd.append("files", f))
    fd.append("finishId", finish.id)
    try {
      const r = await fetch("/api/documents", { method: "POST", body: fd })
      const j = (await r.json().catch(() => ({}))) as { created?: string[]; errors?: string[]; error?: string }
      if (j.error) toast.error(j.error)
      j.errors?.forEach((e) => toast.error(e))
      if (j.created?.length) toast("Photo added")
      router.refresh()
    } catch {
      toast.error("Docket couldn't reach the server. Try again.")
    } finally {
      setBusy(false)
      if (files.current) files.current.value = ""
      if (camera.current) camera.current.value = ""
    }
  }

  return (
    <>
      <Section title="Photos and Documents" hint="The tin label, colour card or receipt." />
      {finish.docs.length ? (
        <div className="flex flex-col">
          {finish.docs.map((d) => (
            <DocumentRow key={d.linkId} doc={d.doc} label={d.label} trailing={<DocMenu doc={{ id: d.doc.id, title: d.doc.title, isLink: !!d.doc.url }} onDeleted={() => router.refresh()} />} />
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => camera.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <Camera />}
          Take Photo
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => files.current?.click()}>
          <FileUp />
          Upload
        </Button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files)} />
      <input ref={files} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
    </>
  )
}
