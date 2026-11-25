import { Suspense } from "react"
import { Paintbrush, Plus } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { HeaderAction } from "@/components/shell/header-action"
import { MemberOnly } from "@/components/shell/member-only"
import { EmptyState } from "@/components/shell/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { FinishList } from "@/components/finishes/finish-list"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { loadFinishes } from "@/lib/finish-rows"
import { atLeast } from "@/lib/roles"

export const metadata = { title: "Paint · Docket" }

export default function PaintPage({ searchParams }: PageProps<"/paint">) {
  return (
    <>
      <PageHeader
        title="Paint"
        actions={
          <Suspense fallback={null}>
            <MemberOnly>
              <HeaderAction add="1" icon={<Plus />} label="Add Paint" />
            </MemberOnly>
          </Suspense>
        }
      />
      <PageBody>
        <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
          <Paint searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  )
}

async function Paint({ searchParams }: { searchParams: PageProps<"/paint">["searchParams"] }) {
  const sp = await searchParams
  const c = await requireHousehold()
  const [rows, rooms, brands] = await Promise.all([
    loadFinishes({ householdId: c.householdId, space: { propertyId: c.property.id, archivedAt: null } }),
    db.space.findMany({
      where: { householdId: c.householdId, propertyId: c.property.id, archivedAt: null, kind: { not: "FLOOR" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.brand.findMany({ where: { householdId: c.householdId, archivedAt: null }, orderBy: { name: "asc" }, select: { name: true } }),
  ])
  return (
    <>
      <p className="-mt-1 text-sm text-muted-foreground">Every colour and finish in the house, with the rooms it&apos;s in and where the leftover tins are.</p>
      <FinishList rows={rows} rooms={rooms} brands={brands.map((b) => b.name)} canEdit={atLeast(c.role, "MEMBER")} groupByColour openAdd={sp.add === "1"} />
      {!rows.length ? (
        <EmptyState
          icon={<Paintbrush className="size-6" />}
          title="No Paint Yet"
          body="Record each colour once and pick every room it's in. Add the leftover tin's location, and a photo of its label, for easy touch-ups."
        />
      ) : null}
    </>
  )
}
