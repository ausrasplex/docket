"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Camera, Check, Crop, FileUp, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Drawer } from "@/components/drawer"
import { RoomTile } from "@/components/rooms/room-tile"
import type { SpaceKind } from "@/generated/prisma/enums"
import { setSpaceCover } from "../actions"

export type RoomPhoto = { id: string; title: string }
export type PhotoRoom = { id: string; slug: string; name: string; kind: SpaceKind; coverId: string | null; src: string | null }

/**
 * Pick the photo shown in place of the room's icon: take one, upload one, or choose a photo already
 * filed to the room. Removing it brings the icon back (the photo itself stays filed to the room).
 */
export function RoomPhotoDrawer({
  open,
  onOpenChange,
  room,
  photos,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  room: PhotoRoom
  photos: RoomPhoto[]
}) {
  const router = useRouter()
  const camera = useRef<HTMLInputElement>(null)
  const files = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pending, start] = useTransition()

  async function upload(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return void toast.error("Choose a photo.")
    setBusy(true)
    const fd = new FormData()
    fd.append("files", file)
    fd.append("spaceId", room.id)
    fd.append("asCover", "1")
    fd.append("label", "Room photo")
    try {
      const r = await fetch("/api/documents", { method: "POST", body: fd })
      const j = (await r.json().catch(() => ({}))) as { created?: string[]; errors?: string[]; error?: string }
      if (j.error) toast.error(j.error)
      j.errors?.forEach((e) => toast.error(e))
      if (j.created?.length) {
        // a new photo goes straight to the crop screen, centred to start with
        onOpenChange(false)
        router.push(`/rooms/${room.slug}/photo`)
        return
      }
      router.refresh()
    } catch {
      toast.error("Docket couldn't reach the server. Try again.")
    } finally {
      setBusy(false)
      if (camera.current) camera.current.value = ""
      if (files.current) files.current.value = ""
    }
  }

  const choose = (docId: string | null) =>
    start(async () => {
      const r = await setSpaceCover(room.id, docId)
      if (!r.ok) return void toast.error(r.error)
      toast(docId ? "Room photo set" : "Room photo removed")
      onOpenChange(false)
    })

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title="Room Photo" description={`Shown in place of the icon for ${room.name}.`}>
      <div className="flex items-center gap-4">
        <RoomTile kind={room.kind} src={room.src} className="size-24 rounded-3xl" />
        <div className="flex flex-col gap-2">
          <Button type="button" size="sm" disabled={busy} onClick={() => camera.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <Camera />}
            Take Photo
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => files.current?.click()}>
            <FileUp />
            Upload
          </Button>
        </div>
      </div>

      {photos.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-muted-foreground">Or Pick One Filed to This Room</span>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => {
              const on = p.id === room.coverId
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={`Use ${p.title}`}
                  disabled={pending}
                  onClick={() => choose(p.id)}
                  className={cn("relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 bg-surface2", on ? "border-sel" : "border-transparent")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file */}
                  <img src={`/api/files/${p.id}?v=thumb`} alt="" className="size-full object-cover" loading="lazy" />
                  {on ? (
                    <span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-sel text-white">
                      <Check className="size-3.5" />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {room.coverId ? (
        <Button asChild type="button" variant="outline" className="self-start">
          <Link href={`/rooms/${room.slug}/photo`}>
            <Crop />
            Adjust Crop
          </Link>
        </Button>
      ) : null}
      {room.coverId ? (
        <Button type="button" variant="destructive" className="self-start" disabled={pending} onClick={() => choose(null)}>
          <Trash2 />
          Remove Photo
        </Button>
      ) : null}

      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files)} />
      <input ref={files} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files)} />
    </Drawer>
  )
}

/** The room's tile on its page; members can tap it to change the photo. */
export function RoomPhotoButton({ room, photos }: { room: PhotoRoom; photos: RoomPhoto[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={room.coverId ? "Change room photo" : "Add a room photo"} className="group relative flex-none cursor-pointer">
        <RoomTile kind={room.kind} src={room.src} className="size-16" />
        <span className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-bg bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,.12)] group-hover:bg-surface2">
          <Camera className="size-3.5" />
        </span>
      </button>
      <RoomPhotoDrawer open={open} onOpenChange={setOpen} room={room} photos={photos} />
    </>
  )
}
