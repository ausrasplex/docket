import { Suspense } from "react"
import Link from "next/link"
import { ChevronRight, DoorOpen, Inbox, Lamp, Receipt } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { Hero, StatCard } from "@/components/shell/hero"
import { EmptyState } from "@/components/shell/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Greeting } from "@/components/shell/greeting"
import { Initials } from "@/components/shell/initials"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { financialYear, money, plural } from "@/lib/format"

export default function HomePage() {
  return (
    <>
      <PageHeader title="Home" />
      <PageBody>
        <Suspense fallback={<HomeSkeleton />}>
          <Home />
        </Suspense>
      </PageBody>
    </>
  )
}

async function Home() {
  const c = await requireHousehold()
  const now = new Date()
  const fy = financialYear(now)
  const soon = new Date(now.getTime() + 90 * 24 * 3600 * 1000)
  const h = { householdId: c.householdId }

  const [rooms, fixtures, expiring, spent, inbox, activity] = await Promise.all([
    db.space.count({ where: { ...h, propertyId: c.property.id, archivedAt: null, kind: { not: "FLOOR" } } }),
    db.fixture.count({ where: { ...h, propertyId: c.property.id, archivedAt: null, parentId: null } }),
    db.fixture.count({ where: { ...h, archivedAt: null, warrantyExpiresAt: { gte: now, lte: soon } } }),
    db.expense.aggregate({ where: { ...h, archivedAt: null, date: { gte: fy.start, lte: fy.end } }, _sum: { amount: true } }),
    db.document.count({ where: { ...h, archivedAt: null, links: { none: {} } } }),
    db.activity.findMany({ where: h, orderBy: { createdAt: "desc" }, take: 6, include: { user: { select: { name: true } } } }),
  ])

  return (
    <>
      <Hero eyebrow={<Greeting />} title={c.property.name}>
        <StatCard tone="a1" label="Rooms" value={String(rooms)} caption={rooms ? "Open a room to add to it" : "Add rooms to start"} icon={<DoorOpen className="size-5" />} />
        <StatCard tone="a2" label="Fixtures" value={String(fixtures)} caption={`${plural(expiring, "warranty", "warranties")} ending in 90 days`} icon={<Lamp className="size-5" />} />
        <StatCard tone="a3" label="Spent this FY" value={money(spent._sum.amount ?? 0)} caption={fy.label} icon={<Receipt className="size-5" />} />
      </Hero>

      {inbox ? (
        <Link href="/capture" className="lift group flex items-center gap-3 rounded-3xl bg-t3 px-5 py-4">
          <Inbox className="size-6" />
          <span className="flex-1 text-[15px] font-bold">{plural(inbox, "capture")} to file</span>
          <ChevronRight className="cardarrow size-5" />
        </Link>
      ) : null}

      <div className="grid grid-cols-1 gap-5 desk:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col">
            {activity.map((a) => (
              <div key={a.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                <Initials name={a.user?.name ?? "?"} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold">{a.summary}</span>
                  <time className="text-xs font-medium text-muted-foreground">
                    {a.createdAt.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </time>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        {rooms ? (
          <EmptyState
            icon={<Lamp className="size-6" />}
            title="Add Your First Fixture"
            body="An appliance, tap, light or system. Attach its manuals, warranty and the maker's support site."
            action={{ href: "/fixtures?add=1", label: "Add Item" }}
          />
        ) : (
          <EmptyState
            icon={<DoorOpen className="size-6" />}
            title="Add Your First Room"
            body="Rooms hold everything else: fixtures, manuals, paint colours and the jobs done in them."
            action={{ href: "/rooms", label: "Add Room" }}
          />
        )}
      </div>
    </>
  )
}

function HomeSkeleton() {
  return (
    <>
      <Skeleton className="h-[290px] rounded-3xl" />
      <Skeleton className="h-60 rounded-3xl" />
    </>
  )
}
