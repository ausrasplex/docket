"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, FieldLabel } from "@/components/drawer"
import { BrandField, Chip, Chips, Section } from "@/components/form-bits"
import { CATEGORIES } from "@/lib/fixtures"
import { createFixture, updateFixture, type FixtureInput } from "./actions"

const TONE = { a1: "bg-a1", a2: "bg-a2", a3: "bg-a3" } as const

export const BLANK_FIXTURE: FixtureInput = {
  name: "",
  category: "APPLIANCE",
  spaceId: null,
  portable: false,
  brand: "",
  model: "",
  serial: "",
  productUrl: "",
  store: "",
  colour: "",
  size: "",
  purchasedAt: null,
  installedAt: null,
  warrantyExpiresAt: null,
  purchasePrice: "",
  replacementValue: "",
  includedInSale: true,
  notes: "",
  registration: "",
  vin: "",
  registrationExpiresAt: null,
  odometer: "",
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
        <Chip on={!v.spaceId && !v.portable} onClick={() => setV((p) => ({ ...p, spaceId: null, portable: false }))}>
          {isPart ? "Same as item" : "None"}
        </Chip>
        {isPart ? null : (
          <Chip
            on={v.portable}
            // portable things are usually contents you'd take with you, so that box is unticked too (it can be ticked again)
            onClick={() => setV((p) => (p.portable ? p : { ...p, spaceId: null, portable: true, includedInSale: false }))}
          >
            Portable
          </Chip>
        )}
        {rooms.map((r) => (
          <Chip key={r.id} on={v.spaceId === r.id} onClick={() => setV((p) => ({ ...p, spaceId: r.id, portable: false }))}>
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

      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Colour / Finish">
          <Input value={v.colour} onChange={(e) => set("colour", e.target.value)} placeholder="White, brushed nickel" />
        </FieldLabel>
        <FieldLabel label="Size">
          <Input value={v.size} onChange={(e) => set("size", e.target.value)} placeholder="90mm cutout, 8kW" />
        </FieldLabel>
      </div>
      <FieldLabel label="Where Bought" hint="The shop or supplier, for buying another to match.">
        <Input value={v.store} onChange={(e) => set("store", e.target.value)} placeholder="Bunnings, Tradelink" />
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

      {v.category === "VEHICLE" && !isPart ? (
        <>
          <Section title="Vehicle" />
          <div className="grid grid-cols-2 gap-3">
            <FieldLabel label="Registration">
              <Input value={v.registration} onChange={(e) => set("registration", e.target.value)} placeholder="ABC123" autoCapitalize="characters" />
            </FieldLabel>
            <FieldLabel label="Rego Expires">
              <Input type="date" value={v.registrationExpiresAt ?? ""} onChange={(e) => set("registrationExpiresAt", e.target.value || null)} />
            </FieldLabel>
          </div>
          <FieldLabel label="VIN">
            <Input value={v.vin} onChange={(e) => set("vin", e.target.value)} autoCapitalize="characters" className="font-mono" />
          </FieldLabel>
          <FieldLabel label="Odometer (km)" hint="Updated automatically when you log a service with a reading.">
            <Input value={v.odometer} onChange={(e) => set("odometer", e.target.value)} inputMode="numeric" placeholder="84250" />
          </FieldLabel>
        </>
      ) : null}

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
