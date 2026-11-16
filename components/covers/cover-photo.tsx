"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Camera, Check, Crop, FileUp, Loader2, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Drawer } from "@/components/drawer"
import { Skeleton } from "@/components/ui/skeleton"
import { listCoverPhotos, setCoverPhoto, type LibraryPhoto, type PhotoLibrary } from "@/app/(app)/covers/actions"
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
 * Pick the photo shown in place of the icon: take one, upload one, choose a photo already filed to it, or reuse
 * one from elsewhere in the household (the same product's first, so identical items can share a generic
 * product shot). A new photo goes straight to the crop screen; a reused one keeps the crop it has elsewhere.
 * For an item with copies, "also use on its copies" applies the choice to all of them.
 * Removing it brings the icon back (the photo stays filed).
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
  const [library, setLibrary] = useState<PhotoLibrary | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [alsoCopies, setAlsoCopies] = useState(true)

  // the household's other photos, fetched when the drawer opens
  useEffect(() => {
    if (!open) return
    let cancelled = false
    listCoverPhotos(target.kind, target.id)
      .then((l) => {
        if (!cancelled) setLibrary(l)
      })
      .catch(() => {
        if (!cancelled) setLibrary({ sameProduct: [], others: [], copies: 0 })
      })
    return () => {
      cancelled = true
    }
  }, [open, target.kind, target.id])
  const copies = library?.copies ?? 0
  const toCopies = copies > 0 && alsoCopies

  async function upload(list: FileList | null) {
    const file = list?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) return void toast.error("Choose a photo.")
    setBusy(true)
    const fd = new FormData()
    fd.append("files", file)
    fd.append(target.kind === "space" ? "spaceId" : "fixtureId", target.id)
    fd.append("asCover", "1")
    if (toCopies) fd.append("coverCopies", "1")
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
      const r = await setCoverPhoto(target.kind, target.id, docId, toCopies)
      if (!r.ok) return void toast.error(r.error)
      const also = toCopies ? ` on ${copies + 1} copies` : ""
      toast(docId ? `${target.noun} photo set${also}` : `${target.noun} photo removed${also}`)
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

      {copies ? (
        <label className="flex min-h-15 cursor-pointer items-center gap-3 rounded-xl bg-surface2 px-3.5 py-2.5">
          <input type="checkbox" checked={alsoCopies} onChange={(e) => setAlsoCopies(e.target.checked)} className="size-5 accent-[var(--sel)]" />
          <span className="flex flex-col">
            <b className="text-sm">Also Use on Its {copies === 1 ? "Other Copy" : `${copies} Other Copies`}</b>
            <span className="text-xs text-muted-foreground">The copies of this item that share its documents get the same photo.</span>
          </span>
        </label>
      ) : null}

      {photos.length ? <PhotoGrid title={`Filed to This ${target.noun}`} photos={photos} current={target.coverId} disabled={pending} onPick={choose} /> : null}

      {!library ? (
        <div className="grid grid-cols-3 gap-2" aria-label="Loading photos">
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="aspect-square rounded-xl" />
        </div>
      ) : (
        <>
          {library.sameProduct.length ? (
            <PhotoGrid title="From the Same Product" photos={library.sameProduct} current={target.coverId} disabled={pending} onPick={choose} />
          ) : null}
          {library.others.length ? (
            <PhotoGrid
              title={library.sameProduct.length ? "Other Photos" : "From Other Rooms and Items"}
              photos={showAll ? library.others : library.others.slice(0, 9)}
              current={target.coverId}
              disabled={pending}
              onPick={choose}
              more={!showAll && library.others.length > 9 ? () => setShowAll(true) : undefined}
            />
          ) : null}
        </>
      )}

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

/** A grid of photos to pick from; ones from elsewhere say where they come from. */
function PhotoGrid({
  title,
  photos,
  current,
  disabled,
  onPick,
  more,
}: {
  title: string
  photos: (CoverPhoto | LibraryPhoto)[]
  current: string | null
  disabled: boolean
  onPick: (id: string) => void
  more?: () => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-muted-foreground">{title}</span>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((p) => {
          const on = p.id === current
          const where = "where" in p ? p.where : ""
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              aria-label={`Use ${p.title}${where ? ` (from ${where})` : ""}`}
              title={where || p.title}
              disabled={disabled}
              onClick={() => onPick(p.id)}
              className={cn("relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 bg-surface2", on ? "border-sel" : "border-transparent")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file */}
              <img src={`/api/files/${p.id}?v=thumb`} alt="" className="size-full object-cover" loading="lazy" />
              {where ? (
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-3 pb-1 text-left text-[11px] font-semibold text-white">
                  {where}
                </span>
              ) : null}
              {on ? (
                <span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-sel text-white">
                  <Check className="size-3.5" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {more ? (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={more}>
          Show All
        </Button>
      ) : null}
    </div>
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
