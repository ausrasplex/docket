import { Suspense } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, ExternalLink, LifeBuoy, Phone } from "lucide-react"
import { cn } from "cn"
import { PageBody, PageTitle } from "@/components/shell/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { category, warranty } from "@/lib/fixtures"
import { date, money } from "@/lib/format"
import { atLeast } from "@/lib/roles"
import { FixtureMenu } from "./fixture-menu"
import { ServiceCard, type PlanRow, type RecordRow } from "./service-card"
import { DUE_TONE, formatKm, intervalText, regoDue, serviceDue } from "@/lib/service"
import { contactLite, loadContacts } from "@/lib/job-rows"
import { CategoryTile, itemPhotoSrc } from "@/components/fixtures/category-tile"
import { CoverPhotoButton, type CoverTarget } from "@/components/covers/cover-photo"
import { activeCoverId } from "@/components/covers/cover-src"
import { BrandCard } from "./brand-card"
import { PartsList } from "./parts-list"
import { DocGroups, type DocGroup } from "@/components/documents/doc-groups"
import { DocSearchBox } from "./doc-search"
import type { FixtureInput } from "../actions"

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
  portable: boolean
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
  registration: string | null
  vin: string | null
  registrationExpiresAt: Date | null
  odometer: number | null
}): FixtureInput {
  return {
    name: f.name,
    category: f.category,
    spaceId: f.spaceId,
    portable: f.portable,
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
    registration: f.registration ?? "",
    vin: f.vin ?? "",
    registrationExpiresAt: iso(f.registrationExpiresAt),
    odometer: f.odometer != null ? String(f.odometer) : "",
  }
}

