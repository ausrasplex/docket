import { Suspense } from "react"
import Link from "next/link"
import { Hammer, Plus, Receipt, TrendingUp, Wrench } from "lucide-react"
import { cn } from "cn"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { HeaderAction } from "@/components/shell/header-action"
import { MemberOnly } from "@/components/shell/member-only"
import { Hero, StatCard } from "@/components/shell/hero"
import { EmptyState } from "@/components/shell/empty-state"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { date, financialYear, money } from "@/lib/format"
import { loadContacts, loadExpenses, loadInbox } from "@/lib/job-rows"
import { atLeast } from "@/lib/roles"
import { JobsView } from "./jobs-view"

export const metadata = { title: "Jobs · Docket" }

export default function JobsPage({ searchParams }: PageProps<"/jobs">) {
  return (
    <>
      <PageHeader
        title="Jobs"
        actions={
          <Suspense fallback={null}>
            <MemberOnly>
              <HeaderAction add="cost" variant="outline" icon={<Receipt />} label="Add Cost" />
              <HeaderAction add="job" icon={<Plus />} label="Add Job" />
            </MemberOnly>
          </Suspense>
        }
      />
      <PageBody>
        <Suspense fallback={<Skeleton className="h-72 rounded-3xl" />}>
          <Jobs searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  )
}

async function Jobs({ searchParams }: { searchParams: PageProps<"/jobs">["searchParams"] }) {
  const sp = await searchParams
  const c = await requireHousehold()
  const h = { householdId: c.householdId }

  // which Australian financial year the summary shows (?fy=2025 means Jul 2025 – Jun 2026)
  const years = await db.$queryRaw<{ fy: number }[]>`
    SELECT DISTINCT (EXTRACT(YEAR FROM "date") - CASE WHEN EXTRACT(MONTH FROM "date") < 7 THEN 1 ELSE 0 END)::int AS fy
    FROM "Expense" WHERE "householdId" = ${c.householdId} AND "archivedAt" IS NULL ORDER BY fy DESC`
  const current = financialYear(new Date())
  const currentStart = current.start.getUTCFullYear()
  const pick = Number(sp.fy)
  const fyStart = Number.isInteger(pick) && pick > 1900 ? pick : currentStart
  const fy = financialYear(new Date(Date.UTC(fyStart, 6, 1)))
  const fyWhere = { ...h, archivedAt: null, date: { gte: fy.start, lte: fy.end } }

  const [byClass, jobs, looseCosts, contacts, rooms, inbox] = await Promise.all([
    db.expense.groupBy({ by: ["classification"], where: fyWhere, _sum: { amount: true } }),
    db.job.findMany({
      where: { ...h, propertyId: c.property.id, archivedAt: null },
      orderBy: [{ finishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      include: {
        contact: { select: { name: true } },
        spaces: { include: { space: { select: { name: true } } } },
        expenses: { where: { archivedAt: null }, select: { amount: true } },
      },
    }),
    loadExpenses({ ...h, jobId: null }),
    loadContacts(c.householdId),
    db.space.findMany({
      where: { ...h, propertyId: c.property.id, archivedAt: null, kind: { not: "FLOOR" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    loadInbox(c.householdId),
  ])
  const sum = (k?: string) => byClass.filter((x) => !k || x.classification === k).reduce((a, x) => a + Number(x._sum.amount ?? 0), 0)
  const yearList = [...new Set([currentStart, ...years.map((y) => y.fy)])].sort((a, b) => b - a)
  const open = sp.add === "job" ? "job" : sp.add === "cost" ? "cost" : null

  return (
    <>
      <Hero eyebrow={`Financial year ${fy.label}`} title={`${money(sum())} spent.`} line="Improvements, repairs and the rest, from your jobs and receipts.">
        <StatCard tone="a1" label="Improvements" value={money(sum("CAPITAL_IMPROVEMENT"))} caption="May count toward the cost base" icon={<TrendingUp className="size-5" />} />
        <StatCard tone="a2" label="Repairs" value={money(sum("REPAIR_MAINTENANCE"))} caption="Fixing and maintaining" icon={<Wrench className="size-5" />} />
        <StatCard tone="a3" label="Other" value={money(sum("FURNISHING") + sum("OTHER"))} caption="Furnishings and the rest" icon={<Receipt className="size-5" />} />
      </Hero>
      {yearList.length > 1 ? (
        <nav aria-label="Financial year" className="-mt-2 flex gap-2 overflow-x-auto">
          {yearList.map((y) => (
            <Link
              key={y}
              href={y === currentStart ? "/jobs" : `/jobs?fy=${y}`}
              aria-current={y === fyStart ? "page" : undefined}
              className={cn(
                "flex min-h-10 flex-none items-center rounded-full px-3.5 text-[13px] font-semibold",
                y === fyStart ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2"
              )}
            >
              FY {String(y).slice(2)}/{String(y + 1).slice(2)}
            </Link>
          ))}
        </nav>
      ) : null}

      <JobsView
        canEdit={atLeast(c.role, "MEMBER")}
        open={open}
        contacts={contacts}
        rooms={rooms}
        inbox={inbox}
        looseCosts={looseCosts}
        jobs={jobs.map((j) => ({
          id: j.id,
          title: j.title,
          status: j.status,
          when: j.finishedAt ? date(j.finishedAt) : j.startedAt ? `From ${date(j.startedAt)}` : "",
          rooms: j.spaces.map((s) => s.space.name),
          contact: j.contact?.name ?? null,
          total: j.expenses.reduce((a, e) => a + Number(e.amount), 0).toFixed(2),
          costs: j.expenses.length,
        }))}
      />
      {!jobs.length && !looseCosts.length ? (
        <EmptyState
          icon={<Hammer className="size-6" />}
          title="No Jobs Yet"
          body="Record renovations, repairs and installs with who did them, what they cost, and the receipts, quotes and certificates."
        />
      ) : null}
    </>
  )
}
