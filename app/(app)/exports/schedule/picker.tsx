"use client"

import { useState } from "react"
import { Check, Download, FileText } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"

type Section = { id: string; label: string; hint: string; on: boolean; count: number; rooms: string[]; missing: number }

/** Tick the sections to include, then open the PDF (to print) or download it. */
export function SchedulePicker({ property, sections }: { property: string; sections: Section[] }) {
  const [picked, setPicked] = useState(() => sections.filter((x) => x.on).map((x) => x.id))
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  // kept in the schedule's own order, whatever order they were ticked in
  const groups = sections.filter((x) => picked.includes(x.id)).map((x) => x.id).join(",")
  const href = `/api/exports/schedule?groups=${groups}`
  const entries = sections.filter((x) => picked.includes(x.id)).reduce((n, x) => n + x.count, 0)
  const missing = sections.filter((x) => picked.includes(x.id)).reduce((n, x) => n + x.missing, 0)

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-3xl bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h2>Sections</h2>
            <span className="text-sm font-medium text-muted-foreground">
              {entries ? `${entries} ${entries === 1 ? "entry" : "entries"} at ${property}, on landscape A4 pages.` : "Tick a section with something in it."}
            </span>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm" className={cn(!entries && "pointer-events-none opacity-50")}>
              <a href={href} target="_blank" rel="noopener" aria-disabled={!entries}>
                <FileText />
                Open PDF
              </a>
            </Button>
            <Button asChild size="sm" className={cn(!entries && "pointer-events-none opacity-50")}>
              <a href={`${href}&download=1`} download aria-disabled={!entries}>
                <Download />
                Download PDF
              </a>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-2.5 desk:grid-cols-2">
          {sections.map((x) => {
            const on = picked.includes(x.id)
            return (
              <button
                key={x.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(x.id)}
                className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 text-left", on ? "border-sel bg-sel-soft" : "border-transparent bg-surface2")}
              >
                <span className={cn("mt-0.5 flex size-6 flex-none items-center justify-center rounded-md border-2", on ? "border-sel bg-sel text-white" : "border-outline")}>
                  {on ? <Check className="size-3.5" /> : null}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <b className="text-sm font-bold">{x.label}</b>
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">{x.count || "Empty"}</span>
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">{x.hint}</span>
                  {x.rooms.length ? <span className="truncate text-xs font-medium text-muted-foreground">{x.rooms.join(" · ")}</span> : null}
                </span>
              </button>
            )
          })}
        </div>
      </section>
      {missing ? (
        <p className="text-sm font-medium text-muted-foreground">
          {missing} {missing === 1 ? "entry has" : "entries have"} no store, colour or size yet. Add them on each item (Colour / Finish, Size, Where Bought) or paint and finish, and they&apos;ll fill in the PDF.
        </p>
      ) : null}
    </div>
  )
}
