import { Suspense } from "react"
import { Lamp } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { EmptyState } from "@/components/shell/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { warranty } from "@/lib/fixtures"
import { atLeast } from "@/lib/roles"
import { FixturesList } from "./fixtures-list"

export const metadata = { title: "Fixtures · Docket" }

export default function FixturesPage({ searchParams }: PageProps<"/fixtures">) {
  return (
    <>
      <PageHeader title="Fixtures" />
      <PageBody>
        <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
          <Fixtures searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  )
}

async function Fixtures({ searchParams }: { searchParams: PageProps<"/fixtures">["searchParams"] }) {
  const sp = await searchParams
  const c = await requireHousehold()
  const now = new Date()
  const [items, rooms, brands] = await Promise.all([
    db.fixture.findMany({
      where: { householdId: c.householdId, propertyId: c.property.id, archivedAt: null, parentId: null },
      orderBy: { name: "asc" },
      include: {
        brand: { select: { name: true } },
        space: { select: { id: true, name: true } },
        parts: { where: { archivedAt: null }, select: { warrantyExpiresAt: true, _count: { select: { links: true } } } },
        _count: { select: { links: true } },
      },
    }),
    db.space.findMany({
      where: { householdId: c.householdId, propertyId: c.property.id, archivedAt: null, kind: { not: "FLOOR" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.brand.findMany({ where: { householdId: c.householdId, archivedAt: null }, orderBy: { name: "asc" }, select: { name: true } }),
  ])
  const canEdit = atLeast(c.role, "MEMBER")
  const presetRoom = typeof sp.room === "string" && rooms.some((r) => r.id === sp.room) ? sp.room : null

  return (
    <>
      <FixturesList
        canEdit={canEdit}
        openAdd={sp.add === "1"}
        presetRoom={presetRoom}
        rooms={rooms}
        brands={brands.map((b) => b.name)}
        items={items.map((f) => {
          // the soonest-ending warranty across the item and its parts is the one worth showing
          const ends = [f.warrantyExpiresAt, ...f.parts.map((p) => p.warrantyExpiresAt)].filter((d): d is Date => !!d && d >= now)
          const soonest = ends.sort((a, b) => a.getTime() - b.getTime())[0] ?? f.warrantyExpiresAt
          return {
            id: f.id,
            name: f.name,
            category: f.category,
            makeModel: [f.brand?.name, f.model].filter(Boolean).join(" "),
            room: f.space?.name ?? null,
            roomId: f.space?.id ?? null,
            parts: f.parts.length,
            docs: f._count.links + f.parts.reduce((a, p) => a + p._count.links, 0),
            warranty: warranty(soonest, now),
          }
        })}
      />
      {!items.length ? (
        <EmptyState
          icon={<Lamp className="size-6" />}
          title="No Items Yet"
          body="Add appliances, taps, lights and systems. Each can have parts (an air conditioner's indoor unit, outdoor unit and remote), with their own manuals and warranties."
        />
      ) : null}
    </>
  )
}
