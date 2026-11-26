"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive, Camera, FileUp, HandHelping, Link2, Loader2, MoreHorizontal, Pencil, Wrench } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { setFixtureArchived } from "./actions"

/**
 * The ⋯ on an item's card: the things people do most without opening the item first. Uploads and archiving
 * happen here; Edit, Log Service and Works With open the item's page with that drawer already open (?do=).
 */
export function CardMenu({ id, name, serviceEnabled, canLend }: { id: string; name: string; serviceEnabled: boolean; canLend: boolean }) {
  const router = useRouter()
  const files = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [, start] = useTransition()
  const go = (intent: string) => router.push(`/fixtures/${id}?do=${intent}`)

  async function upload(list: FileList | null) {
    if (!list?.length) return
    setBusy(true)
    const fd = new FormData()
    ;[...list].forEach((f) => fd.append("files", f))
    fd.append("fixtureId", id)
    try {
      const r = await fetch("/api/documents", { method: "POST", body: fd })
      const j = (await r.json().catch(() => ({}))) as { created?: string[]; errors?: string[]; error?: string }
      if (j.error) toast.error(j.error)
      j.errors?.forEach((e) => toast.error(e))
      if (j.created?.length) toast(j.created.length === 1 ? `Added to ${name}` : `${j.created.length} files added to ${name}`)
      router.refresh()
    } catch {
      toast.error("Docket couldn't reach the server. Try again.")
    } finally {
      setBusy(false)
      if (files.current) files.current.value = ""
      if (camera.current) camera.current.value = ""
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Options for ${name}`} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <MoreHorizontal />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => go("edit")}>
            <Pencil />
            Edit Item
          </DropdownMenuItem>
          {serviceEnabled ? (
            <DropdownMenuItem onSelect={() => go("service")}>
              <Wrench />
              Log Service
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => files.current?.click()}>
            <FileUp />
            Upload PDF or Photo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => camera.current?.click()}>
            <Camera />
            Take Photo
          </DropdownMenuItem>
          {canLend ? (
            <DropdownMenuItem onSelect={() => go("lend")}>
              <HandHelping />
              Lend Out
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => go("works-with")}>
            <Link2 />
            Works With
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() =>
              start(async () => {
                const r = await setFixtureArchived(id, true)
                if (!r.ok) return void toast.error(r.error)
                toast(`${name} archived`, {
                  action: { label: "Undo", onClick: () => void setFixtureArchived(id, false).then(() => router.refresh()) },
                })
              })
            }
          >
            <Archive />
            Archive Item
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={files} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files)} />
    </>
  )
}
