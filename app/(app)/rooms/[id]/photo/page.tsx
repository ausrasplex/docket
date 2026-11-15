import { Suspense } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { PageBody } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { validCrop } from "@/lib/crop"
import { CropEditor } from "./crop-editor"

export const metadata = { title: "Adjust Photo · Docket" }

/** The crop screen for a room's photo (Members and up). */
export default function RoomPhotoPage({ params }: PageProps<"/rooms/[id]/photo">) {
  return (
    <Suspense
      fallback={
        <PageBody>
          <Skeleton className="mt-6 aspect-square max-w-[440px] rounded-3xl" />
        </PageBody>
      }
    >
      <Body params={params} />
    </Suspense>
  )
}

async function Body({ params }: { params: PageProps<"/rooms/[id]/photo">["params"] }) {
  const { id } = await params
  const c = await requireHousehold("MEMBER")
  const room = await db.space.findFirst({
    where: { id, householdId: c.householdId },
    select: { id: true, name: true, coverCrop: true, cover: { select: { id: true, thumbnailKey: true, archivedAt: true } } },
  })
  if (!room) notFound()
  // no photo to crop: back to the room, where one can be added
  if (!room.cover || room.cover.archivedAt || !room.cover.thumbnailKey) redirect(`/rooms/${room.id}`)

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mb-2 border-b border-line bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] px-4 py-2.5 backdrop-blur-[16px] desk:-mx-8 desk:px-8 desk:py-3.5">
        <div className="mx-auto flex min-h-11 max-w-[1100px] items-center gap-2.5">
          <Link href={`/rooms/${room.id}`} aria-label={`Back to ${room.name}`} className="flex size-11 flex-none items-center justify-center rounded-full bg-surface hover:bg-surface2">
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate">Adjust Photo</h1>
        </div>
      </div>
      <PageBody>
        <p className="-mt-1 text-sm text-muted-foreground">Move and zoom the photo so the square shows the part of {room.name} you want.</p>
        <CropEditor roomId={room.id} roomName={room.name} imageUrl={`/api/files/${room.cover.id}?v=thumb`} initial={validCrop(room.coverCrop)} />
      </PageBody>
    </>
  )
}
