"use client"

import { useMemo, useState, useTransition } from "react"
import { Check, Search } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { setDocumentSet } from "../doc-set-actions"

export type ShareCandidate = { id: string; name: string; detail: string; inSet: boolean }

/**
 * Share Documents With: tick the other copies of this product. Manuals, warranties and links then follow
 * across all of them; receipts, invoices and photos stay on the copy they were added to.
 */
export function ShareDocsDialog({
  open,
  onOpenChange,
  id,
  name,
  candidates,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  id: string
  name: string
  candidates: ShareCandidate[]
}) {
  const initial = useMemo(() => new Set(candidates.filter((x) => x.inSet).map((x) => x.id)), [candidates])
  const [picked, setPicked] = useState(initial)
  const [q, setQ] = useState("")
  const [pending, start] = useTransition()

  const close = (o: boolean) => {
    if (pending) return
    onOpenChange(o)
    if (!o) {
      setPicked(initial)
      setQ("")
    }
  }
  const toggle = (x: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(x)) n.delete(x)
      else n.add(x)
      return n
    })
  const needle = q.trim().toLowerCase()
  const shown = needle ? candidates.filter((x) => `${x.name} ${x.detail}`.toLowerCase().includes(needle)) : candidates
  const changed = picked.size !== initial.size || [...picked].some((x) => !initial.has(x))

  const submit = () =>
    start(async () => {
      const r = await setDocumentSet(id, [...picked])
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast(picked.size ? `${name} shares documents with ${picked.size === 1 ? "1 other item" : `${picked.size} other items`}` : `${name} no longer shares documents`)
      onOpenChange(false)
      setQ("")
    })

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[min(720px,calc(100dvh-2rem))] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="gap-1 px-6 pt-6 pb-3 pr-14">
          <DialogTitle className="text-lg font-bold">Share Documents</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            Pick the other copies of this {name}. Manuals, warranties and links added to any of them appear on all of them. Receipts, invoices and photos stay on the item they were added to.
          </DialogDescription>
        </DialogHeader>
        {candidates.length > 8 ? (
          <div className="px-6 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an item" aria-label="Find an item" className="bg-surface pl-10" />
            </div>
          </div>
        ) : null}
        <div role="group" aria-label="Items" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-6 pt-1 pb-5">
          {candidates.length ? null : <p className="text-sm text-muted-foreground">There are no other items yet. Duplicate this one to add copies.</p>}
          {candidates.length && !shown.length ? <p className="text-sm text-muted-foreground">No items match.</p> : null}
          {shown.map((x) => {
            const on = picked.has(x.id)
            return (
              <button
                key={x.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(x.id)}
                className={cn(
                  "flex min-h-13 w-full cursor-pointer items-center gap-3 rounded-xl border-2 bg-surface2 px-3.5 py-2 text-left hover:bg-t1",
                  on ? "border-sel" : "border-transparent",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-5 flex-none items-center justify-center rounded-[5px] border-2",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-outline bg-surface",
                  )}
                >
                  {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-sm font-bold">{x.name}</b>
                  {x.detail ? <span className="truncate text-xs font-medium text-muted-foreground">{x.detail}</span> : null}
                </span>
              </button>
            )
          })}
        </div>
        <DialogFooter className="mx-0 mb-0 flex-row gap-2.5 [&>*]:flex-1 sm:[&>*]:flex-none">
          <Button variant="outline" onClick={() => close(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!changed || pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
