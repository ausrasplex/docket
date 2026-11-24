"use client"

import { useState, useTransition } from "react"
import { CircleAlert, ExternalLink, History, Loader2, MoreHorizontal, Pencil, Plus, RefreshCw, Tags, Trash2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Drawer, FieldLabel } from "@/components/drawer"
import { PriceChart } from "@/components/prices/price-chart"
import { date, money } from "@/lib/format"
import type { SourceSummary } from "@/lib/prices"
import { addPriceSource, checkPriceNow, deletePriceCheck, deletePriceSource, updatePriceSource, type PriceSourceInput } from "../price-actions"

const ago = (d: Date | null) => {
  if (!d) return "never"
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 30 ? `${days} days ago` : date(new Date(d))
}

/**
 * Shop pages for this item, each checked about once a week: the current price, the lowest and highest recorded
 * (with when), and the price over time. Kept apart from the item's own values; the Insurance Report lists them
 * in a section of their own.
 */
export function PricesCard({ fixtureId, itemName, sources, canEdit, everyDays }: { fixtureId: string; itemName: string; sources: SourceSummary[]; canEdit: boolean; everyDays: number }) {
  const [editing, setEditing] = useState<SourceSummary | "new" | null>(null)
  return (
    <Card id="prices" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Prices</CardTitle>
        <CardDescription>
          Shop pages for this item, checked every {everyDays === 1 ? "day" : `${everyDays} days`}. The history only records changes.
        </CardDescription>
        {canEdit ? (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
              <Plus />
              Add Shop
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col">
        {sources.length ? (
          sources.map((s) => <SourceRow key={s.id} s={s} canEdit={canEdit} onEdit={() => setEditing(s)} />)
        ) : (
          <p className="rounded-2xl bg-surface2 px-4 py-3 text-sm text-muted-foreground">
            No shops yet. {canEdit ? `Add the product page at a shop that sells ${itemName}, and Docket keeps a record of its price.` : ""}
          </p>
        )}
      </CardContent>
      {canEdit ? <SourceDrawer fixtureId={fixtureId} editing={editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  )
}

function SourceRow({ s, canEdit, onEdit }: { s: SourceSummary; canEdit: boolean; onEdit: () => void }) {
  const [pending, start] = useTransition()
  const [showHistory, setShowHistory] = useState(false)
  const check = () =>
    start(async () => {
      const r = await checkPriceNow(s.id)
      if (r.ok) toast(`${s.store}: ${r.message}`)
      else toast.error(`${s.store}: ${r.error}`)
    })
  const remove = () =>
    start(async () => {
      const r = await deletePriceSource(s.id)
      if (r.ok) toast(`Stopped tracking ${s.store}`)
      else toast.error(r.error)
    })
  return (
    <div className="flex flex-col gap-2 border-t border-line py-3.5 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-3">
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-surface2">
          {pending ? <Loader2 className="size-[18px] animate-spin" /> : <Tags className="size-[18px]" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 truncate text-sm font-bold hover:underline">
            {s.store}
            <ExternalLink className="size-3.5 flex-none text-muted-foreground" />
          </a>
          <span className="text-xs font-medium text-muted-foreground">
            {s.latestAt ? `Checked ${ago(s.lastCheckedAt)}` : s.lastCheckedAt ? `Checked ${ago(s.lastCheckedAt)}, no price yet` : "Not checked yet"}
          </span>
        </span>
        <span className="flex flex-none flex-col items-end">
          <b className="text-[15px] font-bold tabular-nums">{s.latest != null ? money(s.latest, true) : "—"}</b>
          {s.latestAt && s.error ? <span className="text-xs font-medium text-muted-foreground">as of {date(new Date(s.latestAt))}</span> : null}
        </span>
        {canEdit ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9 flex-none" aria-label={`${s.store} options`} disabled={pending}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={check}>
                <RefreshCw />
                Check Now
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil />
                Edit
              </DropdownMenuItem>
              {s.history.length ? (
                <DropdownMenuItem onSelect={() => setShowHistory((v) => !v)}>
                  <History />
                  {showHistory ? "Hide History" : "Price History"}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={remove}>
                <Trash2 />
                Stop Tracking
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {s.error ? (
        <p className="flex items-start gap-2 rounded-2xl bg-danger-soft px-3 py-2 text-xs font-semibold text-danger">
          <CircleAlert className="mt-px size-4 flex-none" />
          <span>
            {s.error}
            {s.failingSince ? ` Failing since ${date(new Date(s.failingSince))}.` : ""}
          </span>
        </p>
      ) : null}
      {s.pending != null ? (
        <p className="rounded-2xl bg-surface2 px-3 py-2 text-xs font-medium text-muted-foreground">
          The last check read {money(s.pending, true)}, a big change. It&apos;s recorded if the next check reads the same.
        </p>
      ) : null}

      {s.low && s.high ? (
        <dl className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl bg-surface2 px-3 py-2">
            <dt className="font-semibold text-muted-foreground">Lowest recorded</dt>
            <dd className="font-bold tabular-nums">
              {money(s.low.price, true)} <span className="font-medium text-muted-foreground">· {date(new Date(s.low.at))}</span>
            </dd>
          </div>
          <div className="rounded-2xl bg-surface2 px-3 py-2">
            <dt className="font-semibold text-muted-foreground">Highest recorded</dt>
            <dd className="font-bold tabular-nums">
              {money(s.high.price, true)} <span className="font-medium text-muted-foreground">· {date(new Date(s.high.at))}</span>
            </dd>
          </div>
        </dl>
      ) : null}
      {s.history.length > 1 ? <PriceChart points={s.history} until={s.latestAt} label={s.store} /> : null}

      {showHistory ? (
        <ul className="flex flex-col rounded-2xl bg-surface2 px-3 py-1">
          {[...s.history].reverse().map((p) => (
            <HistoryRow key={p.id} id={p.id} price={p.price} at={p.at} inStock={p.inStock} canEdit={canEdit} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function HistoryRow({ id, price, at, inStock, canEdit }: { id: string; price: number; at: Date; inStock: boolean | null; canEdit: boolean }) {
  const [pending, start] = useTransition()
  return (
    <li className="flex items-center gap-2 border-t border-line py-1.5 text-xs first:border-t-0">
      <span className="flex-1 font-medium text-muted-foreground">
        {date(new Date(at))}
        {inStock === false ? " · out of stock" : ""}
      </span>
      <b className="tabular-nums">{money(price, true)}</b>
      {canEdit ? (
        <button
          type="button"
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-surface hover:text-danger"
          aria-label={`Delete the ${money(price, true)} reading`}
          title="Delete this reading (if it was read wrongly)"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await deletePriceCheck(id)
              if (r.ok) toast("Reading deleted")
              else toast.error(r.error)
            })
          }
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
        </button>
      ) : null}
    </li>
  )
}

function SourceDrawer({ fixtureId, editing, onClose }: { fixtureId: string; editing: SourceSummary | "new" | null; onClose: () => void }) {
  const open = editing !== null
  const init = (): PriceSourceInput =>
    editing && editing !== "new" ? { url: editing.url, label: editing.label ?? "", selector: editing.selector ?? "" } : { url: "", label: "", selector: "" }
  const [v, setV] = useState(init)
  const [was, setWas] = useState(editing)
  if (editing !== was) {
    setWas(editing)
    if (editing) setV(init())
  }
  const [pending, start] = useTransition()
  const set = (k: keyof PriceSourceInput, val: string) => setV((p) => ({ ...p, [k]: val }))
  const isNew = editing === "new"
  const save = () =>
    start(async () => {
      const r = isNew ? await addPriceSource(fixtureId, v) : await updatePriceSource((editing as SourceSummary).id, v)
      if (!r.ok) return void toast.error(r.error)
      if (r.error) toast.warning(r.message, { description: r.error })
      else toast(r.message)
      onClose()
    })
  return (
    <Drawer
      open={open}
      onOpenChange={(o) => (o ? null : onClose())}
      title={isNew ? "Track a Price" : "Edit Shop"}
      description="The product's page at a shop. Docket reads the price from it about once a week."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || !v.url.trim()} onClick={save}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {pending ? "Checking…" : isNew ? "Add and Check" : "Save"}
          </Button>
        </>
      }
    >
      <FieldLabel label="Product Page" hint="Copy the address from the shop's page for this exact model.">
        <Input value={v.url} onChange={(e) => set("url", e.target.value)} placeholder="jbhifi.com.au/products/…" inputMode="url" autoFocus />
      </FieldLabel>
      <FieldLabel label="Shop Name (optional)" hint="Shown in the report. The site's name is used when blank.">
        <Input value={v.label} onChange={(e) => set("label", e.target.value)} placeholder="JB Hi-Fi" />
      </FieldLabel>
      <FieldLabel
        label="Price Selector (optional)"
        hint="Only needed when the price isn't found: a CSS selector for the price on the page, like .product-price. Right-click the price in your browser and choose Inspect to find one."
      >
        <Input value={v.selector} onChange={(e) => set("selector", e.target.value)} placeholder=".price" className="font-mono text-[13px]" />
      </FieldLabel>
      {!isNew && editing && v.url.trim() && v.url.trim() !== editing.url ? (
        <p className="rounded-2xl bg-surface2 px-3 py-2 text-xs font-medium text-muted-foreground">A different page starts a new price history; this shop&apos;s readings so far are removed.</p>
      ) : null}
    </Drawer>
  )
}
