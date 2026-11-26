import { Suspense } from "react"
import Link from "next/link"
import { Archive, Lamp, Plus, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { HeaderAction } from "@/components/shell/header-action"
import { MemberOnly } from "@/components/shell/member-only"
import { EmptyState } from "@/components/shell/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { warranty } from "@/lib/fixtures"
import { date, plural } from "@/lib/format"
import { atLeast } from "@/lib/roles"
import { FixturesList } from "./fixtures-list"
import { ArchivedList } from "./archived-list"
import { comingUp } from "@/lib/coming-up"
import { itemPhotoSrc } from "@/components/fixtures/category-tile"

export const metadata = { title: "Fixtures · Docket" }

export default function FixturesPage({ searchParams }: PageProps<"/fixtures">) {
  return (
    <>
      <PageHeader
        title="Fixtures"
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="max-desk:size-11 max-desk:px-0">
              <Link href="/exports/insurance" title="Insurance Report">
                <ShieldCheck />
                <span className="max-desk:sr-only">Insurance Report</span>
              </Link>
            </Button>
            <Suspense fallback={null}>
              <MemberOnly>
                <HeaderAction add="1" icon={<Plus />} label="Add Item" />
              </MemberOnly>
            </Suspense>
          </>
        }
      />
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
  if (sp.archived === "1") return <Archived householdId={c.householdId} propertyId={c.property.id} canEdit={atLeast(c.role, "MEMBER")} />
  const now = new Date()
  const [items, rooms, brands, upcoming, archivedCount] = await Promise.all([
    db.fixture.findMany({
      where: { householdId: c.householdId, propertyId: c.property.id, archivedAt: null, parentId: null },
      orderBy: { name: "asc" },
      include: {
        brand: { select: { name: true } },
        space: { select: { id: true, name: true } },
        cover: { select: { id: true, archivedAt: true } },
        parts: { where: { archivedAt: null }, select: { warrantyExpiresAt: true, _count: { select: { links: true } } } },
        // documents, and the items it Works With (either side of the pair; archived ones don't count)
        _count: { select: { links: true, worksWithA: { where: { b: { archivedAt: null } } }, worksWithB: { where: { a: { archivedAt: null } } } } },
        // the lowest and highest price recorded at any of its shops (lib/prices.ts)
        priceSources: { select: { checks: { select: { price: true } } } },
      },
    }),
    db.space.findMany({
      where: { householdId: c.householdId, propertyId: c.property.id, archivedAt: null, kind: { not: "FLOOR" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.brand.findMany({ where: { householdId: c.householdId, archivedAt: null }, orderBy: { name: "asc" }, select: { name: true } }),
    comingUp(c.householdId, c.property.id, now),
    db.fixture.count({ where: { householdId: c.householdId, propertyId: c.property.id, archivedAt: { not: null } } }),
  ])
  // the most urgent thing per item (services, rego), shown as a chip (warranties have their own)
  const dueByItem = new Map<string, { tone: "soon" | "overdue"; text: string }>()
  for (const u of upcoming) {
    if (u.what === "Warranty" || dueByItem.has(u.itemId)) continue
    dueByItem.set(u.itemId, { tone: u.due.tone as "soon" | "overdue", text: u.what === "Due Back" ? u.due.text : `${u.what}: ${u.due.text}` })
  }
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
            photo: itemPhotoSrc(f),
            due: dueByItem.get(f.id) ?? null,
            name: f.name,
            category: f.category,
            makeModel: [f.brand?.name, f.model].filter(Boolean).join(" "),
            room: f.space?.name ?? null,
            roomId: f.space?.id ?? null,
            portable: f.portable,
            parts: f.parts.length,
            serviceEnabled: f.serviceEnabled,
            lentTo: f.lentTo,
            worksWith: f._count.worksWithA + f._count.worksWithB,
            docs: f._count.links + f.parts.reduce((a, p) => a + p._count.links, 0),
            warranty: warranty(soonest, now),
            prices: priceRange(f.priceSources.flatMap((s) => s.checks.map((k) => Number(k.price.toString())))),
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
      {archivedCount ? (
        <Link href="/fixtures?archived=1" className="flex items-center gap-1.5 self-center text-sm font-semibold text-muted-foreground hover:text-ink">
          <Archive className="size-4" />
          {plural(archivedCount, "archived item")}
        </Link>
      ) : null}
    </>
  )
}

/** Fixtures › Archived: archived items and parts, newest first, to restore. */
async function Archived({ householdId, propertyId, canEdit }: { householdId: string; propertyId: string; canEdit: boolean }) {
  const rows = await db.fixture.findMany({
    where: { householdId, propertyId, archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
    select: {
      id: true,
      name: true,
      category: true,
      model: true,
      archivedAt: true,
      coverCropKey: true,
      cover: { select: { id: true, archivedAt: true } },
      brand: { select: { name: true } },
      space: { select: { name: true } },
      parent: { select: { id: true, name: true, archivedAt: true } },
    },
  })
  return (
    <ArchivedList
      canEdit={canEdit}
      rows={rows.map((f) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        photo: itemPhotoSrc(f),
        detail: [[f.brand?.name, f.model].filter(Boolean).join(" "), f.space?.name].filter(Boolean).join(" · "),
        archived: date(f.archivedAt),
        partOf: f.parent ? { id: f.parent.id, name: f.parent.name, archived: !!f.parent.archivedAt } : null,
      }))}
    />
  )
}

const priceRange = (all: number[]) => (all.length ? { low: Math.min(...all), high: Math.max(...all) } : null)
