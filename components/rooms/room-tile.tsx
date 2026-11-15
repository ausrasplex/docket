import type { SpaceKind } from "@/generated/prisma/enums"
import { CoverTile } from "@/components/covers/cover-tile"
import { coverSrc } from "@/components/covers/cover-src"

/** The URL of a room's photo, or null when it has none. */
export const roomPhotoSrc = (space: Parameters<typeof coverSrc>[1]) => coverSrc("space", space)

/** A room's square: its photo when it has one, otherwise the coloured icon for its type. */
export function RoomTile({ kind, src, className }: { kind: SpaceKind; src?: string | null; className?: string }) {
  return <CoverTile icon={{ type: "space", kind }} src={src} className={className} />
}
