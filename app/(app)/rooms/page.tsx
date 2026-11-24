import { Suspense } from "react"
import { DoorOpen, Plus } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { HeaderAction } from "@/components/shell/header-action"
import { MemberOnly } from "@/components/shell/member-only"
import { EmptyState } from "@/components/shell/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { atLeast } from "@/lib/roles"
import { RoomsList } from "./rooms-list"
import { roomPhotoSrc } from "@/components/rooms/room-tile"
import { surfaceLabel } from "@/lib/finishes"

export default function RoomsPage({ searchParams }: PageProps<"/rooms">) {
  return (
    <>
      <PageHeader
        title="Rooms"
        actions={
          <Suspense fallback={null}>
            <MemberOnly>
              <HeaderAction add="1" icon={<Plus />} label="Add Room" />
            </MemberOnly>
          </Suspense>
        }
      />
      <PageBody>
        <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
          <Rooms searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  )
}

async function Rooms({ searchParams }: { searchParams: PageProps<"/rooms">["searchParams"] }) {
  const openAdd = (await searchParams).add === "1"
  const c = await requireHousehold()
  const spaces = await db.space.findMany({
    where: { householdId: c.householdId, propertyId: c.property.id, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { fixtures: { where: { archivedAt: null, parentId: null } }, finishes: { where: { archivedAt: null } } } },
      cover: { select: { id: true, archivedAt: true } },
      finishes: { where: { archivedAt: null, hex: { not: null } }, select: { hex: true, surface: true, surfaceNote: true, colourName: true, brand: { select: { name: true } } }, orderBy: { createdAt: "asc" }, take: 24 },
    },
  })
  if (!spaces.length) {
    return (
      <>
        <RoomsList rooms={[]} canEdit={atLeast(c.role, "MEMBER")} openAdd={openAdd} />
        <EmptyState icon={<DoorOpen className="size-6" />} title="No Rooms Yet" body="Add the rooms in your home. Each one holds its fixtures, paint colours and the jobs done in it." />
      </>
    )
  }
  return (
    <RoomsList
      canEdit={atLeast(c.role, "MEMBER")}
      openAdd={openAdd}
      rooms={spaces.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        kind: s.kind,
        parentId: s.parentId,
        fixtures: s._count.fixtures,
        finishes: s._count.finishes,
        swatches: s.finishes.map((f) => ({
          hex: f.hex!,
          surface: f.surfaceNote ? `${surfaceLabel(f.surface)} (${f.surfaceNote})` : surfaceLabel(f.surface),
          name: [f.brand?.name, f.colourName].filter(Boolean).join(" ") || null,
        })),
        photo: roomPhotoSrc(s),
      }))}
    />
  )
}
