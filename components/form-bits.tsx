"use client"

import { useState } from "react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"
import { FieldLabel } from "@/components/drawer"
import { knownStores } from "@/app/(app)/store-actions"

// Small form pieces shared by the drawers (Folio style: titled sections, chip choices, brand suggestions).

export function Section({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="-mb-1 border-t border-line pt-4">
      <h3 className="text-[15px] font-bold">{title}</h3>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function Chips({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
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

/**
 * Where it was bought: type a shop, and shops used before (on any item or paint) are offered underneath,
 * like brands. They're fetched the first time the field is used.
 */
export function StoreField({ value, onChange, placeholder = "Bunnings" }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false)
  const [stores, setStores] = useState<string[] | null>(null)
  const load = () => {
    if (stores) return
    setStores([])
    knownStores()
      .then(setStores)
      .catch(() => setStores([]))
  }
  const q = value.trim().toLowerCase()
  const matches = (stores ?? []).filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q).slice(0, 8)
  return (
    <FieldLabel label="Where Bought" hint="The shop or supplier, for buying another to match.">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          setFocused(true)
          load()
        }}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      {focused && matches.length ? (
        <span className="flex flex-wrap gap-1.5">
          {matches.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onChange(s)}
              className="min-h-9 cursor-pointer rounded-full bg-t2 px-3 text-[13px] font-semibold hover:bg-a2"
            >
              {s}
            </button>
          ))}
        </span>
      ) : null}
    </FieldLabel>
  )
}

/** Type a brand; matching brands you've used before are offered underneath. */
export function BrandField({
  value,
  onChange,
  brands,
  placeholder = "Daikin",
}: {
  value: string
  onChange: (v: string) => void
  brands: string[]
  placeholder?: string
}) {
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
        placeholder={placeholder}
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
