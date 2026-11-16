import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, Hammer } from "lucide-react"
import { cn } from "cn"
import { PageBody, PageTitle } from "@/components/shell/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DocGroups } from "@/components/documents/doc-groups"
import { ExpenseList } from "@/components/jobs/expense-list"
import { ContactRow } from "@/components/jobs/contact-card"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { date, money } from "@/lib/format"
import { contactLite, loadContacts, loadExpenses, loadInbox } from "@/lib/job-rows"
import { expenseClass, jobStatus } from "@/lib/jobs"
import { isoDay } from "@/lib/parse"
import { atLeast } from "@/lib/roles"
import { AddJobCost, JobMenu } from "./job-client"

export default function JobPage({ params }: PageProps<"/jobs/[id]">) {
  return (
    <Suspense
      fallback={
        <PageBody>
          <Skeleton className="mt-6 h-60 rounded-3xl" />
        </PageBody>
      }
    >
      <Job params={params} />
    </Suspense>
  )
}

async function Job({ params }: { params: PageProps<"/jobs/[id]">["params"] }) {
  const { id } = await params // jobs are addressed by their id
  const c = await requireHousehold()
  const job = await db.job.findFirst({
    where: { id, householdId: c.householdId },
    include: {
      spaces: { include: { space: { select: { id: true, name: true, slug: true } } } },
      links: { where: { document: { archivedAt: null } }, orderBy: { createdAt: "asc" }, include: { document: true } },
    },
  })
  if (!job) notFound()

  const [costs, contacts, rooms, inbox] = await Promise.all([
    loadExpenses({ householdId: c.householdId, jobId: job.id }),
    loadContacts(c.householdId),
    db.space.findMany({
      where: { householdId: c.householdId, propertyId: job.propertyId, archivedAt: null, kind: { not: "FLOOR" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    loadInbox(c.householdId),
  ])
  const canEdit = atLeast(c.role, "MEMBER")
  const lite = contacts.map(contactLite)
  const contact = contacts.find((x) => x.id === job.contactId)
  const status = jobStatus(job.status)
  const total = costs.reduce((a, e) => a + Number(e.input.amount), 0)
  const gst = costs.reduce((a, e) => a + Number(e.input.gst || 0), 0)
  // the split by tax treatment, largest first
  const split = Object.entries(
    costs.reduce<Record<string, number>>((m, e) => ({ ...m, [e.input.classification]: (m[e.input.classification] ?? 0) + Number(e.input.amount) }), {})
  ).sort((a, b) => b[1] - a[1])

  return (
    <>
      <PageTitle>
        <Link href="/jobs" aria-label="Back to jobs" className="flex size-11 flex-none items-center justify-center rounded-full bg-surface hover:bg-surface2">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate">{job.title}</h1>
        {canEdit ? (
          <JobMenu
            id={job.id}
            title={job.title}
            archived={!!job.archivedAt}
            rooms={rooms}
            contacts={lite}
            initial={{
              title: job.title,
              status: job.status,
              spaceIds: job.spaces.map((s) => s.spaceId),
              contactId: job.contactId,
              startedAt: isoDay(job.startedAt),
              finishedAt: isoDay(job.finishedAt),
              permitNumber: job.permitNumber ?? "",
              description: job.description ?? "",
            }}
          />
        ) : null}
      </PageTitle>
      <PageBody>
        {job.archivedAt ? (
          <p className="rounded-[14px] bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">This job is archived. Restore it from the ⋯ menu.</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-14 flex-none items-center justify-center rounded-2xl bg-a2 text-on-a">
            <Hammer className="size-7" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className={cn("self-start rounded-full px-2.5 py-1 text-xs font-bold", status.tone)}>{status.label}</span>
            <span className="text-[13px] font-medium text-muted-foreground">
              {[
                job.startedAt && job.finishedAt ? `${date(job.startedAt)} – ${date(job.finishedAt)}` : job.finishedAt ? `Finished ${date(job.finishedAt)}` : job.startedAt ? `Started ${date(job.startedAt)}` : null,
                job.permitNumber ? `Permit ${job.permitNumber}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {job.spaces.length ? (
              <span className="flex flex-wrap gap-1.5">
                {job.spaces.map((s) => (
                  <Link key={s.spaceId} href={`/rooms/${s.space.slug}`} className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold hover:bg-surface2">
                    {s.space.name}
                  </Link>
                ))}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[26px] leading-none font-bold tracking-tight tabular-nums">{money(total, true)}</span>
            <span className="text-xs text-muted-foreground tabular-nums">incl. {money(gst, true)} GST</span>
          </div>
        </div>
        {job.description ? <p className="max-w-prose rounded-2xl bg-surface px-4 py-3 text-sm whitespace-pre-line">{job.description}</p> : null}

        <div className="grid grid-cols-1 items-start gap-5 desk:grid-cols-[3fr_2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Costs</CardTitle>
              <CardDescription>
                {split.length ? split.map(([k, v]) => `${expenseClass(k as never).label} ${money(v)}`).join(" · ") : "Add each receipt or invoice with its total."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col">
              <ExpenseList rows={costs} jobs={[]} contacts={lite} inbox={inbox} canEdit={canEdit} showJob={false} lockJob />
              {canEdit ? <AddJobCost jobId={job.id} contactId={job.contactId} contacts={lite} inbox={inbox} /> : null}
            </CardContent>
          </Card>
          <div className="flex flex-col gap-5">
            {contact ? (
              <Card>
                <CardHeader>
                  <CardTitle>Tradesperson</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul>
                    <ContactRow c={contact} canEdit={canEdit} />
                  </ul>
                </CardContent>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>Quotes, Photos and Certificates</CardTitle>
                <CardDescription>Receipts live with each cost; everything else goes here.</CardDescription>
              </CardHeader>
              <CardContent>
                <DocGroups
                  canEdit={canEdit}
                  inbox={inbox}
                  groups={[
                    {
                      target: { type: "job", id: job.id },
                      name: "This Job",
                      removeLabel: "Job",
                      docs: job.links.map((l) => ({ linkId: l.id, label: l.label, doc: l.document })),
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  )
}
