"use client"

import { useState, useTransition } from "react"
import { Globe } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Drawer, FieldLabel } from "@/components/drawer"
import { DOC_KINDS } from "@/lib/documents"
import type { DocumentKind } from "@/generated/prisma/enums"
import { addWebLink } from "./actions"

const LINK_KINDS: DocumentKind[] = ["MANUAL", "SUPPORT", "SOFTWARE", "SPEC_SHEET", "WARRANTY", "OTHER"]

/** Save a web page as a document: an online manual, support page or driver download. */
export function AddLink({ rooms }: { rooms: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [kind, setKind] = useState<DocumentKind>("MANUAL")
  const [roomId, setRoomId] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const reset = () => {
    setUrl("")
    setTitle("")
    setKind("MANUAL")
    setRoomId(null)
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Globe />
        Add Web Link
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Add Web Link"
        description="An online manual, a support page or a driver download."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending || !url.trim()}
              onClick={() =>
                start(async () => {
                  const r = await addWebLink({ url, title, kind, spaceId: roomId })
                  if (!r.ok) return void toast.error(r.error)
                  toast("Link saved")
                  reset()
                  setOpen(false)
                })
              }
            >
              Save Link
            </Button>
          </>
        }
      >
        <FieldLabel label="Web Address">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="daikin.com.au/support" inputMode="url" autoFocus />
        </FieldLabel>
        <FieldLabel label="Title (optional)" hint="Leave blank to use the site's name.">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Daikin online manuals" />
        </FieldLabel>
        <div role="radiogroup" aria-label="What is it?" className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-muted-foreground">What Is It?</span>
          <div className="flex flex-wrap gap-2">
            {DOC_KINDS.filter((k) => LINK_KINDS.includes(k.id)).map((k) => (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={kind === k.id}
                onClick={() => setKind(k.id)}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold",
                  kind === k.id ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2"
                )}
              >
                <k.icon className="size-4" />
                {k.label}
              </button>
            ))}
          </div>
        </div>
        {rooms.length ? (
          <div role="radiogroup" aria-label="File to" className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-muted-foreground">File To (optional)</span>
            <div className="flex flex-wrap gap-2">
              {rooms.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={roomId === r.id}
                  onClick={() => setRoomId(roomId === r.id ? null : r.id)}
                  className={cn(
                    "min-h-10 cursor-pointer rounded-full px-3.5 text-[13px] font-semibold",
                    roomId === r.id ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2"
                  )}
                >
                  {r.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  )
}
