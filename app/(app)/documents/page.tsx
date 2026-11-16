import { Suspense } from "react"
import { FileText, Globe } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { HeaderAction } from "@/components/shell/header-action"
import { MemberOnly } from "@/components/shell/member-only"
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
import { DocActions } from "@/components/documents/doc-actions"
import { editable } from "@/components/documents/editable"
import { DocSearchBox } from "@/components/documents/doc-search"
import { docPlaces, PLACE_SELECT } from "@/lib/doc-place"
import { KindChips } from "./kind-chips"

export default function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  return (
    <>
      <PageHeader
        title="Documents"
        actions={
          <Suspense fallback={null}>
            <MemberOnly>
              <HeaderAction add="link" variant="outline" icon={<Globe />} label="Add Web Link" />
            </MemberOnly>
          </Suspense>
        }
      />
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
        links: { take: 2, select: PLACE_SELECT },
      },
    }),
    db.document.groupBy({ by: ["kind"], where: base, _count: true }),
    fileTargets(c.householdId, c.property.id),
  ])
  const canEdit = atLeast(c.role, "MEMBER")
  const total = counts.reduce((a, x) => a + x._count, 0)
  const chips = DOC_KINDS.filter((k) => counts.some((x) => x.kind === k.id))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <KindChips
          kind={kind ?? null}
          chips={[{ id: null, label: `All · ${total}` }, ...chips.map((k) => ({ id: k.id, label: `${k.label} · ${counts.find((x) => x.kind === k.id)?._count}` }))]}
        />
      </div>
      <DocSearchBox
        scope={{ kind: kind ?? null }}
        param="q"
        placeholder={kind ? "Search inside these documents" : "Search inside all documents"}
        framed
      >
        <p className="text-[13px] font-medium text-muted-foreground">
          {kind ? `Showing ${docs.length} of ${total} documents` : `Showing all documents`}
        </p>
        {docs.length ? (
          <Card>
            <CardContent className="flex flex-col">
              {docs.map((d) => {
                return (
                  <DocumentRow
                    key={d.id}
                    doc={d}
                    label={docPlaces(d.links)}
                    trailing={canEdit ? <DocActions doc={editable(d)} targets={targets} /> : null}
                  />
                )
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
      </DocSearchBox>
      {canEdit ? <AddLink targets={targets} openAdd={sp.add === "link"} /> : null}
    </>
  )
}

