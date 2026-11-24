import { Suspense } from "react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft, ExternalLink, LifeBuoy, Package } from "lucide-react"
import { cn } from "cn"
import { PageBody, PageTitle } from "@/components/shell/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DocGroups } from "@/components/documents/doc-groups"
import { Swatch } from "@/components/finishes/finish-list"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { date } from "@/lib/format"
import { colourTitle, finishKindLabel, surfaceLabel } from "@/lib/finishes"
import { loadFinishes } from "@/lib/finish-rows"
import { atLeast } from "@/lib/roles"
import { BrandCard } from "../../fixtures/[id]/brand-card"
import { PaintMenu } from "./paint-menu"

export default function PaintPage({ params }: PageProps<"/paint/[id]">) {
  return (
    <Suspense
      fallback={
        <PageBody>
          <Skeleton className="mt-6 h-60 rounded-3xl" />
        </PageBody>
      }
    >
      <Paint params={params} />
    </Suspense>
  )
}

/**
 * A paint or finish, laid out like an item's page (without servicing or parts): what it is, its details and
 * brand, every room the same colour is used in, and its photos, receipts and data sheets.
 */
async function Paint({ params }: { params: PageProps<"/paint/[id]">["params"] }) {
  const { id } = await params
  const c = await requireHousehold()
  const f = await db.finish.findFirst({
    where: { id, householdId: c.householdId },
    include: { brand: true, space: { select: { id: true, name: true, slug: true, propertyId: true } } },
  })
  if (!f) notFound()

  // the same colour elsewhere in the property (same brand, name, code and type): one paint, several rooms
  const sameColour = {
    householdId: c.householdId,
    kind: f.kind,
    brandId: f.brandId,
    colourName: f.colourName,
    colourCode: f.colourCode,
    archivedAt: null,
    space: { propertyId: f.space.propertyId, archivedAt: null },
  }
  const [rows, used, rooms, brands, inbox] = await Promise.all([
    loadFinishes({ id: f.id, archivedAt: undefined }),
    db.finish.findMany({
      where: { OR: [sameColour, { id: f.id }] },
      orderBy: [{ space: { sortOrder: "asc" } }, { surface: "asc" }],
      include: {
        space: { select: { name: true, slug: true } },
        links: { where: { document: { archivedAt: null } }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { document: true } },
      },
    }),
    db.space.findMany({
      where: { householdId: c.householdId, propertyId: f.space.propertyId, archivedAt: null, kind: { not: "FLOOR" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.brand.findMany({ where: { householdId: c.householdId, archivedAt: null }, orderBy: { name: "asc" }, select: { name: true } }),
    db.document.findMany({
      where: { householdId: c.householdId, archivedAt: null, links: { none: {} } },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { id: true, title: true, kind: true, thumbnailKey: true, url: true, createdAt: true },
    }),
  ])
  const row = rows[0]
  if (!row) notFound()

  // documents filed to this colour in any of its rooms, once each
  const seen = new Set<string>()
  const docs = used
    .flatMap((u) => u.links)
    .filter((l) => (seen.has(l.document.id) ? false : (seen.add(l.document.id), true)))
    .map((l) => ({ linkId: l.id, label: l.label, doc: l.document }))

  const canEdit = atLeast(c.role, "MEMBER")
  const title = colourTitle(f)
  const brandLine = [f.brand?.name, f.product && f.product !== title ? f.product : null].filter(Boolean).join(" ")
  const support = f.brand?.supportUrl ?? f.brand?.website ?? null

  return (
    <>
      <PageTitle>
        <Link href="/paint" aria-label="Back to paint" className="flex size-11 flex-none items-center justify-center rounded-full bg-surface hover:bg-surface2">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate">{title}</h1>
        {canEdit ? <PaintMenu row={row} archived={!!f.archivedAt} rooms={rooms} brands={brands.map((b) => b.name)} /> : null}
      </PageTitle>
      <PageBody>
        {f.archivedAt ? (
          <p className="rounded-[14px] bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">This is archived from {f.space.name}. Restore it from the ⋯ menu.</p>
        ) : null}

        {/* Summary: the colour, what it is, where it is, and the links people reach for */}
        <div className="flex flex-wrap items-center gap-3">
          <Swatch hex={f.hex} size={56} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-bold">{brandLine || finishKindLabel(f.kind)}</span>
            <span className="text-[13px] font-medium text-muted-foreground">
              {[f.colourCode, brandLine ? finishKindLabel(f.kind) : null].filter(Boolean).join(" · ")}
              {f.colourCode || brandLine ? " · " : null}
              <Link href={`/rooms/${f.space.slug}`} className="font-semibold text-ink hover:underline">
                {f.space.name}
              </Link>
              {used.length > 1 ? ` and ${used.length - 1} more` : null}
            </span>
          </div>
          <div className="flex w-full flex-wrap gap-2 desk:w-auto">
            {f.productUrl ? (
              <a href={f.productUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:shadow-[inset_0_0_0_999px_color-mix(in_srgb,var(--primaryInk)_14%,transparent)]">
                <ExternalLink className="size-[18px]" />
                Colour Page
              </a>
            ) : null}
            {support ? (
              <a href={support} target="_blank" rel="noopener noreferrer" className={cn("flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold", f.productUrl ? "border border-outline hover:bg-surface2" : "bg-primary text-primary-foreground")}>
                <LifeBuoy className="size-[18px]" />
                {f.brand?.name} Support
              </a>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 desk:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
                <Row k="Colour" v={f.colourName} />
                <Row k="Code" v={f.colourCode} mono />
                <Row k="Product" v={f.product} />
                <Row k="Type" v={finishKindLabel(f.kind)} />
                {f.sheen ? <Row k="Sheen" v={f.sheen} /> : null}
                <Row k="Size" v={f.size} />
                <Row k="Where Bought" v={f.store} />
                <Row k="Applied" v={f.appliedAt ? date(f.appliedAt) : null} />
                <dt className="font-semibold text-muted-foreground">Leftover</dt>
                <dd>
                  {f.leftoverLocation ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-t3 px-2.5 py-1 text-xs font-bold">
                      <Package className="size-3.5" />
                      {f.leftoverLocation}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </dd>
              </dl>
              {f.notes ? <p className="mt-4 rounded-2xl bg-surface2 px-4 py-3 text-sm whitespace-pre-line">{f.notes}</p> : null}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-5">
            {f.brand ? (
              <BrandCard
                canEdit={canEdit}
                brand={{
                  id: f.brand.id,
                  name: f.brand.name,
                  website: f.brand.website,
                  supportUrl: f.brand.supportUrl,
                  supportPhone: f.brand.supportPhone,
                  supportEmail: f.brand.supportEmail,
                  notes: f.brand.notes,
                }}
              />
            ) : null}
            <Card>
              <CardHeader>
                <CardTitle>Used In</CardTitle>
                <CardDescription>Every room with this colour, and which surface.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col">
                  {used.map((u) => (
                    <li key={u.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <Link href={`/rooms/${u.space.slug}`} className="truncate text-sm font-bold hover:underline">
                          {u.space.name}
                        </Link>
                        <span className="truncate text-xs font-medium text-muted-foreground">
                          {[surfaceLabel(u.surface) + (u.surfaceNote ? ` (${u.surfaceNote})` : ""), u.sheen, u.appliedAt ? `applied ${date(u.appliedAt)}` : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {u.id === f.id ? (
                        <span className="text-xs font-semibold text-muted-foreground">This one</span>
                      ) : (
                        <Link href={`/paint/${u.id}`} className="text-xs font-semibold hover:underline">
                          Open
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card id="documents" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Photos, Receipts and Documents</CardTitle>
            <CardDescription>
              The tin or sample, the receipt, the data sheet or colour card. {used.length > 1 ? "Shown on every room with this colour." : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocGroups
              canEdit={canEdit}
              groups={[{ target: { type: "finish", id: f.id }, name: title, removeLabel: "Paint", docs }]}
              inbox={inbox.map((d) => ({ id: d.id, title: d.title, kind: d.kind, hasThumb: !!d.thumbnailKey, isLink: !!d.url, when: date(d.createdAt) }))}
            />
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}

function Row({ k, v, mono }: { k: string; v: string | null | undefined; mono?: boolean }) {
  return (
    <>
      <dt className="font-semibold text-muted-foreground">{k}</dt>
      <dd className={cn(v ? "" : "text-muted-foreground", mono && v ? "font-mono text-[13px] select-all" : "")}>{v || "—"}</dd>
    </>
  )
}
