"use client"

import { useMemo, useState, useTransition } from "react"
import { Archive, ArchiveRestore, Camera, MoreHorizontal, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { SpaceKind } from "@/generated/prisma/enums"
import { setSpaceArchived } from "../actions"
import { SpaceDrawer } from "../space-drawer"
import { CoverPhotoDrawer, type CoverPhoto, type CoverTarget } from "@/components/covers/cover-photo"

export function RoomActions({
  room,
  archived,
  floors,
  photoRoom,
  photos,
}: {
  room: { id: string; slug: string; name: string; kind: SpaceKind; parentId: string | null; notes: string }
  archived: boolean
  floors: { id: string; name: string }[]
  photoRoom: CoverTarget
  photos: CoverPhoto[]
}) {
  const [open, setOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [, start] = useTransition()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initial = useMemo(() => ({ ...room }), [room.id, room.slug, room.name, room.kind, room.parentId, room.notes])
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Room options" className="bg-surface">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setOpen(true)}>
            <Pencil />
            Edit Room
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setPhotoOpen(true)}>
            <Camera />
            Room Photo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant={archived ? "default" : "destructive"}
            onSelect={() =>
              start(async () => {
                const r = await setSpaceArchived(room.id, !archived)
                if (!r.ok) toast.error(r.error)
                else toast(archived ? `${room.name} restored` : `${room.name} archived`)
              })
            }
          >
            {archived ? <ArchiveRestore /> : <Archive />}
            {archived ? "Restore Room" : "Archive Room"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SpaceDrawer open={open} onOpenChange={setOpen} initial={initial} floors={floors} />
      <CoverPhotoDrawer open={photoOpen} onOpenChange={setPhotoOpen} target={photoRoom} photos={photos} />
    </>
  )
}
