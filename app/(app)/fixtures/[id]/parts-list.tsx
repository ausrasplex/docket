"use client"

import { useState, useTransition } from "react"
import { Archive, Camera, ExternalLink, FileText, MoreHorizontal, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { WarrantyState } from "@/lib/fixtures"
import { CoverTile } from "@/components/covers/cover-tile"
import { CoverPhotoDrawer, type CoverPhoto, type CoverTarget } from "@/components/covers/cover-photo"
import { BLANK_FIXTURE, FixtureDrawer } from "../fixture-drawer"
import { setFixtureArchived, type FixtureInput } from "../actions"

export type PartRow = {
  id: string
  name: string
  makeModel: string
  serial: string | null
  room: string | null
  warranty: WarrantyState
  support: string | null
  docs: number
  input: FixtureInput
  photo: CoverTarget
  photos: CoverPhoto[]
}

const WARRANTY_TONE = { ok: "bg-t3", soon: "bg-t2", expired: "bg-danger-soft text-danger", none: "" } as const

export function PartsList({
  parts,
  parent,
  rooms,
  brands,
  canEdit,
}: {
  parts: PartRow[]
  parent: { id: string; name: string; brand: string }
  rooms: { id: string; name: string }[]
  brands: string[]
  canEdit: boolean
}) {
  const [editing, setEditing] = useState<PartRow | null>(null)
  const [adding, setAdding] = useState(false)
  const [photoFor, setPhotoFor] = useState<string | null>(null)
  const photoPart = parts.find((x) => x.id === photoFor) ?? null
  const [, start] = useTransition()
  return (
    <div className="flex flex-col gap-3">
      {parts.length ? (
        <ul className="flex flex-col">
          {parts.map((p) => (
            <li key={p.id} id={`part-${p.id}`} className="flex scroll-mt-24 items-start gap-3 border-t border-line py-3 first:border-t-0">
              <CoverTile icon={{ type: "part" }} src={p.photo.src} className="size-10 rounded-xl" />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[15px] font-bold">{p.name}</span>
                <span className="text-xs font-medium text-muted-foreground">
                  {[p.makeModel, p.serial && `SN ${p.serial}`, p.room].filter(Boolean).join(" · ") || "No model yet"}
                </span>
                <span className="flex flex-wrap gap-1.5 text-xs font-semibold">
                  {p.warranty.tone !== "none" ? <span className={cn("rounded-full px-2 py-0.5", WARRANTY_TONE[p.warranty.tone])}>{p.warranty.text}</span> : null}
                  <span className="flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5">
                    <FileText className="size-3" />
                    {p.docs}
                  </span>
                  {p.support ? (
                    <a href={p.support} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5 hover:bg-t1">
                      <ExternalLink className="size-3" />
                      Support
                    </a>
                  ) : null}
                </span>
              </span>
              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Options for ${p.name}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setEditing(p)}>
                      <Pencil />
                      Edit Part
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setPhotoFor(p.id)}>
                      <Camera />
                      Part Photo
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        start(async () => {
                          const r = await setFixtureArchived(p.id, true)
                          if (!r.ok) toast.error(r.error)
                          else toast(`${p.name} archived`)
                        })
                      }
                    >
                      <Archive />
                      Archive Part
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-surface2 px-4 py-3 text-sm text-muted-foreground">
          No parts. Add them when pieces have their own manuals or serials, like an indoor unit, outdoor unit and remote.
        </p>
      )}
      {canEdit ? (
        <Button variant="outline" className="self-start" onClick={() => setAdding(true)}>
          <Plus />
          Add Part
        </Button>
      ) : null}
      {photoPart ? (
        <CoverPhotoDrawer open onOpenChange={(o) => !o && setPhotoFor(null)} target={photoPart.photo} photos={photoPart.photos} />
      ) : null}
      <FixtureDrawer
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={editing?.input ?? BLANK_FIXTURE}
        editingId={editing?.id}
        parent={{ id: parent.id, name: parent.name }}
        rooms={rooms}
        brands={brands}
      />
      <FixtureDrawer open={adding} onOpenChange={setAdding} initial={{ ...BLANK_FIXTURE, brand: parent.brand }} parent={{ id: parent.id, name: parent.name }} rooms={rooms} brands={brands} />
    </div>
  )
}
