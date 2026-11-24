"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowDown, ArrowUp, ChevronRight, FileText, ShieldAlert, ShieldCheck, ShieldX, Tag } from "lucide-react"
import { cn } from "cn"
import { withoutAdd } from "@/components/shell/header-action"
import { category, type WarrantyState } from "@/lib/fixtures"
import { money, plural } from "@/lib/format"
import type { FixtureCategory } from "@/generated/prisma/enums"
import { BLANK_FIXTURE, FixtureDrawer } from "./fixture-drawer"
import { CategoryTile } from "@/components/fixtures/category-tile"
import { DUE_TONE } from "@/lib/service"

export type FixtureCard = {
  id: string
  photo: string | null
  /** a service or rego that's due soon or overdue */
  due: { tone: "soon" | "overdue"; text: string } | null
  name: string
  category: FixtureCategory
  makeModel: string
  room: string | null
  roomId: string | null
  portable: boolean
  parts: number
  docs: number
  warranty: WarrantyState
  /** the lowest and highest recorded shop price, when it's tracked */
  prices: { low: number; high: number } | null
}

const WARRANTY_TONE = { ok: "bg-t3", soon: "bg-t2", expired: "bg-danger-soft text-danger", none: "" } as const

export function FixturesList({
  items,
  rooms,
  brands,
  canEdit,
  openAdd,
  presetRoom,
}: {
  items: FixtureCard[]
  rooms: { id: string; name: string }[]
  brands: string[]
  canEdit: boolean
  openAdd: boolean
  presetRoom: string | null
}) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  const [open, setOpen] = useState(openAdd && canEdit)
  // Add Item (beside the title) and the Add menu link here with ?add=1, even when this page is already open
  const [lastAdd, setLastAdd] = useState(openAdd)
  if (openAdd !== lastAdd) {
    setLastAdd(openAdd)
    if (openAdd && canEdit) setOpen(true)
  }
  const [initial] = useState(() => ({ ...BLANK_FIXTURE, spaceId: presetRoom }))
  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o && openAdd) router.replace(withoutAdd(path, params), { scroll: false }) // drop ?add=1 so a refresh doesn't reopen it
  }

  // grouped by room, in the rooms' own order; then portable items; items without a room last
  const groups = [
    ...rooms.map((r) => ({ id: r.id, name: r.name, list: items.filter((i) => i.roomId === r.id) })),
    { id: "portable", name: "Portable", list: items.filter((i) => !i.roomId && i.portable) },
    { id: "none", name: "No Room", list: items.filter((i) => !i.roomId && !i.portable) },
  ].filter((g) => g.list.length)

  return (
    <>
      {groups.map((g) => (
        <section key={g.id} className="flex flex-col gap-3">
          <h2>{g.name}</h2>
          <div className="grid grid-cols-1 gap-3 desk:grid-cols-3">
            {g.list.map((f) => {
              const c = category(f.category)
              return (
                <Link key={f.id} href={`/fixtures/${f.id}`} className="lift group flex flex-col gap-3 rounded-3xl bg-surface p-4">
                  <div className="flex items-center gap-3">
                    <CategoryTile value={f.category} src={f.photo} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-bold">{f.name}</span>
                      <span className="truncate text-xs font-medium text-muted-foreground">{f.makeModel || c.label}</span>
                    </span>
                    <ChevronRight className="cardarrow size-5 text-muted-foreground" />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                    {f.due ? <span className={cn("rounded-full px-2.5 py-1", DUE_TONE[f.due.tone])}>{f.due.text}</span> : null}
                    {f.warranty.tone !== "none" ? (
                      <span className={cn("flex items-center gap-1 rounded-full px-2.5 py-1", WARRANTY_TONE[f.warranty.tone])} title={f.warranty.text}>
                        <WarrantyIcon tone={f.warranty.tone} />
                        {f.warranty.date}
                        <span className="sr-only">{f.warranty.text}</span>
                      </span>
                    ) : null}
                    {f.parts ? <span className="rounded-full bg-surface2 px-2.5 py-1">{plural(f.parts, "part")}</span> : null}
                    <span className="flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1">
                      <FileText className="size-3.5" />
                      {f.docs}
                    </span>
                    {f.prices ? (
                      f.prices.low === f.prices.high ? (
                        <span className="flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1 tabular-nums" title="Shop price recorded (unchanged so far)">
                          <Tag className="size-3.5" />
                          {money(f.prices.low)}
                        </span>
                      ) : (
                        <>
                          <span className="flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1 tabular-nums" title="Lowest shop price recorded">
                            <ArrowDown className="size-3.5" />
                            <span className="sr-only">Lowest</span>
                            {money(f.prices.low)}
                          </span>
                          <span className="flex items-center gap-1 rounded-full bg-surface2 px-2.5 py-1 tabular-nums" title="Highest shop price recorded">
                            <ArrowUp className="size-3.5" />
                            <span className="sr-only">Highest</span>
                            {money(f.prices.high)}
                          </span>
                        </>
                      )
                    ) : null}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      ))}

      <FixtureDrawer open={open} onOpenChange={onOpenChange} initial={initial} rooms={rooms} brands={brands} />
    </>
  )
}

function WarrantyIcon({ tone }: { tone: WarrantyState["tone"] }) {
  const Icon = tone === "expired" ? ShieldX : tone === "soon" ? ShieldAlert : ShieldCheck
  return <Icon className="size-3.5" aria-hidden="true" />
}
