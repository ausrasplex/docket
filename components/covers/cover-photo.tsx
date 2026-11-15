"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Camera, Check, Crop, FileUp, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Drawer } from "@/components/drawer"
import { setCoverPhoto } from "@/app/(app)/covers/actions"
import { CoverTile, type TileIcon } from "./cover-tile"

export type CoverPhoto = { id: string; title: string }

/** A room, item or part whose icon can be replaced with a photo. */
export type CoverTarget = {
  kind: "space" | "fixture"
  id: string
  name: string
  /** "Room", "Item" or "Part", for the wording */
  noun: string
  coverId: string | null
  src: string | null
  icon: TileIcon
  /** the crop screen's address */
  cropHref: string
}

/**
 * Pick the photo shown in place of the icon: take one, upload one, or choose a photo already filed to it.
 * A new photo goes straight to the crop screen. Removing it brings the icon back (the photo stays filed).
 */
export function CoverPhotoDrawer({
  open,
  onOpenChange,
  target,
  photos,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  target: CoverTarget
  photos: CoverPhoto[]
}) {
  const router = useRouter()
  const camera = useRef<HTMLInputElement>(null)
  const files = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [pending, start] = useTransition()
  const noun = target.noun.toLowerCase()

  async function upload(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return void toast.error("Choose a photo.")
    setBusy(true)
    const fd = new FormData()
    fd.append("files", file)
    fd.append(target.kind === "space" ? "spaceId" : "fixtureId", target.id)
    fd.append("asCover", "1")
    fd.append("label", `${target.noun} photo`)
    try {
      const r = await fetch("/api/documents", { method: "POST", body: fd })
      const j = (await r.json().catch(() => ({}))) as { created?: string[]; errors?: string[]; error?: string }
      if (j.error) toast.error(j.error)
      j.errors?.forEach((e) => toast.error(e))
      if (j.created?.length) {
        // a new photo goes straight to the crop screen, centred to start with
        onOpenChange(false)
        router.push(target.cropHref)
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
      const r = await setCoverPhoto(target.kind, target.id, docId)
      if (!r.ok) return void toast.error(r.error)
      toast(docId ? `${target.noun} photo set` : `${target.noun} photo removed`)
      onOpenChange(false)
    })

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={`${target.noun} Photo`} description={`Shown in place of the icon for ${target.name}.`}>
      <div className="flex items-center gap-4">
        <CoverTile icon={target.icon} src={target.src} className="size-24 rounded-3xl" />
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
          <span className="text-[13px] font-bold text-muted-foreground">Or Pick One Filed to This {target.noun}</span>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => {
              const on = p.id === target.coverId
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

      {target.coverId ? (
        <Button asChild type="button" variant="outline" className="self-start">
          <Link href={target.cropHref}>
            <Crop />
            Adjust Crop
          </Link>
        </Button>
      ) : null}
      {target.coverId ? (
        <Button type="button" variant="destructive" className="self-start" disabled={pending} onClick={() => choose(null)}>
          <Trash2 />
          Remove Photo
        </Button>
      ) : null}

      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files)} aria-label={`Take ${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun} photo`} />
      <input ref={files} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files)} aria-label={`Upload ${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun} photo`} />
    </Drawer>
  )
}

/** The tile on a room's or item's page; members tap it to change the photo. */
export function CoverPhotoButton({ target, photos, className = "size-16" }: { target: CoverTarget; photos: CoverPhoto[]; className?: string }) {
  const [open, setOpen] = useState(false)
  const noun = target.noun.toLowerCase()
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={target.coverId ? `Change ${noun} photo` : `Add ${/^[aeiou]/.test(noun) ? "an" : "a"} ${noun} photo`}
        className="group relative flex-none cursor-pointer"
      >
        <CoverTile icon={target.icon} src={target.src} className={className} />
        <span className="absolute -right-1 -bottom-1 flex size-7 items-center justify-center rounded-full border-2 border-bg bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,.12)] group-hover:bg-surface2">
          <Camera className="size-3.5" />
        </span>
      </button>
      <CoverPhotoDrawer open={open} onOpenChange={setOpen} target={target} photos={photos} />
    </>
  )
}
