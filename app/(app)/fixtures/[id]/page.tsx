import { Suspense } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, ExternalLink, LifeBuoy, Phone } from "lucide-react"
import { cn } from "cn"
import { PageBody } from "@/components/shell/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { category, warranty } from "@/lib/fixtures"
import { date, money } from "@/lib/format"
import { atLeast } from "@/lib/roles"
import { FixtureMenu } from "./fixture-menu"
import { BrandCard } from "./brand-card"
import { PartsList } from "./parts-list"
import { DocGroups, type DocGroup } from "@/components/documents/doc-groups"
import type { FixtureInput } from "../actions"
import { bySlugOrId } from "@/lib/slug"

const TONE = { a1: "bg-a1", a2: "bg-a2", a3: "bg-a3" } as const
const WARRANTY_TONE = { ok: "bg-t3", soon: "bg-t2", expired: "bg-danger-soft text-danger", none: "bg-surface2" } as const

export default function FixturePage({ params }: PageProps<"/fixtures/[id]">) {
  return (
    <Suspense
      fallback={
        <PageBody>
          <Skeleton className="mt-6 h-60 rounded-3xl" />
        </PageBody>
      }
    >
      <Fixture params={params} />
    </Suspense>
  )
}

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)

function toInput(f: {
  name: string
  category: FixtureInput["category"]
  spaceId: string | null
  brand: { name: string } | null
  model: string | null
  serial: string | null
  productUrl: string | null
  purchasedAt: Date | null
  installedAt: Date | null
  warrantyExpiresAt: Date | null
  purchasePrice: { toString(): string } | null
  replacementValue: { toString(): string } | null
  includedInSale: boolean
  notes: string | null
}): FixtureInput {
  return {
    name: f.name,
    category: f.category,
    spaceId: f.spaceId,
    brand: f.brand?.name ?? "",
    model: f.model ?? "",
    serial: f.serial ?? "",
    productUrl: f.productUrl ?? "",
    purchasedAt: iso(f.purchasedAt),
    installedAt: iso(f.installedAt),
    warrantyExpiresAt: iso(f.warrantyExpiresAt),
    purchasePrice: f.purchasePrice?.toString() ?? "",
    replacementValue: f.replacementValue?.toString() ?? "",
    includedInSale: f.includedInSale,
    notes: f.notes ?? "",
  }
}

