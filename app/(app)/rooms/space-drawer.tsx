"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, FieldLabel } from "@/components/drawer"
import { SPACE_KINDS } from "@/lib/spaces"
import type { SpaceKind } from "@/generated/prisma/enums"
import { createSpace, updateSpace, type SpaceInput } from "./actions"

const TONE = { a1: "bg-a1", a2: "bg-a2", a3: "bg-a3" } as const

export type SpaceDraft = { id?: string } & SpaceInput

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
      if (!editing && "id" in r) router.push(`/rooms/${r.id}`)
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

      <div role="radiogroup" aria-label="Type" className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted-foreground">Type</span>
        <div className="grid grid-cols-2 gap-2">
          {SPACE_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={v.kind === k.id}
              onClick={() => set("kind", k.id as SpaceKind)}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-2.5 rounded-xl border-2 bg-surface2 px-3 text-left text-sm font-bold hover:bg-t1",
                v.kind === k.id ? "border-sel" : "border-transparent"
              )}
            >
              <span className={cn("flex size-8 flex-none items-center justify-center rounded-[10px] text-on-a", TONE[k.tone])}>
                <k.icon className="size-[18px]" />
              </span>
              {k.label}
            </button>
          ))}
        </div>
      </div>

      {v.kind !== "FLOOR" && floors.length ? (
        <div role="radiogroup" aria-label="Floor" className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-muted-foreground">On Floor</span>
          <div className="flex flex-wrap gap-2">
            {[{ id: null, name: "None" } as { id: string | null; name: string }, ...floors.filter((f) => f.id !== initial.id)].map((f) => (
              <button
                key={f.id ?? "none"}
                type="button"
                role="radio"
                aria-checked={v.parentId === f.id}
                onClick={() => set("parentId", f.id)}
                className={cn(
                  "min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold",
                  v.parentId === f.id ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2"
                )}
              >
                {f.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <FieldLabel label="Notes (optional)">
        <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Measurements, quirks, anything worth remembering" />
      </FieldLabel>
    </Drawer>
  )
}
