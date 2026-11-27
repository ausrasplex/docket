"use client"

import { useState, useTransition } from "react"
import { Minus, MoreHorizontal, Pencil, Plus, RefreshCw, ShoppingCart, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Drawer, FieldLabel } from "@/components/drawer"
import { CopyText } from "@/components/copy-text"
import { useIntent } from "@/components/shell/intent"
import { DUE_TONE, type DueTone } from "@/lib/service"
import { adjustSpare, createSpare, deleteSpare, replacedSpare, updateSpare, type SpareInput } from "../spare-actions"

export type SpareRow = {
  id: string
  name: string
  partNumber: string | null
  buyUrl: string | null
  onHand: number
  stock: { low: boolean; text: string }
  /** "Every 6 months", or null when it's only replaced when needed */
  interval: string | null
  lastReplaced: string | null
  due: { tone: DueTone; text: string }
  notes: string | null
  input: SpareInput
}

const today = () => new Date().toISOString().slice(0, 10)
const BLANK: SpareInput = { name: "", partNumber: "", buyUrl: "", onHand: "0", lowAt: "", everyMonths: "", lastReplacedAt: null, notes: "" }

/**
 * Spares and Consumables: the filters, bulbs, bags and batteries an item gets through. Each has its part
 * number, where to buy it and how many are on hand; Replaced takes one from stock and restarts its interval.
 */
export function SparesCard({ fixtureId, name, spares, canEdit }: { fixtureId: string; name: string; spares: SpareRow[]; canEdit: boolean }) {
  const intent = useIntent("spare")
  const [editing, setEditing] = useState<{ id: string | null; v: SpareInput } | null>(intent.hit && canEdit ? { id: null, v: BLANK } : null)
  const [pending, start] = useTransition()
  const set = <K extends keyof SpareInput>(k: K, val: SpareInput[K]) => setEditing((e) => (e ? { ...e, v: { ...e.v, [k]: val } } : e))

  const close = () => {
    setEditing(null)
    intent.clear()
  }
  const save = () =>
    start(async () => {
      if (!editing) return
      const r = editing.id ? await updateSpare(editing.id, editing.v) : await createSpare(fixtureId, editing.v)
      if (!r.ok) return void toast.error(r.error)
      toast(editing.id ? "Saved" : `${editing.v.name.trim()} added`)
      close()
    })
  const replaced = (s: SpareRow) =>
    start(async () => {
      const r = await replacedSpare(s.id)
      if (!r.ok) return void toast.error(r.error)
      toast(s.onHand === 0 ? `${s.name} replaced. None were in stock.` : `${s.name} replaced. ${r.left === 0 ? "That was the last one." : `${r.left} left.`}`)
    })
  const adjust = (s: SpareRow, by: number) =>
    start(async () => {
      const r = await adjustSpare(s.id, by)
      if (!r.ok) toast.error(r.error)
    })
  const remove = (s: SpareRow) =>
    start(async () => {
      const r = await deleteSpare(s.id)
      if (!r.ok) return void toast.error(r.error)
      toast(`${s.name} removed`)
    })

  const v = editing?.v

  return (
    <div className="flex flex-col gap-3">
      {spares.length ? (
        <ul className="flex flex-col">
          {spares.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0 first:pt-0">
              <div className="flex items-start gap-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-bold">{s.name}</span>
                  {s.partNumber ? (
                    <span className="font-mono text-[13px] text-muted-foreground">
                      <CopyText value={s.partNumber} label="Part number" />
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {[s.interval, s.lastReplaced ? `last replaced ${s.lastReplaced}` : null].filter(Boolean).join(" · ") || "Replaced when needed"}
                    {s.notes ? ` · ${s.notes}` : ""}
                  </span>
                </span>
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`${s.name} options`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setEditing({ id: s.id, v: s.input })}>
                        <Pencil />
                        Edit Spare
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => remove(s)}>
                        <Trash2 />
                        Remove Spare
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", s.stock.low ? (s.onHand === 0 ? DUE_TONE.overdue : DUE_TONE.soon) : DUE_TONE.none)}>{s.stock.text}</span>
                {s.due.tone !== "none" ? <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", DUE_TONE[s.due.tone])}>{s.due.text}</span> : null}
              </div>
              {canEdit || s.buyUrl ? (
                <div className="flex flex-wrap items-center gap-2">
                  {canEdit ? (
                    <>
                      <Button variant="outline" size="xs" disabled={pending} onClick={() => replaced(s)}>
                        <RefreshCw />
                        Replaced
                      </Button>
                      <span className="flex items-center rounded-full border border-outline">
                        <Button variant="ghost" size="icon-xs" aria-label="One fewer" disabled={pending || s.onHand === 0} onClick={() => adjust(s, -1)}>
                          <Minus />
                        </Button>
                        <span className="min-w-8 text-center text-xs font-bold tabular-nums">{s.onHand}</span>
                        <Button variant="ghost" size="icon-xs" aria-label="One more" disabled={pending} onClick={() => adjust(s, 1)}>
                          <Plus />
                        </Button>
                      </span>
                    </>
                  ) : null}
                  {s.buyUrl ? (
                    <a href={s.buyUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-9 items-center gap-1.5 rounded-full border border-outline px-3 text-xs font-semibold hover:bg-surface2">
                      <ShoppingCart className="size-4" />
                      Buy More
                    </a>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-surface2 px-4 py-3 text-sm text-muted-foreground">Nothing yet. Add the filters, bulbs, bags or batteries it uses, so the part number is here when you need more.</p>
      )}

      {canEdit ? (
        <div>
          <Button variant="outline" onClick={() => setEditing({ id: null, v: BLANK })}>
            <Plus />
            Add Spare
          </Button>
        </div>
      ) : null}

      <Drawer
        open={!!editing}
        onOpenChange={(o) => !o && !pending && close()}
        title={editing?.id ? `Edit ${editing.v.name || "Spare"}` : `Add a Spare for ${name}`}
        description="A filter, bulb, bag, battery or anything else it gets through."
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button disabled={pending || !v?.name.trim()} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        {v ? (
          <>
            <FieldLabel label="What Is It">
              <Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Water Filter" autoFocus={!editing?.id} />
            </FieldLabel>
            <FieldLabel label="Part Number (optional)">
              <Input value={v.partNumber} onChange={(e) => set("partNumber", e.target.value)} placeholder="DA29-00020B" className="font-mono" />
            </FieldLabel>
            <FieldLabel label="Where to Buy (optional)">
              <Input value={v.buyUrl} onChange={(e) => set("buyUrl", e.target.value)} placeholder="bunnings.com.au/…" inputMode="url" />
            </FieldLabel>
            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="On Hand">
                <Input value={v.onHand} onChange={(e) => set("onHand", e.target.value)} inputMode="numeric" />
              </FieldLabel>
              <FieldLabel label="Running Low At (optional)">
                <Input value={v.lowAt} onChange={(e) => set("lowAt", e.target.value)} inputMode="numeric" placeholder="1" />
              </FieldLabel>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldLabel label="Replace Every (months)">
                <Input value={v.everyMonths} onChange={(e) => set("everyMonths", e.target.value)} inputMode="numeric" placeholder="When needed" />
              </FieldLabel>
              <FieldLabel label="Last Replaced (optional)">
                <Input type="date" value={v.lastReplacedAt ?? ""} max={today()} onChange={(e) => set("lastReplacedAt", e.target.value || null)} />
              </FieldLabel>
            </div>
            <FieldLabel label="Notes (optional)">
              <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Two in the cupboard above the fridge" />
            </FieldLabel>
          </>
        ) : null}
      </Drawer>
    </div>
  )
}
