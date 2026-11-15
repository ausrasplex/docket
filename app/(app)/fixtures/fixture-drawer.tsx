"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, FieldLabel } from "@/components/drawer"
import { CATEGORIES } from "@/lib/fixtures"
import { createFixture, updateFixture, type FixtureInput } from "./actions"

const TONE = { a1: "bg-a1", a2: "bg-a2", a3: "bg-a3" } as const

export const BLANK_FIXTURE: FixtureInput = {
  name: "",
  category: "APPLIANCE",
  spaceId: null,
  brand: "",
  model: "",
  serial: "",
  productUrl: "",
  purchasedAt: null,
  installedAt: null,
  warrantyExpiresAt: null,
  purchasePrice: "",
  replacementValue: "",
  includedInSale: true,
  notes: "",
}

/**
 * Add or edit an item, or a part of one (`parent`). Parts skip the category and default to the
 * item's room; everything else (brand, model, serial, warranty) is per part.
 */
export function FixtureDrawer({
  open,
  onOpenChange,
  initial,
  editingId,
  parent,
  rooms,
  brands,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: FixtureInput
  editingId?: string
  parent?: { id: string; name: string }
  rooms: { id: string; name: string }[]
  brands: string[]
}) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [pending, start] = useTransition()
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setV(initial)
  }
  const set = <K extends keyof FixtureInput>(k: K, val: FixtureInput[K]) => setV((p) => ({ ...p, [k]: val }))
  const isPart = !!parent
  const what = isPart ? "Part" : "Item"

  const save = () =>
    start(async () => {
      const r = editingId ? await updateFixture(editingId, v) : await createFixture(v, parent?.id ?? null)
      if (!r.ok) return void toast.error(r.error)
      toast(editingId ? "Saved" : `${v.name.trim()} added`)
      onOpenChange(false)
      if (!editingId && !isPart && "id" in r) router.push(`/fixtures/${r.id}`)
    })

  /** Warranty end from the purchase (or install) date plus N years. */
  const plusYears = (n: number) => {
    const from = v.purchasedAt ?? v.installedAt
    if (!from) return toast("Add the purchase date first")
    const d = new Date(`${from}T00:00:00Z`)
    d.setUTCFullYear(d.getUTCFullYear() + n)
    set("warrantyExpiresAt", d.toISOString().slice(0, 10))
  }

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={editingId ? `Edit ${what}` : isPart ? `Add Part to ${parent!.name}` : "Add Item"}
      description={
        editingId
          ? undefined
          : isPart
            ? "A piece with its own model, serial or manual: the outdoor unit, the remote, the GPU."
            : "An appliance, tap, light, system or anything else worth keeping records for."
      }
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending || !v.name.trim()} onClick={save}>
            {editingId ? "Save" : `Add ${what}`}
          </Button>
        </>
      }
    >
      <FieldLabel label="Name">
        <Input
          value={v.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder={isPart ? "Outdoor unit" : "Split system air conditioner"}
          autoFocus
        />
      </FieldLabel>

      {!isPart ? (
        <Chips label="Category">
          {CATEGORIES.map((c) => (
            <Chip key={c.id} on={v.category === c.id} onClick={() => set("category", c.id)}>
              <span className={cn("flex size-6 items-center justify-center rounded-full text-on-a", TONE[c.tone])}>
                <c.icon className="size-3.5" />
              </span>
              {c.label}
            </Chip>
          ))}
        </Chips>
      ) : null}

      <Chips label={isPart ? "Room (if different from the item)" : "Room"}>
        <Chip on={!v.spaceId} onClick={() => set("spaceId", null)}>
          {isPart ? "Same as item" : "None"}
        </Chip>
        {rooms.map((r) => (
          <Chip key={r.id} on={v.spaceId === r.id} onClick={() => set("spaceId", r.id)}>
            {r.name}
          </Chip>
        ))}
      </Chips>

      <Section title="Make and Model" />
      <BrandField value={v.brand} onChange={(b) => set("brand", b)} brands={brands} />
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Model">
          <Input value={v.model} onChange={(e) => set("model", e.target.value)} placeholder="FTXM50WVMA" />
        </FieldLabel>
        <FieldLabel label="Serial">
          <Input value={v.serial} onChange={(e) => set("serial", e.target.value)} />
        </FieldLabel>
      </div>
      <FieldLabel label="Product Page (optional)" hint="This exact model on the maker's site. The brand's support site is set once on the brand.">
        <Input value={v.productUrl} onChange={(e) => set("productUrl", e.target.value)} placeholder="daikin.com.au/products/…" inputMode="url" />
      </FieldLabel>

      <Section title="Dates and Warranty" />
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Bought">
          <Input type="date" value={v.purchasedAt ?? ""} onChange={(e) => set("purchasedAt", e.target.value || null)} />
        </FieldLabel>
        <FieldLabel label="Installed">
          <Input type="date" value={v.installedAt ?? ""} onChange={(e) => set("installedAt", e.target.value || null)} />
        </FieldLabel>
      </div>
      <FieldLabel label="Warranty Ends">
        <Input type="date" value={v.warrantyExpiresAt ?? ""} onChange={(e) => set("warrantyExpiresAt", e.target.value || null)} />
      </FieldLabel>
      <div className="-mt-2 flex flex-wrap gap-2">
        {[1, 2, 5, 7].map((n) => (
          <Button key={n} type="button" variant="outline" size="xs" onClick={() => plusYears(n)}>
            +{n} year{n > 1 ? "s" : ""}
          </Button>
        ))}
      </div>

      <Section title="Value" hint="Used by the insurance and sale exports." />
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Price Paid">
          <Input value={v.purchasePrice} onChange={(e) => set("purchasePrice", e.target.value)} inputMode="decimal" placeholder="$" />
        </FieldLabel>
        <FieldLabel label="Replacement Cost">
          <Input value={v.replacementValue} onChange={(e) => set("replacementValue", e.target.value)} inputMode="decimal" placeholder="$" />
        </FieldLabel>
      </div>
      <label className="flex min-h-15 cursor-pointer items-center gap-3 rounded-xl bg-surface2 px-3.5 py-2.5">
        <input type="checkbox" checked={v.includedInSale} onChange={(e) => set("includedInSale", e.target.checked)} className="size-5 accent-[var(--sel)]" />
        <span className="flex flex-col">
          <b className="text-sm">Stays With the House</b>
          <span className="text-xs text-muted-foreground">Fixed in place, so it&apos;s included if you sell. Untick for things you&apos;d take with you.</span>
        </span>
      </label>

      <FieldLabel label="Notes (optional)">
        <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Filter sizes, settings, quirks" />
      </FieldLabel>
    </Drawer>
  )
}

function Section({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="-mb-1 border-t border-line pt-4">
      <h3 className="text-[15px] font-bold">{title}</h3>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function Chips({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold",
        on ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2"
      )}
    >
      {children}
    </button>
  )
}

/** Type a brand; matching brands you've used before are offered underneath. */
function BrandField({ value, onChange, brands }: { value: string; onChange: (v: string) => void; brands: string[] }) {
  const [focused, setFocused] = useState(false)
  const q = value.trim().toLowerCase()
  const matches = brands.filter((b) => b.toLowerCase().includes(q) && b.toLowerCase() !== q).slice(0, 6)
  const known = brands.some((b) => b.toLowerCase() === q)
  return (
    <FieldLabel label="Brand" hint={q && !known ? `“${value.trim()}” will be added as a new brand.` : undefined}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Daikin"
        autoComplete="off"
      />
      {focused && matches.length ? (
        <span className="flex flex-wrap gap-1.5">
          {matches.map((b) => (
            <button
              key={b}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(b)}
              className="min-h-9 cursor-pointer rounded-full bg-t1 px-3 text-[13px] font-semibold hover:bg-a1"
            >
              {b}
            </button>
          ))}
        </span>
      ) : null}
    </FieldLabel>
  )
}
