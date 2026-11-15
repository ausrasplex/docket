"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Plus } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { spaceKind } from "@/lib/spaces"
import { plural } from "@/lib/format"
import type { SpaceKind } from "@/generated/prisma/enums"
import { SpaceDrawer, type SpaceDraft } from "./space-drawer"

export type RoomCard = {
  id: string
  name: string
  kind: SpaceKind
  parentId: string | null
  fixtures: number
  finishes: number
  swatches: string[]
}

const TONE = { a1: "bg-a1", a2: "bg-a2", a3: "bg-a3" } as const
const BLANK: SpaceDraft = { name: "", kind: "ROOM", parentId: null, notes: "" }

export function RoomsList({ rooms, canEdit }: { rooms: RoomCard[]; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  const floors = rooms.filter((r) => r.kind === "FLOOR")
  // rooms on a floor are listed under it; everything else under "Rooms"
  const groups = [
    { id: null as string | null, name: floors.length ? "Not on a floor" : "", rooms: rooms.filter((r) => r.kind !== "FLOOR" && !r.parentId) },
    ...floors.map((f) => ({ id: f.id, name: f.name, rooms: rooms.filter((r) => r.parentId === f.id) })),
  ].filter((g) => g.rooms.length || g.id)

  return (
    <>
      {canEdit ? (
        <Button variant="add" size="icon" aria-label="Add room" className="fixed right-4 bottom-24 z-20 shadow-raised desk:hidden" onClick={() => setOpen(true)}>
          <Plus />
        </Button>
      ) : null}
      <div className="hidden justify-end desk:flex">
        {canEdit ? (
          <Button variant="add" onClick={() => setOpen(true)}>
            <Plus />
            Add Room
          </Button>
        ) : null}
      </div>

      {groups.map((g) => (
        <section key={g.id ?? "none"} className="flex flex-col gap-3">
          {g.name ? (
            <h2 className="flex items-baseline justify-between">
              {g.name}
              {g.id ? (
                <Link href={`/rooms/${g.id}`} className="text-[13px] font-semibold text-muted-foreground hover:text-ink">
                  Floor details
                </Link>
              ) : null}
            </h2>
          ) : null}
          <div className="grid grid-cols-1 gap-3 desk:grid-cols-3">
            {g.rooms.map((r) => {
              const k = spaceKind(r.kind)
              return (
                <Link key={r.id} href={`/rooms/${r.id}`} className="lift group flex items-center gap-3.5 rounded-3xl bg-surface p-4">
                  <span className={cn("flex size-12 flex-none items-center justify-center rounded-2xl text-on-a", TONE[k.tone])}>
                    <k.icon className="size-6" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-bold">{r.name}</span>
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {r.fixtures || r.finishes ? `${plural(r.fixtures, "fixture")} · ${plural(r.finishes, "finish", "finishes")}` : "Nothing added yet"}
                    </span>
                  </span>
                  {r.swatches.length ? (
                    <span className="flex -space-x-1.5" aria-hidden="true">
                      {r.swatches.slice(0, 3).map((c, i) => (
                        <span key={i} className="size-5 rounded-full border-2 border-surface" style={{ background: c }} />
                      ))}
                    </span>
                  ) : null}
                  <ChevronRight className="cardarrow size-5 text-muted-foreground" />
                </Link>
              )
            })}
            {g.id && !g.rooms.length ? <p className="text-sm text-muted-foreground">No rooms on this floor yet.</p> : null}
          </div>
        </section>
      ))}

      <SpaceDrawer open={open} onOpenChange={setOpen} initial={BLANK} floors={floors} />
    </>
  )
}
