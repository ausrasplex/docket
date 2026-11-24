"use client"

import { cn } from "cn"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

/** One paint or finish colour: where it's used ("Feature Wall") and what it's called ("Dulux Natural White"). */
export type SwatchColour = { hex: string; surface: string; name: string | null }

const SWATCH = "size-5 flex-none rounded-full ring-2 ring-surface shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--ink)_22%,transparent)]"

/**
 * Paint colours as an overlapping stack, like an avatar group: each colour once (walls and ceiling in the same
 * white show one swatch), the first few shown and the rest as "+N". Every swatch has a thin outline so a white
 * or very pale colour still shows on a white card, and a ring in the card's colour to separate the overlaps.
 * Hovering a swatch names where it's used; hovering "+N" lists the rest. (On touch screens there's no hover:
 * tapping the card opens the room, which lists every finish.)
 */
export function SwatchGroup({ colours, max = 4, className }: { colours: SwatchColour[]; max?: number; className?: string }) {
  // the same colour on several surfaces is one swatch, named for all of them
  const groups = new Map<string, { hex: string; surfaces: string[]; names: string[] }>()
  for (const c of colours) {
    const key = c.hex.trim().toLowerCase()
    const g = groups.get(key) ?? { hex: c.hex.trim(), surfaces: [], names: [] }
    if (!g.surfaces.includes(c.surface)) g.surfaces.push(c.surface)
    if (c.name && !g.names.includes(c.name)) g.names.push(c.name)
    groups.set(key, g)
  }
  const unique = [...groups.values()]
  if (!unique.length) return null
  const shown = unique.slice(0, unique.length > max ? max - 1 : max)
  const rest = unique.slice(shown.length)
  const describe = (g: (typeof unique)[number]) => (
    <span className="flex flex-col">
      <b>{g.surfaces.join(", ")}</b>
      {g.names.length ? <span className="opacity-80">{g.names.join(", ")}</span> : null}
    </span>
  )
  return (
    <TooltipProvider delayDuration={150}>
      <span className={cn("flex items-center -space-x-1.5", className)} aria-label={unique.map((g) => [g.surfaces.join(" and "), ...g.names].join(": ")).join("; ")}>
        {shown.map((g) => (
          <Tooltip key={g.hex}>
            <TooltipTrigger asChild>
              <span className={SWATCH} style={{ background: g.hex }} />
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>{describe(g)}</TooltipContent>
          </Tooltip>
        ))}
        {rest.length ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex h-5 min-w-5 flex-none items-center justify-center rounded-full bg-surface2 px-1 text-[10px] font-bold text-muted-foreground ring-2 ring-surface shadow-[inset_0_0_0_1px_var(--line)]">
                +{rest.length}
              </span>
            </TooltipTrigger>
            <TooltipContent sideOffset={6}>
              <span className="flex flex-col gap-1.5">
                {rest.map((g) => (
                  <span key={g.hex} className="flex items-start gap-2">
                    <span className="mt-0.5 size-3 flex-none rounded-full shadow-[inset_0_0_0_1px_rgb(127_127_127/0.5)]" style={{ background: g.hex }} />
                    {describe(g)}
                  </span>
                ))}
              </span>
            </TooltipContent>
          </Tooltip>
        ) : null}
      </span>
    </TooltipProvider>
  )
}
