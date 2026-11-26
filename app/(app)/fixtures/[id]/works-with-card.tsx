"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Check, ChevronRight, Link2, Search } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Drawer } from "@/components/drawer"
import { CategoryTile } from "@/components/fixtures/category-tile"
import type { FixtureCategory } from "@/generated/prisma/enums"
import { setWorksWith } from "../works-with-actions"
import { useIntent } from "@/components/shell/intent"

export type WorksWithItem = { id: string; name: string; detail: string; category: FixtureCategory; src: string | null; archived: boolean; linked: boolean }

/**
 * The items this one is used with but isn't part of: the battery that fits several cordless appliances,
 * a shared charger or remote. Each is its own item; the link shows on both pages.
 */
export function WorksWithList({ id, name, items, canEdit }: { id: string; name: string; items: WorksWithItem[]; canEdit: boolean }) {
  const linked = items.filter((x) => x.linked && !x.archived)
  const intent = useIntent("works-with")
  const [open, setOpen] = useState(intent.hit && canEdit)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(items.filter((x) => x.linked).map((x) => x.id)))
  const [q, setQ] = useState("")
  const [pending, start] = useTransition()

  const openPicker = () => {
    setPicked(new Set(items.filter((x) => x.linked).map((x) => x.id)))
    setQ("")
    setOpen(true)
  }
  const toggle = (x: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(x)) n.delete(x)
      else n.add(x)
      return n
    })
  const needle = q.trim().toLowerCase()
  // ticked ones first, then the rest; archived items only appear while they're still linked
  const choices = items.filter((x) => !x.archived || x.linked)
  const matched = needle ? choices.filter((x) => `${x.name} ${x.detail}`.toLowerCase().includes(needle)) : choices
  const shown = [...matched.filter((x) => x.linked), ...matched.filter((x) => !x.linked)]
  const changed = items.some((x) => x.linked !== picked.has(x.id))

  const save = () =>
    start(async () => {
      const r = await setWorksWith(id, [...picked])
      if (!r.ok) return void toast.error(r.error)
      toast("Saved")
      setOpen(false)
      intent.clear()
    })

  return (
    <div className="flex flex-col gap-3">
      {linked.length ? (
        <ul className="flex flex-col">
          {linked.map((x) => (
            <li key={x.id} className="border-t border-line first:border-t-0">
              <Link href={`/fixtures/${x.id}`} className="flex items-center gap-3 py-3 hover:opacity-80">
                <CategoryTile value={x.category} src={x.src} className="size-10 rounded-xl" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-bold">{x.name}</span>
                  {x.detail ? <span className="truncate text-xs font-medium text-muted-foreground">{x.detail}</span> : null}
                </span>
                <ChevronRight className="size-4 flex-none text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-surface2 px-4 py-3 text-sm text-muted-foreground">
          Nothing linked. Use this for things shared between items, like a cordless battery that fits several appliances, or a charger.
        </p>
      )}
      {canEdit ? (
        <Button variant="outline" className="self-start" onClick={openPicker}>
          <Link2 />
          {linked.length ? "Change Items" : "Choose Items"}
        </Button>
      ) : null}

      <Drawer
        open={open}
        onOpenChange={(o) => {
          if (pending) return
          setOpen(o)
          if (!o) intent.clear()
        }}
        title="Works With"
        description={`Tick everything ${name} is used with. It shows on their pages too.`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={pending || !changed} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        {choices.length > 8 ? (
          <label className="flex h-11 flex-none items-center gap-2 rounded-full border border-line bg-surface2 px-3.5">
            <Search className="size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an item" className="w-full bg-transparent text-base outline-none" />
          </label>
        ) : null}
        {!choices.length ? <p className="text-sm text-muted-foreground">Add another item first, then link them here.</p> : null}
        <div role="group" aria-label="Works with" className="-mx-2 flex flex-col">
          {shown.map((x) => {
            const on = picked.has(x.id)
            return (
              <button
                key={x.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(x.id)}
                className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm hover:bg-surface2"
              >
                <span
                  className={cn(
                    "flex size-5 flex-none items-center justify-center rounded-[6px] border",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-outline bg-surface"
                  )}
                >
                  {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                </span>
                <CategoryTile value={x.category} src={x.src} className="size-9 rounded-lg" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">{x.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{[x.archived ? "Archived" : null, x.detail].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            )
          })}
          {needle && !shown.length ? <p className="px-2 text-sm text-muted-foreground">Nothing matches “{q}”.</p> : null}
        </div>
      </Drawer>
    </div>
  )
}
