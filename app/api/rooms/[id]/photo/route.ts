import { db } from "@/lib/db"
import { getSession } from "@/lib/dal"
import { readStored } from "@/lib/storage"

/**
 * A room's photo for its tile, to members of its household only: the cropped copy when one was saved,
 * otherwise the photo's preview (shown centred by the tile). The ?v= in the URL changes with each crop.
 */
export async function GET(_req: Request, { params }: RouteContext<"/api/rooms/[id]/photo">) {
  const session = await getSession()
  if (!session) return new Response("Sign in first", { status: 401 })
  const { id } = await params
  // by id (what the tiles use) or by the room's readable address; a slug is only unique within a household,
  // so the signed-in person's current household wins if two of theirs share one
  const mine = { memberships: { some: { userId: session.user.id } } }
  const found = await db.space.findMany({
    where: { OR: [{ id }, { slug: id }], household: mine },
    select: { householdId: true, coverCropKey: true, cover: { select: { thumbnailKey: true, archivedAt: true } } },
    take: 10,
  })
  const space = found.find((x) => x.householdId === session.user.activeHouseholdId) ?? found[0]
  if (!space?.cover || space.cover.archivedAt) return new Response("Not found", { status: 404 })
  const key = space.coverCropKey ?? space.cover.thumbnailKey
  if (!key) return new Response("Not found", { status: 404 })
  let file
  try {
    file = await readStored(key)
  } catch {
    return new Response("The photo is missing from storage", { status: 404 })
  }
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(file.data.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
    },
  })
}
