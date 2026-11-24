"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { withoutAdd } from "@/components/shell/header-action"
import { RoomTile } from "@/components/rooms/room-tile"
import { plural } from "@/lib/format"
import type { SpaceKind } from "@/generated/prisma/enums"
import { SpaceDrawer, type SpaceDraft } from "./space-drawer"
import { SwatchGroup, type SwatchColour } from "@/components/finishes/swatch-group"

export type RoomCard = {
  id: string
  slug: string
  name: string
  kind: SpaceKind
  parentId: string | null
  fixtures: number
  finishes: number
  swatches: SwatchColour[]
  photo: string | null
}

const BLANK: SpaceDraft = { name: "", kind: "ROOM", parentId: null, notes: "" }

export function RoomsList({ rooms, canEdit, openAdd }: { rooms: RoomCard[]; canEdit: boolean; openAdd: boolean }) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  const [open, setOpen] = useState(openAdd && canEdit)
  // Add Room (beside the title) links here with ?add=1: open the drawer, even if this page is already open
  const [lastAdd, setLastAdd] = useState(openAdd)
  if (openAdd !== lastAdd) {
    setLastAdd(openAdd)
    if (openAdd && canEdit) setOpen(true)
  }
  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o && openAdd) router.replace(withoutAdd(path, params), { scroll: false })
  }
  const floors = rooms.filter((r) => r.kind === "FLOOR")
  // rooms on a floor are listed under it; everything else under "Rooms"
  const groups = [
    { id: null as string | null, slug: "", name: floors.length ? "Not on a floor" : "", rooms: rooms.filter((r) => r.kind !== "FLOOR" && !r.parentId) },
    ...floors.map((f) => ({ id: f.id, slug: f.slug, name: f.name, rooms: rooms.filter((r) => r.parentId === f.id) })),
  ].filter((g) => g.rooms.length || g.id)

  return (
    <>
      {groups.map((g) => (
        <section key={g.id ?? "none"} className="flex flex-col gap-3">
          {g.name ? (
            <h2 className="flex items-baseline justify-between">
              {g.name}
              {g.id ? (
                <Link href={`/rooms/${g.slug}`} className="text-[13px] font-semibold text-muted-foreground hover:text-ink">
                  Floor details
                </Link>
              ) : null}
            </h2>
          ) : null}
          <div className="grid grid-cols-1 gap-3 desk:grid-cols-3">
            {g.rooms.map((r) => {
              return (
                <Link key={r.id} href={`/rooms/${r.slug}`} className="lift group flex items-center gap-3.5 rounded-3xl bg-surface p-4">
                  <RoomTile kind={r.kind} src={r.photo} className="size-12" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-bold">{r.name}</span>
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {r.fixtures || r.finishes ? `${plural(r.fixtures, "fixture")} · ${plural(r.finishes, "finish", "finishes")}` : "Nothing added yet"}
                    </span>
                  </span>
                  <SwatchGroup colours={r.swatches} />
                  <ChevronRight className="cardarrow size-5 text-muted-foreground" />
                </Link>
              )
            })}
            {g.id && !g.rooms.length ? <p className="text-sm text-muted-foreground">No rooms on this floor yet.</p> : null}
          </div>
        </section>
      ))}

      <SpaceDrawer open={open} onOpenChange={onOpenChange} initial={BLANK} floors={floors} />
    </>
  )
}
