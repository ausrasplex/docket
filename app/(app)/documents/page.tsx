import { Suspense } from "react"
import Link from "next/link"
import { FileText } from "lucide-react"
import { cn } from "cn"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { EmptyState } from "@/components/shell/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DocumentRow } from "@/components/documents/document-row"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { DOC_KINDS } from "@/lib/documents"
import { atLeast } from "@/lib/roles"
import { fileTargets } from "@/lib/targets"
import type { DocumentKind } from "@/generated/prisma/enums"
import { AddLink } from "./add-link"

export default function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  return (
    <>
      <PageHeader title="Documents" />
      <PageBody>
        <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
          <Documents searchParams={searchParams} />
        </Suspense>
      </PageBody>
    </>
  )
}

async function Documents({ searchParams }: { searchParams: PageProps<"/documents">["searchParams"] }) {
  const sp = await searchParams
  const c = await requireHousehold()
  const kind = DOC_KINDS.find((k) => k.id === sp.kind)?.id as DocumentKind | undefined
  const base = { householdId: c.householdId, archivedAt: null }
  const [docs, counts, targets] = await Promise.all([
    db.document.findMany({
      where: { ...base, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        links: {
          take: 2,
          select: { label: true, space: { select: { name: true } }, fixture: { select: { name: true, parent: { select: { name: true } } } },
            finish: { select: { colourName: true, colourCode: true, product: true, space: { select: { name: true } } } },
          },
        },
      },
    }),
    db.document.groupBy({ by: ["kind"], where: base, _count: true }),
    fileTargets(c.householdId, c.property.id),
  ])
  const total = counts.reduce((a, x) => a + x._count, 0)
  const chips = DOC_KINDS.filter((k) => counts.some((x) => x.kind === k.id))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 desk:mx-0 desk:flex-wrap desk:px-0">
          <Chip href="/documents" on={!kind} label={`All · ${total}`} />
          {chips.map((k) => (
            <Chip key={k.id} href={`/documents?kind=${k.id}`} on={kind === k.id} label={`${k.label} · ${counts.find((x) => x.kind === k.id)?._count}`} />
          ))}
        </div>
        {atLeast(c.role, "MEMBER") ? <AddLink targets={targets} /> : null}
      </div>
      <p className="text-[13px] font-medium text-muted-foreground">
        {kind ? `Showing ${docs.length} of ${total} documents` : `Showing all documents`}
      </p>
      {docs.length ? (
        <Card>
          <CardContent className="flex flex-col">
            {docs.map((d) => {
              const where = d.links
                .map((l) => {
                  const place = l.fixture
                    ? [l.fixture.parent?.name, l.fixture.name].filter(Boolean).join(" › ")
                    : l.finish
                      ? `${l.finish.space.name} › ${l.finish.colourName ?? l.finish.colourCode ?? l.finish.product ?? "Paint"}`
                      : l.space?.name
                  return [place, l.label].filter(Boolean).join(" · ")
                })
                .filter(Boolean)
              return <DocumentRow key={d.id} doc={d} label={where.length ? where.join(", ") : "Inbox"} />
            })}
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          icon={<FileText className="size-6" />}
          title="No Documents Yet"
          body="Manuals, receipts, warranties, certificates and photos all end up here. Start by capturing one."
          action={{ href: "/capture", label: "Capture" }}
        />
      )}
    </>
  )
}

function Chip({ href, on, label }: { href: string; on: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex min-h-11 flex-none items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap",
        on ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2"
      )}
    >
      {label}
    </Link>
  )
}
