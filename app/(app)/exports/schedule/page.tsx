import { Suspense } from "react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { requireHousehold } from "@/lib/dal"
import { schedule } from "@/lib/schedule"
import { SchedulePicker } from "./picker"

export const metadata = { title: "Fixtures and Finishes · Docket" }

export default function SchedulePage() {
  return (
    <>
      <PageHeader
        title="Fixtures and Finishes"
        subtitle="A printable record of what's in the house, by trade and then by room: each product, where it was bought, and its colour, finish and size."
      />
      <PageBody>
        <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
          <Sections />
        </Suspense>
      </PageBody>
    </>
  )
}

async function Sections() {
  const c = await requireHousehold()
  const all = await schedule(c.householdId, c.property.id)
  return (
    <SchedulePicker
      property={c.property.name}
      sections={all.map((x) => ({
        id: x.group.id,
        label: x.group.label,
        hint: x.group.hint,
        on: x.group.on,
        count: x.count,
        rooms: x.rooms.map((r) => r.room),
        missing: x.rooms.reduce((n, r) => n + r.rows.filter((row) => !row.store && !row.look).length, 0),
      }))}
    />
  )
}
