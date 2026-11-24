import { Suspense } from "react"
import { Inbox as InboxIcon } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { atLeast } from "@/lib/roles"
import { CaptureButtons } from "./capture-buttons"
import { Inbox } from "./inbox"

export const metadata = { title: "Capture · Docket" }

export default function CapturePage() {
  return (
    <>
      <PageHeader title="Capture" />
      <PageBody>
        <p className="-mt-1 text-sm text-muted-foreground">Photograph it now, file it later. Everything lands in the inbox until it&apos;s filed.</p>
        <CaptureButtons />
        <Suspense fallback={<Skeleton className="h-48 rounded-3xl" />}>
          <InboxSection />
        </Suspense>
      </PageBody>
    </>
  )
}

async function InboxSection() {
  const c = await requireHousehold()
  const docs = await db.document.findMany({
    where: { householdId: c.householdId, archivedAt: null, links: { none: {} } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  const users = await db.user.findMany({
    where: { id: { in: [...new Set(docs.map((d) => d.createdById).filter((x): x is string => !!x))] } },
    select: { id: true, name: true },
  })
  const nameOf = new Map(users.map((u) => [u.id, u.name.split(" ")[0]]))

  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2">
        <InboxIcon className="size-5" />
        Inbox
        {docs.length ? <span className="text-base font-semibold text-muted-foreground">{docs.length}</span> : null}
      </h2>
      {docs.length ? (
        <Inbox
          canEdit={atLeast(c.role, "MEMBER")}
          items={docs.map((d) => ({
            id: d.id,
            title: d.title,
            kind: d.kind,
            notes: d.notes,
            documentDate: d.documentDate ? d.documentDate.toISOString().slice(0, 10) : null,
            hasThumb: !!d.thumbnailKey,
            isPdf: d.mimeType === "application/pdf",
            isLink: !!d.url,
            url: d.url,
            when: d.createdAt.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }),
            by: d.createdById ? (nameOf.get(d.createdById) ?? null) : null,
          }))}
        />
      ) : (
        <p className="rounded-3xl bg-surface px-5 py-6 text-sm text-muted-foreground">All filed. New captures will show up here.</p>
      )}
    </section>
  )
}
