import { Suspense } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { PageBody, PageTitle } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { CropEditor } from "@/components/covers/crop-editor"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { validCrop } from "@/lib/crop"

export const metadata = { title: "Adjust Photo · Docket" }

/** The crop screen for an item's or part's photo (Members and up). A part's goes back to its item's page. */
export default function ItemPhotoPage({ params }: PageProps<"/fixtures/[id]/photo">) {
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

async function Body({ params }: { params: PageProps<"/fixtures/[id]/photo">["params"] }) {
  const { id } = await params // items and parts are addressed by their id
  const c = await requireHousehold("MEMBER")
  const f = await db.fixture.findFirst({
    where: { id, householdId: c.householdId },
    select: {
      id: true,
      name: true,
      coverCrop: true,
      cover: { select: { id: true, thumbnailKey: true, archivedAt: true } },
      parent: { select: { id: true } },
    },
  })
  if (!f) notFound()
  // back to the item's page (scrolled to the part, for a part)
  const back = f.parent ? `/fixtures/${f.parent.id}#part-${f.id}` : `/fixtures/${f.id}`
  if (!f.cover || f.cover.archivedAt || !f.cover.thumbnailKey) redirect(back)

  return (
    <>
      <PageTitle>
        <Link href={back} aria-label={`Back to ${f.name}`} className="flex size-11 flex-none items-center justify-center rounded-full bg-surface hover:bg-surface2">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate">Adjust Photo</h1>
      </PageTitle>
      <PageBody>
        <p className="-mt-1 text-sm text-muted-foreground">Move and zoom the photo so the square shows the part of {f.name} you want.</p>
        <CropEditor kind="fixture" id={f.id} name={f.name} backHref={back} imageUrl={`/api/files/${f.cover.id}?v=thumb`} initial={validCrop(f.coverCrop)} />
      </PageBody>
    </>
  )
}