async function Fixture({ params }: { params: PageProps<"/fixtures/[id]">["params"] }) {
  const { id: param } = await params // the item's slug (or its id, from old links)
  const c = await requireHousehold()
  const docInclude = {
    where: { document: { archivedAt: null } },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    include: { document: true },
  }
  const f = await db.fixture.findFirst({
    where: bySlugOrId(c.householdId, param),
    include: {
      brand: true,
      space: { select: { id: true, name: true, slug: true } },
      parent: { select: { id: true, name: true, slug: true } },
      links: docInclude,
      parts: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: { brand: true, space: { select: { id: true, name: true } }, links: docInclude },
      },
    },
  })
  if (!f) notFound()
  // a part's page is its item's page
  if (f.parent) redirect(`/fixtures/${f.parent.slug}#part-${f.id}`)
  if (param !== f.slug) redirect(`/fixtures/${f.slug}`)

  const [rooms, brands, inbox] = await Promise.all([
    db.space.findMany({
      where: { householdId: c.householdId, propertyId: f.propertyId, archivedAt: null, kind: { not: "FLOOR" } },
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

  const canEdit = atLeast(c.role, "MEMBER")
  const cat = category(f.category)
  const w = warranty(f.warrantyExpiresAt)
  const support = f.brand?.supportUrl ?? f.brand?.website ?? null
  const brandNames = brands.map((b) => b.name)

  const groups: DocGroup[] = [
    { target: { type: "fixture", id: f.id }, name: f.parts.length ? "Whole Item" : f.name, isPart: false, docs: f.links.map((l) => ({ linkId: l.id, label: l.label, doc: l.document })) },
    ...f.parts.map((p) => ({
      target: { type: "fixture" as const, id: p.id },
      name: p.name,
      isPart: true,
      docs: p.links.map((l) => ({ linkId: l.id, label: l.label, doc: l.document })),
    })),
  ]

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mb-2 border-b border-line bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] px-4 py-2.5 backdrop-blur-[16px] desk:-mx-8 desk:px-8 desk:py-3.5">
        <div className="mx-auto flex min-h-11 max-w-[1100px] items-center gap-2.5">
          <Link href="/fixtures" aria-label="Back to fixtures" className="flex size-11 flex-none items-center justify-center rounded-full bg-surface hover:bg-surface2">
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate">{f.name}</h1>
          {canEdit ? (
            <FixtureMenu id={f.id} slug={f.slug} name={f.name} archived={!!f.archivedAt} initial={toInput(f)} rooms={rooms} brands={brandNames} />
          ) : null}
        </div>
      </div>
      <PageBody>
        {f.archivedAt ? (
          <p className="rounded-[14px] bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">This item is archived. Restore it from the ⋯ menu.</p>
        ) : null}

        {/* Summary: what it is, where it is, and the two links people reach for */}
        <div className="flex flex-wrap items-center gap-3">
          <span className={cn("flex size-14 flex-none items-center justify-center rounded-2xl text-on-a", TONE[cat.tone])}>
            <cat.icon className="size-7" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[15px] font-bold">{[f.brand?.name, f.model].filter(Boolean).join(" ") || cat.label}</span>
            <span className="text-[13px] font-medium text-muted-foreground">
              {cat.label}
              {f.space ? (
                <>
                  {" · "}
                  <Link href={`/rooms/${f.space.slug}`} className="font-semibold text-ink hover:underline">
                    {f.space.name}
                  </Link>
                </>
              ) : null}
            </span>
          </div>
          <div className="flex w-full flex-wrap gap-2 desk:w-auto">
            {f.productUrl ? (
              <a href={f.productUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground hover:shadow-[inset_0_0_0_999px_color-mix(in_srgb,var(--primaryInk)_14%,transparent)]">
                <ExternalLink className="size-[18px]" />
                Product Page
              </a>
            ) : null}
            {support ? (
              <a href={support} target="_blank" rel="noopener noreferrer" className={cn("flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold", f.productUrl ? "border border-outline hover:bg-surface2" : "bg-primary text-primary-foreground")}>
                <LifeBuoy className="size-[18px]" />
                {f.brand?.name} Support
              </a>
            ) : null}
            {f.brand?.supportPhone ? (
              <a href={`tel:${f.brand.supportPhone.replace(/\s/g, "")}`} className="flex min-h-11 items-center gap-2 rounded-full border border-outline px-4 text-sm font-semibold hover:bg-surface2">
                <Phone className="size-[18px]" />
                {f.brand.supportPhone}
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
                <Row k="Model" v={f.model} mono />
                <Row k="Serial" v={f.serial} mono />
                <Row k="Bought" v={date(f.purchasedAt)} />
                <Row k="Installed" v={date(f.installedAt)} />
                <dt className="font-semibold text-muted-foreground">Warranty</dt>
                <dd>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", WARRANTY_TONE[w.tone])}>{w.text}</span>
                </dd>
                <Row k="Price Paid" v={f.purchasePrice ? money(f.purchasePrice, true) : null} />
                <Row k="Replacement" v={f.replacementValue ? money(f.replacementValue, true) : null} />
                <Row k="If You Sell" v={f.includedInSale ? "Stays with the house" : "Comes with you"} />
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
                <CardTitle>Parts</CardTitle>
                <CardDescription>Pieces with their own model, serial, warranty or manual.</CardDescription>
              </CardHeader>
              <CardContent>
                <PartsList
                  canEdit={canEdit}
                  parent={{ id: f.id, name: f.name, brand: f.brand?.name ?? "" }}
                  rooms={rooms}
                  brands={brandNames}
                  parts={f.parts.map((p) => ({
                    id: p.id,
                    name: p.name,
                    makeModel: [p.brand?.name, p.model].filter(Boolean).join(" "),
                    serial: p.serial,
                    room: p.space && p.space.id !== f.spaceId ? p.space.name : null,
                    warranty: warranty(p.warrantyExpiresAt),
                    support: p.productUrl ?? p.brand?.supportUrl ?? p.brand?.website ?? null,
                    docs: p.links.length,
                    input: toInput(p),
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Manuals, Links and Documents</CardTitle>
            <CardDescription>
              {f.parts.length ? "Grouped by part. Add as many as you like to each." : "Add as many as you like: manuals, warranty, receipts, support pages."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DocGroups
              canEdit={canEdit}
              groups={groups}
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
