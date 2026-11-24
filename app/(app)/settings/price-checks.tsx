import Link from "next/link"
import { CircleAlert, CircleCheck, Tags } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { date } from "@/lib/format"
import { priceProblems, priceSettings } from "@/lib/prices"
import { RetryPrices } from "./price-checks-button"

/**
 * Price Checks (admins and the owner): the shop pages whose last check failed, with the item each belongs to
 * and why, so a blocked shop or a moved page can be fixed or replaced.
 */
export async function PriceChecksCard({ householdId }: { householdId: string }) {
  const [p, s] = [await priceProblems(householdId), priceSettings()]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Checks</CardTitle>
        <CardDescription>
          {s.enabled
            ? `Shop pages are checked every ${s.days} days. Pages that couldn't be read are listed here.`
            : "Scheduled price checks are turned off on this server (PRICE_CHECKS_DISABLED). Check Now on an item still works."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!p.total ? (
          <div className="flex items-center gap-3">
            <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-a3 text-on-a">
              <Tags className="size-[18px]" />
            </span>
            <span className="text-sm font-medium text-muted-foreground">No prices tracked yet. Add a shop under Prices on any item.</span>
          </div>
        ) : !p.failing.length ? (
          <div className="flex items-center gap-3">
            <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-a3 text-on-a">
              <CircleCheck className="size-[18px]" />
            </span>
            <span className="flex flex-col">
              <b className="text-sm font-bold">All {p.total} shop page{p.total === 1 ? "" : "s"} read at their last check</b>
              <span className="text-xs font-medium text-muted-foreground">Nothing to fix.</span>
            </span>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-3 rounded-2xl bg-danger-soft p-3 text-sm text-danger">
              <CircleAlert className="mt-0.5 size-5 flex-none" />
              <b>
                {p.failing.length} of {p.total} shop page{p.total === 1 ? "" : "s"} couldn&apos;t be read
              </b>
            </div>
            <ul className="flex flex-col">
              {p.failing.map((f) => (
                <li key={f.id} className="flex flex-col gap-0.5 border-t border-line py-2.5 first:border-t-0">
                  <span className="text-sm">
                    <Link href={`/fixtures/${f.itemId}#prices`} className="font-bold underline-offset-2 hover:underline">
                      {f.item}
                    </Link>{" "}
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="font-medium text-muted-foreground hover:underline">
                      at {f.store}
                    </a>
                  </span>
                  <span className="text-xs font-medium break-words text-muted-foreground">{f.error}</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {[
                      f.failingSince ? `Failing since ${date(f.failingSince)}` : null,
                      f.checkedAt ? `last tried ${date(f.checkedAt)}` : null,
                      f.lastOkAt ? `last read ${date(f.lastOkAt)}` : "never read",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs font-medium text-muted-foreground">
              A failing page is tried again daily for a week, then weekly. Shops that block automated requests won&apos;t start working on their own:
              try a Price Selector on the item, or a different shop.
            </p>
            <RetryPrices />
          </>
        )}
      </CardContent>
    </Card>
  )
}
