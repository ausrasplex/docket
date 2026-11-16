import { Suspense } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { PageBody, PageTitle } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { validCrop } from "@/lib/crop"
import { CropEditor } from "@/components/covers/crop-editor"
import { bySlugOrId } from "@/lib/slug"

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
  const { id: param } = await params // the room's slug (or its id, from old links)
  const c = await requireHousehold("MEMBER")
  const room = await db.space.findFirst({
    where: bySlugOrId(c.householdId, param),
    select: { id: true, slug: true, name: true, coverCrop: true, cover: { select: { id: true, thumbnailKey: true, archivedAt: true } } },
  })
  if (!room) notFound()
  if (param !== room.slug) redirect(`/rooms/${room.slug}/photo`)
  // no photo to crop: back to the room, where one can be added
  if (!room.cover || room.cover.archivedAt || !room.cover.thumbnailKey) redirect(`/rooms/${room.slug}`)

  return (
    <>
      <PageTitle>
        <Link href={`/rooms/${room.slug}`} aria-label={`Back to ${room.name}`} className="flex size-11 flex-none items-center justify-center rounded-full bg-surface hover:bg-surface2">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate">Adjust Photo</h1>
      </PageTitle>
      <PageBody>
        <p className="-mt-1 text-sm text-muted-foreground">Move and zoom the photo so the square shows the part of {room.name} you want.</p>
        <CropEditor kind="space" id={room.id} name={room.name} backHref={`/rooms/${room.slug}`} imageUrl={`/api/files/${room.cover.id}?v=thumb`} initial={validCrop(room.coverCrop)} />
      </PageBody>
    </>
  )
}
