import type { FixtureCategory } from "@/generated/prisma/enums"
import { CoverTile } from "@/components/covers/cover-tile"
import { coverSrc } from "@/components/covers/cover-src"

/** The URL of an item's (or part's) photo, or null when it has none. */
export const itemPhotoSrc = (fixture: Parameters<typeof coverSrc>[1]) => coverSrc("fixture", fixture)

/**
 * An item's square: its photo when it has one, otherwise its category's icon on the category's colour.
 * Used everywhere an item is listed (Fixtures, a room, the item's own page) so they always match.
 */
export function CategoryTile({ value, src, className }: { value: FixtureCategory; src?: string | null; className?: string }) {
  return <CoverTile icon={{ type: "fixture", category: value }} src={src} className={className} />
}
