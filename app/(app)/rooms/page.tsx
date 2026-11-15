import { Suspense } from "react"
import { DoorOpen } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { EmptyState } from "@/components/shell/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { atLeast } from "@/lib/roles"
import { RoomsList } from "./rooms-list"
import { roomPhotoSrc } from "@/components/rooms/room-tile"

export default function RoomsPage() {
  return (
    <>
      <PageHeader title="Rooms" />
      <PageBody>
        <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
          <Rooms />
        </Suspense>
      </PageBody>
    </>
  )
}

async function Rooms() {
  const c = await requireHousehold()
  const spaces = await db.space.findMany({
    where: { householdId: c.householdId, propertyId: c.property.id, archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { fixtures: { where: { archivedAt: null, parentId: null } }, finishes: { where: { archivedAt: null } } } },
      cover: { select: { id: true, archivedAt: true } },
      finishes: { where: { archivedAt: null, hex: { not: null } }, select: { hex: true }, take: 3 },
    },
  })
  if (!spaces.length) {
    return (
      <>
        <RoomsList rooms={[]} canEdit={atLeast(c.role, "MEMBER")} />
        <EmptyState icon={<DoorOpen className="size-6" />} title="No Rooms Yet" body="Add the rooms in your home. Each one holds its fixtures, paint colours and the jobs done in it." />
      </>
    )
  }
  return (
    <RoomsList
      canEdit={atLeast(c.role, "MEMBER")}
      rooms={spaces.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        kind: s.kind,
        parentId: s.parentId,
        fixtures: s._count.fixtures,
        finishes: s._count.finishes,
        swatches: s.finishes.map((f) => f.hex!),
        photo: roomPhotoSrc(s),
      }))}
    />
  )
}
