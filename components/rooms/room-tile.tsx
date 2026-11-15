import { cn } from "cn"
import { spaceKind } from "@/lib/spaces"
import type { SpaceKind } from "@/generated/prisma/enums"

const TONE = { a1: "bg-a1", a2: "bg-a2", a3: "bg-a3" } as const

/** The URL of a room's photo, or null when it has none. The version changes with the photo and each crop. */
export function roomPhotoSrc(space: { id: string; cover: { id: string; archivedAt: Date | null } | null; coverCropKey: string | null }) {
  if (!space.cover || space.cover.archivedAt) return null
  const v = (space.coverCropKey ?? space.cover.id).replace(/[^a-zA-Z0-9]/g, "").slice(-16)
  return `/api/rooms/${space.id}/photo?v=${v}`
}

/** A room's square: its photo when it has one, otherwise the coloured icon tile for its type. */
export function RoomTile({ kind, src, className }: { kind: SpaceKind; src?: string | null; className?: string }) {
  const k = spaceKind(kind)
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file; not for next/image
      <img src={src} alt="" className={cn("flex-none rounded-2xl bg-surface2 object-cover", className)} />
    )
  }
  return (
    <span className={cn("flex flex-none items-center justify-center rounded-2xl text-on-a", TONE[k.tone], className)}>
      <k.icon className="size-1/2" />
    </span>
  )
}
