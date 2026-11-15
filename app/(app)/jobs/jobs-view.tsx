"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ChevronRight, Hammer, Plus, Receipt } from "lucide-react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { InboxDoc } from "@/components/documents/doc-groups"
import { BLANK_JOB, JobDrawer } from "@/components/jobs/job-drawer"
import { BLANK_EXPENSE, ExpenseDrawer } from "@/components/jobs/expense-drawer"
import { ExpenseList, type ExpenseRowData } from "@/components/jobs/expense-list"
import { ContactRow, type ContactFull } from "@/components/jobs/contact-card"
import type { ContactLite } from "@/components/jobs/contact-picker"
import { jobStatus } from "@/lib/jobs"
import { money } from "@/lib/format"
import type { JobStatus } from "@/generated/prisma/enums"

export type JobCard = {
  id: string
  slug: string
  title: string
  status: JobStatus
  when: string
  rooms: string[]
  contact: string | null
  total: string
  costs: number
}

/** The Jobs page body: add buttons, jobs, costs outside a job, and tradespeople. */
export function JobsView({
  jobs,
  looseCosts,
  contacts,
  rooms,
  inbox,
  canEdit,
  open: openParam,
}: {
  jobs: JobCard[]
  looseCosts: ExpenseRowData[]
  contacts: ContactFull[]
  rooms: { id: string; name: string }[]
  inbox: InboxDoc[]
  canEdit: boolean
  open: "job" | "cost" | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState<"job" | "cost" | null>(canEdit ? openParam : null)
  const [lastParam, setLastParam] = useState(openParam)
  if (openParam !== lastParam) {
    setLastParam(openParam)
    if (openParam && canEdit) setOpen(openParam)
  }
  const close = () => {
    setOpen(null)
    if (openParam) router.replace("/jobs", { scroll: false })
  }
  const lite: ContactLite[] = contacts.map((c) => ({ id: c.id, name: c.name, business: c.business || null, trade: c.trade || null, phone: c.phone || null }))
  const jobList = jobs.map((j) => ({ id: j.id, title: j.title }))

  return (
    <>
      {canEdit ? (
        <div className="flex gap-2.5 desk:justify-end [&>*]:flex-1 desk:[&>*]:flex-none">
          <Button variant="outline" onClick={() => setOpen("cost")}>
            <Receipt />
            Add Cost
          </Button>
          <Button variant="add" onClick={() => setOpen("job")}>
            <Plus />
            Add Job
          </Button>
        </div>
      ) : null}

      {jobs.length ? (
        <section className="flex flex-col gap-3">
          <h2>Jobs</h2>
          <div className="grid grid-cols-1 gap-3 desk:grid-cols-2">
            {jobs.map((j) => {
              const s = jobStatus(j.status)
              return (
                <Link key={j.id} href={`/jobs/${j.slug}`} className="lift group flex flex-col gap-2.5 rounded-3xl bg-surface p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex size-12 flex-none items-center justify-center rounded-2xl bg-a2 text-on-a">
                      <Hammer className="size-6" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-bold">{j.title}</span>
                      <span className="truncate text-xs font-medium text-muted-foreground">
                        {[j.contact, j.rooms.join(", "), j.when].filter(Boolean).join(" · ") || "No details yet"}
                      </span>
                    </span>
                    <span className="flex flex-none flex-col items-end">
                      <span className="text-[15px] font-bold tabular-nums">{money(j.total)}</span>
                      <span className="text-xs text-muted-foreground">
                        {j.costs} cost{j.costs === 1 ? "" : "s"}
                      </span>
                    </span>
                    <ChevronRight className="cardarrow size-5 flex-none self-center text-muted-foreground" />
                  </div>
                  <span className={cn("self-start rounded-full px-2.5 py-1 text-xs font-bold", s.tone)}>{s.label}</span>
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}

      {looseCosts.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Other Costs</CardTitle>
            <CardDescription>Receipts that aren&apos;t part of a job.</CardDescription>
          </CardHeader>
          <CardContent>
            <ExpenseList rows={looseCosts} jobs={jobList} contacts={lite} inbox={inbox} canEdit={canEdit} />
          </CardContent>
        </Card>
      ) : null}

      {contacts.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Tradespeople</CardTitle>
            <CardDescription>Everyone who&apos;s worked on the house.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col">
              {contacts.map((c) => (
                <ContactRow key={c.id} c={c} canEdit={canEdit} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <JobDrawer open={open === "job"} onOpenChange={(o) => !o && close()} initial={BLANK_JOB} rooms={rooms} contacts={lite} />
      <ExpenseDrawer open={open === "cost"} onOpenChange={(o) => !o && close()} initial={BLANK_EXPENSE} jobs={jobList} contacts={lite} inbox={inbox} />
    </>
  )
}
