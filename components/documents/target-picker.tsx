"use client"

import { useState } from "react"
import { Check, DoorOpen, Hammer, Lamp, Paintbrush, Search } from "lucide-react"
import { cn } from "cn"
import type { Target } from "@/app/(app)/documents/actions"

export type TargetOption = { type: Target["type"]; id: string; name: string; detail?: string }

const same = (a: Target, b: Target) => a.type === b.type && a.id === b.id

/**
 * Items (with their parts) first, then rooms, jobs and finishes. A search box appears once the list gets long.
 * Picks one place, or with `multiple` ticks several; `pinned` places (where it's filed already) are listed first.
 */
export function TargetPicker({
  options,
  value,
  onChange,
  multiple = false,
  pinned = [],
  label = "File To",
}: {
  options: TargetOption[]
  value: Target[]
  onChange: (t: Target[]) => void
  multiple?: boolean
  pinned?: Target[]
  label?: string
}) {
  const [q, setQ] = useState("")
  const needle = q.trim().toLowerCase()
  const matched = needle ? options.filter((o) => `${o.name} ${o.detail ?? ""}`.toLowerCase().includes(needle)) : options
  const isPinned = (o: TargetOption) => pinned.some((p) => same(p, o))
  const shown = [...matched.filter(isPinned), ...matched.filter((o) => !isPinned(o))]
  const groups = [
    { title: "Items", icon: Lamp, list: shown.filter((o) => o.type === "fixture") },
    { title: "Rooms", icon: DoorOpen, list: shown.filter((o) => o.type === "space") },
    { title: "Jobs", icon: Hammer, list: shown.filter((o) => o.type === "job") },
    { title: "Paint and Finishes", icon: Paintbrush, list: shown.filter((o) => o.type === "finish") },
  ].filter((g) => g.list.length)

  const toggle = (o: TargetOption, on: boolean) => {
    const t = { type: o.type, id: o.id }
    if (multiple) onChange(on ? value.filter((v) => !same(v, t)) : [...value, t])
    else onChange(on ? [] : [t])
  }

  return (
    <div role={multiple ? "group" : "radiogroup"} aria-label={label} className="flex flex-col gap-2">
      <span className="text-[13px] font-bold text-muted-foreground">
        {label}
        {multiple && value.length ? <span className="font-semibold"> · {value.length} ticked</span> : null}
      </span>
      {options.length > 10 ? (
        <label className="flex h-11 items-center gap-2 rounded-full border border-line bg-surface2 px-3.5">
          <Search className="size-4 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a room or item" className="w-full bg-transparent text-base outline-none" />
        </label>
      ) : null}
      {!options.length ? <p className="text-sm text-muted-foreground">Add rooms or items first, then file to them.</p> : null}
      {groups.map((g) => (
        <div key={g.title} className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <g.icon className="size-3.5" />
            {g.title}
          </span>
          <div className="flex flex-wrap gap-2">
            {g.list.map((o) => {
              const on = value.some((v) => same(v, o))
              return (
                <button
                  key={o.type + o.id}
                  type="button"
                  role={multiple ? "checkbox" : "radio"}
                  aria-checked={on}
                  onClick={() => toggle(o, on)}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-left text-[13px] font-semibold",
                    on ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2"
                  )}
                >
                  {multiple && on ? <Check className="size-4 flex-none" /> : null}
                  <span>
                    {o.name}
                    {o.detail ? <span className={cn("font-medium", on ? "opacity-80" : "text-muted-foreground")}> · {o.detail}</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ))}
      {needle && !groups.length ? <p className="text-sm text-muted-foreground">Nothing matches “{q}”.</p> : null}
    </div>
  )
}
