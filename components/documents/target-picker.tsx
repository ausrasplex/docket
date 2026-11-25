"use client"

import { useState } from "react"
import { Check, ChevronDown, DoorOpen, Hammer, Lamp, Paintbrush, Search } from "lucide-react"
import { cn } from "cn"
import type { Target } from "@/app/(app)/documents/actions"

export type TargetOption = { type: Target["type"]; id: string; name: string; detail?: string }

const same = (a: Target, b: Target) => a.type === b.type && a.id === b.id

const GROUPS = [
  { type: "fixture", title: "Items", icon: Lamp },
  { type: "space", title: "Rooms", icon: DoorOpen },
  { type: "job", title: "Jobs", icon: Hammer },
  { type: "finish", title: "Paint and Finishes", icon: Paintbrush },
] as const

/**
 * Items (with their parts), rooms, jobs and finishes, each as a dropdown that opens in place (one at a time)
 * and shows what's ticked when closed. A search box appears once the list gets long; searching opens every
 * group with a match. Picks one place, or with `multiple` ticks several; `pinned` places are listed first.
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
  const [open, setOpen] = useState<string | null>(null)
  const needle = q.trim().toLowerCase()
  const matched = needle ? options.filter((o) => `${o.name} ${o.detail ?? ""}`.toLowerCase().includes(needle)) : options
  const isPinned = (o: TargetOption) => pinned.some((p) => same(p, o))
  const shown = [...matched.filter(isPinned), ...matched.filter((o) => !isPinned(o))]
  const groups = GROUPS.map((g) => ({
    ...g,
    list: shown.filter((o) => o.type === g.type),
    ticked: options.filter((o) => o.type === g.type && value.some((v) => same(v, o))),
  })).filter((g) => g.list.length)

  const toggle = (o: TargetOption, on: boolean) => {
    const t = { type: o.type, id: o.id }
    if (multiple) onChange(on ? value.filter((v) => !same(v, t)) : [...value, t])
    else {
      onChange(on ? [] : [t])
      setOpen(null)
    }
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
      {groups.map((g) => {
        const expanded = needle ? true : open === g.type
        const summary = g.ticked.length ? g.ticked.map((o) => o.name).join(", ") : multiple ? "None ticked" : "None"
        return (
          <div key={g.type} className="overflow-hidden rounded-md border border-line bg-surface2">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(open === g.type ? null : g.type)}
              disabled={!!needle}
              className="flex h-12 w-full cursor-pointer items-center gap-2 pr-3 pl-3.5 text-left disabled:cursor-default"
            >
              <g.icon className="size-4 flex-none text-muted-foreground" />
              <span className="flex-none text-[13px] font-bold">{g.title}</span>
              <span className={cn("min-w-0 flex-1 truncate text-right text-sm", g.ticked.length ? "font-semibold" : "text-muted-foreground")}>
                {needle ? `${g.list.length} match${g.list.length === 1 ? "" : "es"}` : summary}
              </span>
              <ChevronDown className={cn("size-4 flex-none text-muted-foreground transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded ? (
              <div className="flex max-h-64 flex-col overflow-y-auto border-t border-line bg-surface p-1">
                {g.list.map((o) => {
                  const on = value.some((v) => same(v, o))
                  return (
                    <button
                      key={o.type + o.id}
                      type="button"
                      role={multiple ? "checkbox" : "radio"}
                      aria-checked={on}
                      onClick={() => toggle(o, on)}
                      className="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-left text-sm hover:bg-surface2"
                    >
                      <span
                        className={cn(
                          "flex size-5 flex-none items-center justify-center border",
                          multiple ? "rounded-[6px]" : "rounded-full",
                          on ? "border-primary bg-primary text-primary-foreground" : "border-outline bg-surface"
                        )}
                      >
                        {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-semibold">{o.name}</span>
                        {o.detail ? <span className="text-muted-foreground"> · {o.detail}</span> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : null}
          </div>
        )
      })}
      {needle && !groups.length ? <p className="text-sm text-muted-foreground">Nothing matches “{q}”.</p> : null}
    </div>
  )
}
