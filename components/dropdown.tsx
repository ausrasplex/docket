"use client"

import { useId, useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "cn"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Radix Select can't hold an empty value, so "none" gets its own. */
export const NONE = "__none"

/** A labelled single-choice dropdown in the drawer's field style; children are SelectItems. */
export function Dropdown({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-[13px] font-bold text-muted-foreground">
        {label}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-labelledby={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" className="max-h-80">
          {children}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * A dropdown over a list of words that can also be left blank ("" is the `none` choice). A saved value that's no
 * longer in the list still shows, so editing an old record doesn't lose it.
 */
export function WordDropdown({ label, value, onChange, options, none = "None" }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[]; none?: string }) {
  const all = value && !options.includes(value) ? [...options, value] : options
  return (
    <Dropdown label={label} value={value || NONE} onChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectItem value={NONE}>{none}</SelectItem>
      <SelectSeparator />
      {all.map((o) => (
        <SelectItem key={o} value={o}>
          {o}
        </SelectItem>
      ))}
    </Dropdown>
  )
}

/**
 * A labelled dropdown that ticks several: closed, it lists what's ticked; open, a checkbox list in place
 * (not a floating menu, so it scrolls properly inside a drawer).
 */
export function MultiDropdown({
  label,
  options,
  value,
  onChange,
  placeholder = "None ticked",
}: {
  label: string
  options: { id: string; name: string }[]
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ticked = options.filter((o) => value.includes(o.id))
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-muted-foreground">
        {label}
        {ticked.length > 1 ? <span className="font-semibold"> · {ticked.length} ticked</span> : null}
      </span>
      <div className="overflow-hidden rounded-md border border-line bg-surface2">
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-12 w-full cursor-pointer items-center gap-2 pr-3 pl-3.5 text-left">
          <span className={cn("min-w-0 flex-1 truncate text-base", ticked.length ? "" : "text-muted-foreground")}>
            {ticked.length ? ticked.map((o) => o.name).join(", ") : placeholder}
          </span>
          <ChevronDown className={cn("size-4 flex-none text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
        {open ? (
          <div role="group" aria-label={label} className="flex max-h-64 flex-col overflow-y-auto border-t border-line bg-surface p-1.5">
            {options.map((o) => {
              const on = value.includes(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])}
                  className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-sm font-semibold hover:bg-surface2"
                >
                  <span
                    className={cn(
                      "flex size-5 flex-none items-center justify-center rounded-[6px] border",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-outline bg-surface"
                    )}
                  >
                    {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                  </span>
                  {o.name}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}
