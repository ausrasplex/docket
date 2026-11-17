import { Suspense } from "react"
import Link from "next/link"
import { CircleAlert, Download, Images, Package, ReceiptText } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { requireHousehold } from "@/lib/dal"
import { date, money } from "@/lib/format"
import { insuranceReport, lineValue, type InsuranceLine } from "@/lib/insurance"
import { PrintButton } from "./print-button"

export const metadata = { title: "Insurance Report · Docket" }

export default function InsurancePage() {
  return (
    <>
      <PageHeader
        title="Insurance Report"
        subtitle="Everything at this property with its serial, value and proof of purchase: what an insurer asks for after a break-in, fire or flood."
        actions={
          <div className="flex flex-none items-center gap-2 print:hidden">
            <PrintButton />
            <Button asChild size="sm" className="max-desk:size-11 max-desk:px-0">
              <a href="/api/exports/insurance" download title="Download the pack: a spreadsheet, photos and receipts (ZIP)">
                <Download />
                <span className="max-desk:sr-only">Download Pack</span>
              </a>
            </Button>
          </div>
        }
      />
      <PageBody>
        <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
          <Report />
        </Suspense>
      </PageBody>
    </>
  )
}

const value = (n: number | null) => (n == null ? "" : money(n))

async function Report() {
  const c = await requireHousehold()
  const r = await insuranceReport(c.householdId, c.property.id)
  const made = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: process.env.TZ || undefined })

  if (!r.totals.items) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-3xl bg-surface p-6">
        <p className="text-sm font-medium text-muted-foreground">There are no items at {r.property} yet. Add your appliances, electronics and furniture, and they&apos;ll be listed here.</p>
        <Button asChild size="sm">
          <Link href="/fixtures?add=1">Add an Item</Link>
        </Button>
      </div>
    )
  }

  const gaps = [
    { list: r.gaps.noValue, icon: Package, title: "No value recorded", hint: "Add a purchase price or replacement value." },
    { list: r.gaps.noProof, icon: ReceiptText, title: "No receipt, invoice or warranty", hint: "Photograph the receipt, or file the invoice from the shop's email." },
    { list: r.gaps.noPhoto, icon: Images, title: "No photo", hint: "A photo shows the item was there and what condition it was in." },
  ].filter((g) => g.list.length)

  return (
    <div className="flex flex-col gap-5 print:gap-4">
      {/* the report's own heading on paper (the page title above prints too; this adds who and when) */}
      <section className="grid grid-cols-2 gap-3 desk:grid-cols-4 print:grid-cols-4">
        <Stat label="Property" value={r.property} detail={r.address ?? r.household} />
        <Stat label="Items" value={String(r.totals.items)} detail={`Made ${made}`} />
        <Stat label="Total value" value={money(r.totals.value)} detail={`Contents ${money(r.totals.contents)} · Building ${money(r.totals.building)}`} />
        <Stat
          label="Replacement values"
          value={r.totals.replacement ? money(r.totals.replacement) : "None yet"}
          detail={r.totals.replacement ? `Paid ${money(r.totals.purchase)} in all` : "Items count at what was paid"}
        />
      </section>

      {gaps.length ? (
        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 print:hidden">
          <h2 className="flex items-center gap-2">
            <CircleAlert className="size-5 text-muted-foreground" />
            Worth Filling In
          </h2>
          <p className="-mt-1 text-sm font-medium text-muted-foreground">Gaps an insurer could query. Only you see this; it isn&apos;t printed.</p>
          <div className="grid grid-cols-1 gap-3 desk:grid-cols-3">
            {gaps.map((g) => (
              <details key={g.title} className="group rounded-2xl bg-surface2 p-3">
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="flex size-9 flex-none items-center justify-center rounded-xl bg-a1 text-on-a">
                    <g.icon className="size-4" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <b className="text-sm">
                      {g.list.length} {g.title.toLowerCase()}
                    </b>
                    <span className="text-xs font-medium text-muted-foreground">{g.hint}</span>
                  </span>
                </summary>
                <ul className="mt-2 flex flex-col gap-1 pl-12 text-sm">
                  {g.list.map((l) => (
                    <li key={l.id}>
                      <Link href={`/fixtures/${l.id}`} className="font-semibold underline-offset-2 hover:underline">
                        {l.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {r.rooms.map((g) => {
        const roomTotal = g.lines.reduce((n, l) => n + lineValue(l), 0)
        return (
          <section key={g.room} className="flex flex-col gap-2 rounded-3xl bg-surface p-5 print:break-inside-auto print:rounded-none print:p-0">
            <div className="flex items-baseline justify-between gap-3 border-b border-line pb-2">
              <h2>{g.room}</h2>
              {roomTotal ? <span className="text-sm font-bold tabular-nums">{money(roomTotal)}</span> : null}
            </div>
            <ul className="flex flex-col">
              {g.lines.map((l) => (
                <Line key={l.id} l={l} />
              ))}
            </ul>
          </section>
        )
      })}

      <p className="text-xs font-medium text-muted-foreground">
        Values are as recorded in Docket on {made}. Replacement values are the household&apos;s own estimates. Receipts, invoices, warranties and
        photos for each item are in the downloadable pack.
      </p>
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-3xl bg-surface p-4 print:rounded-xl print:border print:border-line print:p-3">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <b className="truncate text-lg font-bold tabular-nums">{value}</b>
      {detail ? <span className="truncate text-xs font-medium text-muted-foreground print:whitespace-normal">{detail}</span> : null}
    </div>
  )
}

function Line({ l }: { l: InsuranceLine }) {
  const facts = [
    l.serial ? `Serial ${l.serial}` : null,
    l.purchasedAt ? `Bought ${date(l.purchasedAt)}` : null,
    l.warrantyExpiresAt ? `Warranty to ${date(l.warrantyExpiresAt)}` : null,
    l.cover,
  ].filter(Boolean)
  const receipts = l.proof.filter((d) => d.kind !== "PHOTO").length
  const photos = l.proof.length - receipts + (l.photo ? 1 : 0)
  return (
    <li className={`flex items-start gap-3 border-t border-line py-3 first:border-t-0 break-inside-avoid ${l.partOf ? "pl-8 desk:pl-14 print:pl-14" : ""}`}>
      {l.photoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file
        <img src={l.photoSrc} alt="" className={`flex-none rounded-xl bg-surface2 object-cover ${l.partOf ? "size-10" : "size-14"}`} />
      ) : (
        <span className={`flex-none rounded-xl bg-surface2 ${l.partOf ? "size-10" : "size-14"}`} />
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <b className="text-sm font-bold">
          {l.partOf ? <span className="font-semibold text-muted-foreground">Part · </span> : null}
          {l.name}
        </b>
        <span className="text-xs font-semibold">{[l.category, l.brand, l.model].filter(Boolean).join(" · ")}</span>
        <span className="text-xs font-medium text-muted-foreground">{facts.join(" · ")}</span>
        {receipts || photos ? (
          <span className="text-xs font-medium text-muted-foreground">
            {[receipts ? `${receipts} receipt${receipts === 1 ? "" : "s"} or warranty` : null, photos ? `${photos} photo${photos === 1 ? "" : "s"}` : null].filter(Boolean).join(", ")} in the pack
          </span>
        ) : null}
      </span>
      <span className="flex flex-none flex-col items-end gap-0.5 text-right">
        <b className="text-sm font-bold tabular-nums">{value(l.replacementValue) || value(l.purchasePrice) || "—"}</b>
        <span className="text-xs font-medium text-muted-foreground">
          {l.replacementValue != null ? "to replace" : l.purchasePrice != null ? "paid" : "no value"}
          {l.replacementValue != null && l.purchasePrice != null ? ` · paid ${money(l.purchasePrice)}` : ""}
        </span>
      </span>
    </li>
  )
}
