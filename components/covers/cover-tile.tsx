import { cn } from "cn"
import { spaceKind } from "@/lib/spaces"
import { category, PART_ICON } from "@/lib/fixtures"
import type { FixtureCategory, SpaceKind } from "@/generated/prisma/enums"

const TONE = { a1: "bg-a1", a2: "bg-a2", a3: "bg-a3" } as const

/** What a tile shows when there's no photo: a room's type icon, an item's category icon, or the part icon. */
export type TileIcon = { type: "space"; kind: SpaceKind } | { type: "fixture"; category: FixtureCategory } | { type: "part" }

/**
 * The square for a room, item or part: its photo when it has one, otherwise its coloured icon tile.
 * Used everywhere they're listed so the same thing always looks the same.
 */
export function CoverTile({ icon, src, className }: { icon: TileIcon; src?: string | null; className?: string }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file; not for next/image
      <img src={src} alt="" className={cn("size-12 flex-none rounded-2xl bg-surface2 object-cover", className)} />
    )
  }
  const look =
    icon.type === "space"
      ? { Icon: spaceKind(icon.kind).icon, bg: TONE[spaceKind(icon.kind).tone] }
      : icon.type === "fixture"
        ? { Icon: category(icon.category).icon, bg: TONE[category(icon.category).tone] }
        : { Icon: PART_ICON, bg: "bg-t1" }
  return (
    <span aria-hidden="true" className={cn("flex size-12 flex-none items-center justify-center rounded-2xl text-on-a", look.bg, className)}>
      <look.Icon className="size-1/2" />
    </span>
  )
}
