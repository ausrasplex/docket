"use client"

import { useState, useTransition } from "react"
import { Archive, ArchiveRestore, Camera, Copy, Files, MoreHorizontal, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BLANK_FIXTURE, FixtureDrawer } from "../fixture-drawer"
import { CoverPhotoDrawer, type CoverPhoto, type CoverTarget } from "@/components/covers/cover-photo"
import { setFixtureArchived, type FixtureInput } from "../actions"
import { DuplicateDialog } from "./duplicate-dialog"
import { ShareDocsDialog, type ShareCandidate } from "./share-docs-dialog"

export function FixtureMenu({
  id,
  name,
  archived,
  initial,
  rooms,
  brands,
  photo,
  photos,
  parts,
  shareWith,
  tracked = null,
}: {
  id: string
  name: string
  archived: boolean
  initial: FixtureInput
  rooms: { id: string; name: string }[]
  brands: string[]
  photo: CoverTarget
  photos: CoverPhoto[]
  parts: { id: string; name: string }[]
  shareWith: ShareCandidate[]
  /** the cheapest current tracked shop price, if any */
  tracked?: number | null
}) {
  const [edit, setEdit] = useState(false)
  const [duplicate, setDuplicate] = useState(false)
  const [share, setShare] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [addPart, setAddPart] = useState(false)
  const [, start] = useTransition()
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Item options" className="bg-surface">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setEdit(true)}>
            <Pencil />
            Edit Item
          </DropdownMenuItem>
          {initial.partsEnabled || parts.length ? (
            <DropdownMenuItem onSelect={() => setAddPart(true)}>
              <Plus />
              Add Part
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setPhotoOpen(true)}>
            <Camera />
            Item Photo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDuplicate(true)}>
            <Copy />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShare(true)}>
            <Files />
            Share Documents
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant={archived ? "default" : "destructive"}
            onSelect={() =>
              start(async () => {
                const r = await setFixtureArchived(id, !archived)
                if (!r.ok) toast.error(r.error)
                else toast(archived ? `${name} restored` : `${name} archived`)
              })
            }
          >
            {archived ? <ArchiveRestore /> : <Archive />}
            {archived ? "Restore Item" : "Archive Item"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CoverPhotoDrawer open={photoOpen} onOpenChange={setPhotoOpen} target={photo} photos={photos} />
      <DuplicateDialog open={duplicate} onOpenChange={setDuplicate} id={id} name={name} roomId={initial.spaceId} rooms={rooms} parts={parts} />
      <ShareDocsDialog open={share} onOpenChange={setShare} id={id} name={name} candidates={shareWith} />
      <FixtureDrawer open={edit} onOpenChange={setEdit} initial={initial} editingId={id} rooms={rooms} brands={brands} tracked={tracked} partCount={parts.length} />
      <FixtureDrawer
        open={addPart}
        onOpenChange={setAddPart}
        initial={{ ...BLANK_FIXTURE, category: initial.category, brand: initial.brand }}
        parent={{ id, name }}
        rooms={rooms}
        brands={brands}
      />
    </>
  )
}
