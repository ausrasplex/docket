"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, FieldLabel } from "@/components/drawer"
import { SelectItem, SelectSeparator } from "@/components/ui/select"
import { Dropdown, NONE } from "@/components/dropdown"
import { SPACE_KINDS } from "@/lib/spaces"
import type { SpaceKind } from "@/generated/prisma/enums"
import { createSpace, updateSpace, type SpaceInput } from "./actions"

const TONE = { a1: "bg-a1", a2: "bg-a2", a3: "bg-a3" } as const

export type SpaceDraft = { id?: string; slug?: string } & SpaceInput

/** Add or edit a room, floor or area. */
export function SpaceDrawer({
  open,
  onOpenChange,
  initial,
  floors,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: SpaceDraft
  floors: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [pending, start] = useTransition()
  // start from the given values each time the drawer opens (reset during render, not in an effect)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setV(initial)
  }
  const set = <K extends keyof SpaceDraft>(k: K, val: SpaceDraft[K]) => setV((p) => ({ ...p, [k]: val }))
  const editing = !!initial.id

  const save = () =>
    start(async () => {
      const r = editing ? await updateSpace(initial.id!, v) : await createSpace(v)
      if (!r.ok) return void toast.error(r.error)
      toast(editing ? "Saved" : `${v.name.trim()} added`)
      onOpenChange(false)
      if (!editing && "slug" in r) router.push(`/rooms/${r.slug}`)
      else if (editing && "slug" in r && r.slug !== initial.slug) router.replace(`/rooms/${r.slug}`)
    })

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit Room" : "Add Room"}
      description={editing ? undefined : "A room, a floor, or an area like the garage or the whole house."}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending || !v.name.trim()} onClick={save}>
            {editing ? "Save" : "Add Room"}
          </Button>
        </>
      }
    >
      <FieldLabel label="Name">
        <Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Kitchen" autoFocus onKeyDown={(e) => e.key === "Enter" && v.name.trim() && save()} />
      </FieldLabel>

      <Dropdown label="Type" value={v.kind} onChange={(k) => set("kind", k as SpaceKind)}>
        {SPACE_KINDS.map((k) => (
          <SelectItem key={k.id} value={k.id}>
            <span className={cn("flex size-6 items-center justify-center rounded-full text-on-a", TONE[k.tone])}>
              <k.icon className="size-3.5" />
            </span>
            {k.label}
          </SelectItem>
        ))}
      </Dropdown>

      {v.kind !== "FLOOR" && floors.length ? (
        <Dropdown label="On Floor" value={v.parentId ?? NONE} onChange={(f) => set("parentId", f === NONE ? null : f)}>
          <SelectItem value={NONE}>None</SelectItem>
          <SelectSeparator />
          {floors
            .filter((f) => f.id !== initial.id)
            .map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
        </Dropdown>
      ) : null}

      <FieldLabel label="Notes (optional)">
        <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Measurements, quirks, anything worth remembering" />
      </FieldLabel>
    </Drawer>
  )
}
