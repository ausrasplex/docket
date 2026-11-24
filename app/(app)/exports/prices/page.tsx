import { Suspense } from "react"
import Link from "next/link"
import { CircleAlert, Download } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { requireHousehold } from "@/lib/dal"
import { date, money } from "@/lib/format"
import { priceReport, priceSettings } from "@/lib/prices"
import { PriceChart } from "@/components/prices/price-chart"
import { RecordedPrices } from "@/components/prices/recorded-prices"
import { PrintButton } from "../insurance/print-button"

export const metadata = { title: "Price History · Docket" }

export default function PricesPage() {
  return (
    <>
      <PageHeader
        title="Price History"
        subtitle="What your items sell for at the shops you track: the latest price, the lowest and highest recorded, and every change."
        actions={
          <div className="flex flex-none items-center gap-2 print:hidden">
            <PrintButton />
            <Button asChild size="sm" className="max-desk:size-11 max-desk:px-0">
              <a href="/api/exports/prices" download title="Download the summary and the full history as spreadsheets (ZIP)">
                <Download />
                <span className="max-desk:sr-only">Download</span>
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

async function Report() {
  const c = await requireHousehold()
  const r = await priceReport(c.householdId, c.property.id)
  const s = priceSettings()

  if (!r.items) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-3xl bg-surface p-6">
        <p className="text-sm font-medium text-muted-foreground">
          No prices are tracked at {c.property.name} yet. Open an item and choose Add Shop under Prices, with the item&apos;s page at a shop that sells
          it.
        </p>
        <Button asChild size="sm">
          <Link href="/fixtures">Go to Items</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 print:gap-4">
      <section className="grid grid-cols-2 gap-3 desk:grid-cols-4 print:grid-cols-4">
        <Stat label="Items tracked" value={String(r.items)} detail={`${r.sources} shop page${r.sources === 1 ? "" : "s"}`} />
        <Stat label="Tracked since" value={r.since ? date(r.since) : "Not yet"} detail={s.enabled ? `Checked every ${s.days} days` : "Scheduled checks are off"} />
        <Stat
          label="Problems"
          value={r.problems.length ? String(r.problems.length) : "None"}
          detail={r.problems.length ? "Pages that couldn't be read" : "Every page read at its last check"}
        />
        <Stat label="Made" value={date(new Date())} detail={c.property.name} />
      </section>

      <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 print:rounded-none print:p-0">
        <h2 className="border-b border-line pb-2">Summary</h2>
        <RecordedPrices report={r} />
      </section>

      <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5 print:break-before-page print:rounded-none print:p-0">
        <h2 className="border-b border-line pb-2">History by Shop</h2>
        {r.rooms.flatMap((g) => g.items).map((i) => (
          <div key={i.id} className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0 break-inside-avoid">
            <b className="text-sm">{i.name}</b>
            <div className="grid grid-cols-1 gap-3 desk:grid-cols-2 print:grid-cols-2">
              {i.sources.map((src) => (
                <div key={src.id} className="flex flex-col gap-2 rounded-2xl bg-surface2 p-3 print:border print:border-line print:bg-transparent">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-bold">{src.store}</span>
                    <span className="text-sm font-bold tabular-nums">{src.latest != null ? money(src.latest, true) : "—"}</span>
                  </div>
                  {src.history.length > 1 ? <PriceChart points={src.history} until={src.latestAt} label={src.store} /> : null}
                  {src.history.length ? (
                    <ul className="flex flex-col text-xs">
                      {[...src.history].reverse().map((p) => (
                        <li key={p.id} className="flex justify-between gap-3 border-t border-line py-1 first:border-t-0">
                          <span className="font-medium text-muted-foreground">
                            {date(p.at)}
                            {p.inStock === false ? " · out of stock" : ""}
                          </span>
                          <b className="tabular-nums">{money(p.price, true)}</b>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">No price recorded yet.</span>
                  )}
                  {src.latestAt ? <span className="text-xs font-medium text-muted-foreground">Last read {date(src.latestAt)}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {r.problems.length ? (
        <section className="flex flex-col gap-2 rounded-3xl bg-surface p-5 print:hidden">
          <h2 className="flex items-center gap-2 border-b border-line pb-2">
            <CircleAlert className="size-5 text-muted-foreground" />
            Pages That Couldn&apos;t Be Read
          </h2>
          <ul className="flex flex-col">
            {r.problems.map(({ item, source }) => (
              <li key={source.id} className="flex flex-col gap-0.5 border-t border-line py-2.5 first:border-t-0">
                <span className="text-sm">
                  <Link href={`/fixtures/${item.id}#prices`} className="font-bold underline-offset-2 hover:underline">
                    {item.name}
                  </Link>{" "}
                  <span className="font-medium text-muted-foreground">at {source.store}</span>
                </span>
                <span className="text-xs font-medium text-muted-foreground">
                  {source.error}
                  {source.failingSince ? ` Since ${date(source.failingSince)}.` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="text-xs font-medium text-muted-foreground">
        Prices are read automatically from the shops&apos; websites and only recorded when they change, so each price stood until the next one listed.
        Shop prices change often and can include sales.
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
