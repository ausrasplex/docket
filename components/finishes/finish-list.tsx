"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Archive, Camera, Copy, ExternalLink, MoreHorizontal, Package, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { colourTitle, finishKindLabel, surfaceLabel } from "@/lib/finishes"
import { date } from "@/lib/format"
import { setFinishArchived, type FinishInput } from "@/app/(app)/paint/actions"
import { FinishDrawer } from "./finish-drawer"
import { BLANK_FINISH, sameColour, type FinishRow } from "./finish-types"

type DrawerState = { mode: "add"; initial: FinishInput; rooms: string[] } | { mode: "edit"; id: string } | null

/** A swatch circle; striped when there's no colour recorded. */
export function Swatch({ hex, size = 44 }: { hex: string | null | undefined; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex-none rounded-full border border-line"
      style={{
        width: size,
        height: size,
        background: hex || "repeating-linear-gradient(45deg, var(--surface), var(--surface) 5px, var(--line) 5px, var(--line) 10px)",
      }}
    />
  )
}

/**
 * Paint and finishes as rows (a room's list) or grouped by colour (the Paint page, where each colour
 * shows every room it's used in and where the leftover tins are).
 */
export function FinishList({
  rows,
  rooms,
  brands,
  canEdit,
  presetRoom,
  groupByColour = false,
  openAdd = false,
}: {
  rows: FinishRow[]
  rooms: { id: string; name: string }[]
  brands: string[]
  canEdit: boolean
  presetRoom?: string
  groupByColour?: boolean
  /** open the Add drawer (the Add menu links to /paint?add=1) */
  openAdd?: boolean
}) {
  const [drawer, setDrawer] = useState<DrawerState>(openAdd && canEdit ? { mode: "add", initial: BLANK_FINISH, rooms: [] } : null)
  const [lastAdd, setLastAdd] = useState(openAdd)
  if (openAdd !== lastAdd) {
    setLastAdd(openAdd)
    if (openAdd && canEdit) setDrawer({ mode: "add", initial: BLANK_FINISH, rooms: [] })
  }
  const [, start] = useTransition()
  // look the row up from the latest props, so photos added while editing appear straight away
  const editing = drawer?.mode === "edit" ? (rows.find((r) => r.id === drawer.id) ?? null) : null

  const archive = (r: FinishRow) =>
    start(async () => {
      const res = await setFinishArchived(r.id, true)
      if (!res.ok) toast.error(res.error)
      else toast("Archived")
    })

  // in a room: the colour is the title; on the Paint page (already grouped by colour): the room is
  const row = (r: FinishRow) => {
    const i = r.input
    const surface = surfaceLabel(i.surface) + (i.surfaceNote ? ` (${i.surfaceNote})` : "")
    const meta = [surface, groupByColour ? null : [i.brand, i.colourCode].filter(Boolean).join(" "), i.kind !== "PAINT" && !groupByColour ? finishKindLabel(i.kind) : null, i.sheen || null].filter(Boolean).join(" · ")
    return (
      <li key={r.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
        <Link href={`/paint/${r.id}`} className="lift group flex min-w-0 flex-1 items-center gap-3 text-left">
          {groupByColour ? null : <Swatch hex={i.hex} />}
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-bold">{groupByColour ? r.room : colourTitle(i)}</span>
            <span className="truncate text-xs font-medium text-muted-foreground">{meta}</span>
            {i.leftoverLocation || i.appliedAt || r.docs.length ? (
              <span className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold">
                {i.leftoverLocation ? (
                  <span className="flex items-center gap-1 rounded-full bg-t3 px-2 py-0.5">
                    <Package className="size-3" />
                    {i.leftoverLocation}
                  </span>
                ) : null}
                {i.appliedAt ? <span className="rounded-full bg-surface2 px-2 py-0.5">Applied {date(new Date(`${i.appliedAt}T00:00:00Z`))}</span> : null}
                {r.docs.length ? (
                  <span className="flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5">
                    <Camera className="size-3" />
                    {r.docs.length}
                  </span>
                ) : null}
              </span>
            ) : null}
          </span>
        </Link>
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Options for ${colourTitle(i)} in ${r.room}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onSelect={() => setDrawer({ mode: "edit", id: r.id })}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDrawer({ mode: "add", initial: sameColour(i), rooms: [] })}>
                <Copy />
                Use in Another Room
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => archive(r)}>
                <Archive />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </li>
    )
  }

  // the Paint page: one card per colour (same brand + name + code), listing where it's used
  const groups = groupByColour
    ? [...rows.reduce((m, r) => {
        const k = [r.input.brand, r.input.colourName, r.input.colourCode, r.input.kind].join("|").toLowerCase()
        m.set(k, [...(m.get(k) ?? []), r])
        return m
      }, new Map<string, FinishRow[]>()).values()]
    : []

  // on the Paint page the Add button sits above the colours; on a room it follows the list
  const addButton = canEdit ? (
    <Button
      variant={groupByColour ? "add" : "outline"}
      className={groupByColour ? "w-full desk:w-auto desk:self-end" : "mt-3 self-start"}
      onClick={() => setDrawer({ mode: "add", initial: BLANK_FINISH, rooms: presetRoom ? [presetRoom] : [] })}
    >
      <Plus />
      {groupByColour ? "Add Paint" : "Add Paint or Finish"}
    </Button>
  ) : null

  return (
    <>
      {groupByColour ? addButton : null}
      {groupByColour ? (
        <div className="grid grid-cols-1 items-start gap-4 desk:grid-cols-2">
          {groups.map((g) => {
            const first = g[0].input
            const hex = g.find((r) => r.input.hex)?.input.hex
            const link = g.find((r) => r.input.productUrl)?.input.productUrl
            return (
              <section key={g[0].id} className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
                <div className="flex items-center gap-3.5">
                  <Swatch hex={hex} size={56} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h2 className="truncate">
                      <Link href={`/paint/${g[0].id}`} className="hover:underline">
                        {colourTitle(first)}
                      </Link>
                    </h2>
                    <span className="truncate text-[13px] font-medium text-muted-foreground">
                      {[first.brand, first.colourCode, first.product !== colourTitle(first) ? first.product : null, first.kind !== "PAINT" ? finishKindLabel(first.kind) : null].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  {link ? (
                    <a href={link} target="_blank" rel="noopener noreferrer" aria-label="Colour's web page" className="flex size-10 flex-none items-center justify-center rounded-full bg-surface2 hover:bg-t1">
                      <ExternalLink className="size-[18px]" />
                    </a>
                  ) : null}
                </div>
                <ul className="flex flex-col">{g.map((r) => row(r))}</ul>
                {canEdit ? (
                  <Button variant="outline" size="sm" className="self-start" onClick={() => setDrawer({ mode: "add", initial: sameColour(first), rooms: [] })}>
                    <Copy />
                    Use in Another Room
                  </Button>
                ) : null}
              </section>
            )
          })}
        </div>
      ) : rows.length ? (
        <ul className="flex flex-col">{rows.map((r) => row(r))}</ul>
      ) : null}
      {groupByColour ? null : addButton}

      <FinishDrawer
        open={!!drawer && (drawer.mode === "add" || !!editing)}
        onOpenChange={(o) => !o && setDrawer(null)}
        initial={drawer?.mode === "add" ? drawer.initial : (editing?.input ?? BLANK_FINISH)}
        editing={editing}
        presetRooms={drawer?.mode === "add" ? drawer.rooms : []}
        rooms={rooms}
        brands={brands}
      />
    </>
  )
}