async function Fixture({ params }: { params: PageProps<"/fixtures/[id]">["params"] }) {
  const { id } = await params // items are addressed by their id
  const c = await requireHousehold()
  const docInclude = {
    where: { document: { archivedAt: null } },
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    include: { document: true },
  }
  const f = await db.fixture.findFirst({
    where: { id, householdId: c.householdId },
    include: {
      brand: true,
      space: { select: { id: true, name: true, slug: true } },
      parent: { select: { id: true, name: true } },
      cover: { select: { id: true, archivedAt: true } },
      links: docInclude,
      parts: {
        where: { archivedAt: null },
        orderBy: { sortOrder: "asc" },
        include: { brand: true, space: { select: { id: true, name: true } }, links: docInclude, cover: { select: { id: true, archivedAt: true } } },
      },
    },
  })
  if (!f) notFound()
  // a part's page is its item's page
  if (f.parent) redirect(`/fixtures/${f.parent.id}#part-${f.id}`)

  const [others, rooms, brands, inbox, plans, records, contacts] = await Promise.all([
    // items this one can share documents with (Share Documents in its menu)
    db.fixture.findMany({
      where: { householdId: c.householdId, parentId: null, id: { not: f.id }, OR: [{ archivedAt: null }, ...(f.docSetId ? [{ docSetId: f.docSetId }] : [])] },
      orderBy: { name: "asc" },
      select: { id: true, name: true, model: true, docSetId: true, portable: true, brand: { select: { name: true } }, space: { select: { name: true } } },
    }),
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
    db.servicePlan.findMany({ where: { fixtureId: f.id, archivedAt: null }, orderBy: { createdAt: "asc" } }),
    db.serviceRecord.findMany({
      where: { fixtureId: f.id },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      include: {
        plans: { select: { id: true } },
        contact: { select: { name: true } },
        expense: { include: { links: { where: { document: { archivedAt: null } }, include: { document: true } } } },
      },
    }),
    loadContacts(c.householdId),
  ])
  // when each routine is next due, from the latest service that covered it
  const planRows: PlanRow[] = plans.map((p) => {
    const last = records.find((r) => r.plans.some((x) => x.id === p.id)) ?? null
    return { id: p.id, name: p.name, everyMonths: p.everyMonths, everyKm: p.everyKm, notes: p.notes, interval: intervalText(p), due: serviceDue(p, last, f.odometer) }
  })
  const recordRows: RecordRow[] = records.map((r) => ({
    id: r.id,
    date: r.date.toISOString().slice(0, 10),
    odometer: r.odometer,
    title: r.title,
    notes: r.notes,
    planIds: r.plans.map((x) => x.id),
    contactId: r.contactId,
    who: r.contact?.name ?? null,
    vendor: r.expense?.vendor ?? null,
    amount: r.expense && !r.expense.archivedAt ? r.expense.amount.toFixed(2) : null,
    gst: r.expense?.gst ? r.expense.gst.toFixed(2) : null,
    expenseId: r.expenseId,
    receipts: r.expense?.links.map((l) => ({ linkId: l.id, doc: l.document })) ?? [],
  }))
  const isVehicle = f.category === "VEHICLE"
  const rego = regoDue(f.registrationExpiresAt)

  const canEdit = atLeast(c.role, "MEMBER")
  const cat = category(f.category)
  const makeModel = [f.brand?.name, f.model].filter(Boolean).join(" ")
  const w = warranty(f.warrantyExpiresAt)
  const support = f.brand?.supportUrl ?? f.brand?.website ?? null
  const brandNames = brands.map((b) => b.name)
  // photos filed to the item (or a part) can be picked as its photo
  const photosOf = (links: { document: { id: string; title: string; thumbnailKey: string | null } }[]) =>
    links.filter((l) => l.document.thumbnailKey).map((l) => ({ id: l.document.id, title: l.document.title }))
  const itemPhoto: CoverTarget = {
    kind: "fixture",
    id: f.id,
    name: f.name,
    noun: "Item",
    coverId: activeCoverId(f),
    src: itemPhotoSrc(f),
    icon: { type: "fixture", category: f.category },
    cropHref: `/fixtures/${f.id}/photo`,
  }

  const groups: DocGroup[] = [
    { target: { type: "fixture", id: f.id }, name: f.parts.length ? "Whole Item" : f.name, isPart: false, docs: f.links.map((l) => ({ linkId: l.id, label: l.label, doc: l.document })) },
    ...f.parts.map((p) => ({
      target: { type: "fixture" as const, id: p.id },
      name: p.name,
      isPart: true,
      docs: p.links.map((l) => ({ linkId: l.id, label: l.label, doc: l.document })),
    })),
  ]

  // the same product first (most likely its other copies), then everything else
  const same = (x: { name: string }) => x.name.trim().toLowerCase() === f.name.trim().toLowerCase()
  const shareWith = [...others.filter(same), ...others.filter((x) => !same(x))].map((x) => ({
    id: x.id,
    name: x.name,
    detail: [x.space?.name ?? (x.portable ? "Portable" : "No room"), [x.brand?.name, x.model].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
    inSet: !!f.docSetId && x.docSetId === f.docSetId,
  }))
  const copies = shareWith.filter((x) => x.inSet).length

  return (
    <>
      <PageTitle>
        <Link href="/fixtures" aria-label="Back to fixtures" className="flex size-11 flex-none items-center justify-center rounded-full bg-surface hover:bg-surface2">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate">{f.name}</h1>
        {canEdit ? (
          <FixtureMenu id={f.id} name={f.name} archived={!!f.archivedAt} initial={toInput(f)} rooms={rooms} brands={brandNames} photo={itemPhoto} photos={photosOf(f.links)} parts={f.parts.map((p) => ({ id: p.id, name: p.name }))} shareWith={shareWith} />
        ) : null}
      </PageTitle>
      <PageBody>
        {f.archivedAt ? (
          <p className="rounded-[14px] bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">This item is archived. Restore it from the ⋯ menu.</p>
        ) : null}

        {/* Summary: what it is, where it is, and the two links people reach for */}
        <div className="flex flex-wrap items-center gap-3">
          {canEdit ? (
            <CoverPhotoButton target={itemPhoto} photos={photosOf(f.links)} className="size-14" />
          ) : (
            <CategoryTile value={f.category} src={itemPhoto.src} className="size-14" />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* make and model on top when known; otherwise the category goes there instead of appearing twice */}
            <span className="text-[15px] font-bold">{makeModel || cat.label}</span>
            <span className="text-[13px] font-medium text-muted-foreground">
              {makeModel ? cat.label : null}
              {f.space ? (
                <>
                  {makeModel ? " · " : null}
                  <Link href={`/rooms/${f.space.slug}`} className="font-semibold text-ink hover:underline">
                    {f.space.name}
                  </Link>
                </>
              ) : f.portable ? (
                <>
                  {makeModel ? " · " : null}
                  <span className="font-semibold text-ink">Portable</span>
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
                {isVehicle ? (
                  <>
                    <Row k="Registration" v={f.registration} mono />
                    <dt className="font-semibold text-muted-foreground">Rego</dt>
                    <dd>
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", DUE_TONE[rego.tone])}>{rego.text}</span>
                    </dd>
                    <Row k="VIN" v={f.vin} mono />
                    <Row k="Odometer" v={f.odometer != null ? formatKm(f.odometer) : null} />
                  </>
                ) : null}
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
                    photos: photosOf(p.links),
                    photo: {
                      kind: "fixture",
                      id: p.id,
                      name: p.name,
                      noun: "Part",
                      coverId: activeCoverId(p),
                      src: itemPhotoSrc(p),
                      icon: { type: "part" },
                      cropHref: `/fixtures/${p.id}/photo`,
                    },
                  }))}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Service</CardTitle>
            <CardDescription>
              {isVehicle ? "Routines like the logbook service, and every service done, with costs and receipts." : "Regular care, like an annual service, and when it was done."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ServiceCard
              fixtureId={f.id}
              itemName={f.name}
              odometer={f.odometer}
              plans={planRows}
              records={recordRows}
              contacts={contacts.map(contactLite)}
              inbox={inbox.map((d) => ({ id: d.id, title: d.title, kind: d.kind, hasThumb: !!d.thumbnailKey, isLink: !!d.url, when: date(d.createdAt) }))}
              canEdit={canEdit}
            />
          </CardContent>
        </Card>

        <Card id="documents" className="scroll-mt-24">
          <CardHeader>
            <CardTitle>Manuals, Links and Documents</CardTitle>
            <CardDescription>
              {f.parts.length ? "Grouped by part. Add as many as you like to each." : "Add as many as you like: manuals, warranty, receipts, support pages."}
              {copies ? ` Manuals, warranties and links are shared with ${copies === 1 ? "1 other copy" : `${copies} other copies`}; receipts and photos stay on this one.` : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              const list = (
                <DocGroups
                  canEdit={canEdit}
                  groups={groups}
                  inbox={inbox.map((d) => ({ id: d.id, title: d.title, kind: d.kind, hasThumb: !!d.thumbnailKey, isLink: !!d.url, when: date(d.createdAt) }))}
                />
              )
              // searching needs something to search: this item's own documents
              return f.links.length ? <DocSearchBox fixtureId={f.id}>{list}</DocSearchBox> : list
            })()}
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
