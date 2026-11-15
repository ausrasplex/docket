"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive, Camera, Check, FileUp, Globe, Inbox, Loader2, MoreHorizontal, Pencil, Plus, Unlink } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Drawer, FieldLabel } from "@/components/drawer"
import { DocumentRow, type DocLike } from "@/components/documents/document-row"
import { FileDrawer, type EditableDoc } from "@/components/documents/file-drawer"
import { AddLinkDrawer } from "@/components/documents/add-link-drawer"
import { docKind, LINK_ICON } from "@/lib/documents"
import { PART_ICON } from "@/lib/fixtures"
import type { DocumentKind } from "@/generated/prisma/enums"
import { fileTo, setDocumentArchived, unlink, type Target } from "../../documents/actions"

export type DocGroup = {
  target: Target
  name: string
  isPart: boolean
  docs: { linkId: string; label: string | null; doc: DocLike & { notes: string | null } }[]
}
export type InboxDoc = { id: string; title: string; kind: DocumentKind; hasThumb: boolean; isLink: boolean; when: string }

/** One section per part (plus the whole item), each with its own documents and ways to add more. */
export function DocGroups({ groups, inbox, canEdit }: { groups: DocGroup[]; inbox: InboxDoc[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<EditableDoc | null>(null)
  const [linkFor, setLinkFor] = useState<DocGroup | null>(null)
  const [inboxFor, setInboxFor] = useState<DocGroup | null>(null)
  const [, start] = useTransition()

  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) toast.error(r.error)
      else toast(done)
    })

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.target.id} className="flex flex-col gap-1">
          {groups.length > 1 ? (
            <h3 className="flex items-center gap-2 text-[15px] font-bold">
              {g.isPart ? <PART_ICON className="size-4 text-muted-foreground" /> : null}
              {g.name}
              <span className="text-xs font-semibold text-muted-foreground">{g.docs.length}</span>
            </h3>
          ) : null}
          {g.docs.length ? (
            <div className="flex flex-col">
              {g.docs.map((d) => (
                <DocumentRow
                  key={d.linkId}
                  doc={d.doc}
                  label={d.label}
                  trailing={
                    canEdit ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label={`Options for ${d.doc.title}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem
                            onSelect={() =>
                              setEditing({
                                id: d.doc.id,
                                title: d.doc.title,
                                kind: d.doc.kind,
                                notes: d.doc.notes,
                                documentDate: d.doc.documentDate ? d.doc.documentDate.toISOString().slice(0, 10) : null,
                                isLink: !!d.doc.url,
                              })
                            }
                          >
                            <Pencil />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => act(() => unlink(d.linkId), `Removed from ${g.name}`)}>
                            <Unlink />
                            Remove From {g.isPart ? "Part" : "Item"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant="destructive" onSelect={() => act(() => setDocumentArchived(d.doc.id, true), "Archived")}>
                            <Archive />
                            Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null
                  }
                />
              ))}
            </div>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">Nothing yet.</p>
          )}
          {canEdit ? <AddButtons group={g} onLink={() => setLinkFor(g)} onInbox={() => setInboxFor(g)} inboxCount={inbox.length} /> : null}
        </section>
      ))}

      <FileDrawer doc={editing} onOpenChange={(o) => !o && setEditing(null)} title="Edit Details" />
      <AddLinkDrawer
        open={!!linkFor}
        onOpenChange={(o) => !o && setLinkFor(null)}
        target={linkFor?.target}
        targetName={linkFor?.name}
      />
      <FromInbox group={inboxFor} inbox={inbox} onOpenChange={(o) => !o && setInboxFor(null)} />
    </div>
  )
}

/** Upload, photograph, link or pull from the inbox, straight into one group. */
function AddButtons({ group, onLink, onInbox, inboxCount }: { group: DocGroup; onLink: () => void; onInbox: () => void; inboxCount: number }) {
  const router = useRouter()
  const files = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function upload(list: FileList | null) {
    if (!list?.length) return
    setBusy(true)
    const fd = new FormData()
    ;[...list].forEach((f) => fd.append("files", f))
    fd.append("fixtureId", group.target.id)
    try {
      const r = await fetch("/api/documents", { method: "POST", body: fd })
      const j = (await r.json().catch(() => ({}))) as { created?: string[]; errors?: string[]; error?: string }
      if (j.error) toast.error(j.error)
      j.errors?.forEach((e) => toast.error(e))
      if (j.created?.length) toast(j.created.length === 1 ? `Added to ${group.name}` : `${j.created.length} files added to ${group.name}`)
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
          <Button variant="outline" size="sm" className="mt-1 self-start" disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />}
            {busy ? "Uploading…" : `Add to ${group.name}`}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuItem onSelect={() => files.current?.click()}>
            <FileUp />
            Upload PDF or Photo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => camera.current?.click()}>
            <Camera />
            Take Photo
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onLink}>
            <Globe />
            Add Web Link
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onInbox} disabled={!inboxCount}>
            <Inbox />
            From Capture Inbox
            {inboxCount ? <span className="ml-auto text-xs text-muted-foreground">{inboxCount}</span> : null}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input ref={files} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => upload(e.target.files)} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => upload(e.target.files)} />
    </>
  )
}

/** Pick captures from the inbox and file them to this item or part in one go. */
function FromInbox({ group, inbox, onOpenChange }: { group: DocGroup | null; inbox: InboxDoc[]; onOpenChange: (o: boolean) => void }) {
  const [picked, setPicked] = useState<string[]>([])
  const [label, setLabel] = useState("")
  const [pending, start] = useTransition()
  const [shown, setShown] = useState<DocGroup | null>(null)
  if (group !== shown) {
    setShown(group)
    setPicked([])
    setLabel("")
  }
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  return (
    <Drawer
      open={!!group}
      onOpenChange={onOpenChange}
      title="From Capture Inbox"
      description={group ? `Choose captures to file to ${group.name}.` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || !picked.length}
            onClick={() =>
              start(async () => {
                if (!group) return
                for (const id of picked) {
                  const r = await fileTo(id, group.target, label || null)
                  if (!r.ok) return void toast.error(r.error)
                }
                toast(`${picked.length === 1 ? "1 capture" : `${picked.length} captures`} filed to ${group.name}`)
                onOpenChange(false)
              })
            }
          >
            File {picked.length || ""}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-2.5">
        {inbox.map((d) => {
          const on = picked.includes(d.id)
          const Icon = d.isLink ? LINK_ICON : docKind(d.kind).icon
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(d.id)}
              className={cn("relative flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 bg-surface2 text-left", on ? "border-sel" : "border-transparent")}
            >
              <span className="flex aspect-[4/3] items-center justify-center bg-surface2 text-muted-foreground">
                {d.hasThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file
                  <img src={`/api/files/${d.id}?v=thumb`} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <Icon className="size-8" />
                )}
              </span>
              <span className="flex flex-col p-2.5">
                <b className="line-clamp-2 text-[13px] font-bold">{d.title}</b>
                <span className="text-xs text-muted-foreground">{d.when}</span>
              </span>
              {on ? (
                <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-sel text-white">
                  <Check className="size-4" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      {picked.length ? (
        <FieldLabel label="Label (optional)" hint="Applied to each one you file: “Installation manual”, “Receipt”.">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </FieldLabel>
      ) : null}
    </Drawer>
  )
}
