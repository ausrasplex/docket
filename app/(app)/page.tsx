import { Suspense } from "react"
import Link from "next/link"
import { Car, ChevronRight, DoorOpen, HandHelping, Inbox, Lamp, Package, Receipt, ShieldCheck, Wrench } from "lucide-react"
import { cn } from "cn"
import { comingUp } from "@/lib/coming-up"
import { DUE_TONE } from "@/lib/service"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { Hero, StatCard } from "@/components/shell/hero"
import { EmptyState } from "@/components/shell/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Greeting, Today } from "@/components/shell/greeting"
import { Initials } from "@/components/shell/initials"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { financialYear, money, plural } from "@/lib/format"

export default function HomePage() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <Home />
    </Suspense>
  )
}

async function Home() {
  const c = await requireHousehold()
  const now = new Date()
  const fy = financialYear(now)
  const soon = new Date(now.getTime() + 90 * 24 * 3600 * 1000)
  const h = { householdId: c.householdId }

  const [rooms, fixtures, expiring, spent, inbox, activity, upcoming] = await Promise.all([
    db.space.count({ where: { ...h, propertyId: c.property.id, archivedAt: null, kind: { not: "FLOOR" } } }),
    db.fixture.count({ where: { ...h, propertyId: c.property.id, archivedAt: null, parentId: null } }),
    db.fixture.count({ where: { ...h, archivedAt: null, warrantyExpiresAt: { gte: now, lte: soon } } }),
    db.expense.aggregate({ where: { ...h, archivedAt: null, date: { gte: fy.start, lte: fy.end } }, _sum: { amount: true } }),
    db.document.count({ where: { ...h, archivedAt: null, links: { none: {} } } }),
    db.activity.findMany({ where: h, orderBy: { createdAt: "desc" }, take: 6, include: { user: { select: { name: true } } } }),
    comingUp(c.householdId, c.property.id, now),
  ])

  const overdue = upcoming.filter((u) => u.due.tone === "overdue").length

  // Beside the activity: the first room or fixture to add while either is missing, otherwise what is coming up.
  const side = !rooms ? (
    <EmptyState
      icon={<DoorOpen className="size-6" />}
      title="Add Your First Room"
      body="Rooms hold everything else: fixtures, manuals, paint colours and the jobs done in them."
      action={{ href: "/rooms", label: "Add Room" }}
    />
  ) : !fixtures ? (
    <EmptyState
      icon={<Lamp className="size-6" />}
      title="Add Your First Fixture"
      body="An appliance, tap, light or system. Attach its manuals, warranty and the maker's support site."
      action={{ href: "/fixtures?add=1", label: "Add Item" }}
    />
  ) : upcoming.length ? (
    <Card>
      <CardHeader>
        <CardTitle>Coming Up</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {upcoming.slice(0, 8).map((u) => (
          <Link key={u.fixtureId + u.what} href={`/fixtures/${u.itemId}`} className="lift group flex items-center gap-3 border-t border-line py-3 first:border-t-0">
            <span className={cn("flex size-10 flex-none items-center justify-center rounded-full", u.due.tone === "overdue" ? "bg-danger-soft text-danger" : "bg-t2")}>
              {u.spare ? <Package className="size-5" /> : u.what === "Warranty" ? <ShieldCheck className="size-5" /> : u.what === "Registration" ? <Car className="size-5" /> : u.what === "Due Back" ? <HandHelping className="size-5" /> : <Wrench className="size-5" />}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-bold">{u.what}</span>
              <span className="truncate text-xs font-medium text-muted-foreground">{u.item}</span>
            </span>
            <span className={cn("flex-none rounded-full px-2.5 py-1 text-xs font-semibold", DUE_TONE[u.due.tone])}>{u.due.text}</span>
            <ChevronRight className="cardarrow size-5 flex-none text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  ) : null

  return (
    <>
      <PageHeader title={<Greeting name={c.user.name.trim().split(/\s+/)[0]} />} subtitle={<Today />} />
      <PageBody>
        <Hero
          eyebrow={c.property.name}
          title={upcoming.length ? `${plural(upcoming.length, "thing")} coming up.` : "Nothing coming up."}
          line={overdue ? `${overdue} overdue. Warranties, servicing and registration are in Coming Up.` : "Warranties, servicing and registration for your rooms and fixtures."}
        >
          <StatCard tone="a1" href="/rooms" label="Rooms" value={String(rooms)} caption={rooms ? "Open a room to add to it" : "Add rooms to start"} icon={<DoorOpen />} />
          <StatCard tone="a2" href="/fixtures" label="Fixtures" value={String(fixtures)} caption={`${plural(expiring, "warranty", "warranties")} ending in 90 days`} icon={<Lamp />} />
          <StatCard tone="a3" href="/jobs" label="Spent this FY" value={money(spent._sum.amount ?? 0)} caption={fy.label} icon={<Receipt />} />
        </Hero>

        {inbox ? (
          <Link href="/capture" className="lift group flex items-center gap-3 rounded-3xl bg-t3 px-5 py-4">
            <Inbox className="size-6" />
            <span className="flex-1 text-[15px] font-bold">{plural(inbox, "capture")} to file</span>
            <ChevronRight className="cardarrow size-5" />
          </Link>
        ) : null}

        <div className={cn("grid grid-cols-1 gap-5", side && "desk:grid-cols-2")}>
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
          {side}
        </div>
      </PageBody>
    </>
  )
}

function HomeSkeleton() {
  return (
    <>
      <PageHeader title={<Greeting />} subtitle={<Today />} />
      <PageBody>
        <Skeleton className="h-[260px] rounded-3xl" />
        <Skeleton className="h-60 rounded-3xl" />
      </PageBody>
    </>
  )
}
