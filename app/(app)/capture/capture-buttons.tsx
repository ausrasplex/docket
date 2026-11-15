"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, FileUp, Loader2 } from "lucide-react"
import { toast } from "sonner"

/**
 * The two ways in: the camera (opens straight to the rear camera on phones) and choosing files
 * (photos or PDFs, several at once). Uploads land in the inbox below.
 */
export function CaptureButtons({ spaceId }: { spaceId?: string }) {
  const router = useRouter()
  const camera = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)

  async function upload(list: FileList | null) {
    if (!list?.length) return
    const files = [...list]
    setBusy(files.length === 1 ? "Uploading…" : `Uploading ${files.length} files…`)
    const fd = new FormData()
    files.forEach((f) => fd.append("files", f))
    if (spaceId) fd.append("spaceId", spaceId)
    try {
      const r = await fetch("/api/documents", { method: "POST", body: fd })
      const j = (await r.json().catch(() => ({}))) as { created?: string[]; errors?: string[]; error?: string }
      if (j.error) toast.error(j.error)
      j.errors?.forEach((e) => toast.error(e))
      if (j.created?.length) toast(j.created.length === 1 ? "Saved to the inbox" : `${j.created.length} files saved`)
      router.refresh()
    } catch {
      toast.error("Docket couldn't reach the server. Try again.")
    } finally {
      setBusy(null)
      if (camera.current) camera.current.value = ""
      if (picker.current) picker.current.value = ""
    }
  }

  const tile =
    "lift flex min-h-36 flex-1 cursor-pointer flex-col items-start justify-between gap-6 rounded-3xl p-5 text-left text-on-a disabled:cursor-wait disabled:opacity-70"
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <button type="button" disabled={!!busy} onClick={() => camera.current?.click()} className={`${tile} bg-a3`}>
          <span className="flex size-12 items-center justify-center rounded-full bg-hero text-hero-ink">
            {busy ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
          </span>
          <span>
            <b className="block text-lg leading-tight font-bold">Take Photo</b>
            <span className="text-[13px] font-semibold text-on-a-muted">Receipt, label or manual</span>
          </span>
        </button>
        <button type="button" disabled={!!busy} onClick={() => picker.current?.click()} className={`${tile} bg-a1`}>
          <span className="flex size-12 items-center justify-center rounded-full bg-surface text-ink">
            <FileUp className="size-6" />
          </span>
          <span>
            <b className="block text-lg leading-tight font-bold">Choose Files</b>
            <span className="text-[13px] font-semibold text-on-a-muted">Photos or PDFs</span>
          </span>
        </button>
      </div>
      {busy ? (
        <p role="status" className="text-sm font-semibold text-muted-foreground">
          {busy}
        </p>
      ) : null}
      {/* capture="environment" opens the rear camera on phones; desktops just show a file picker */}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files)} />
      <input ref={picker} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
    </div>
  )
}
