import Link from "next/link"
import { date, money } from "@/lib/format"
import type { PricedItem, PriceReport } from "@/lib/prices"

const at = (x: { price: number; at: Date; store: string } | null) =>
  x ? (
    <>
      <b className="tabular-nums">{money(x.price, true)}</b>
      <span className="block text-xs font-medium text-muted-foreground">
        {x.store} · {date(x.at)}
      </span>
    </>
  ) : (
    <span className="text-muted-foreground">—</span>
  )

/**
 * The recorded retail prices, one row per item: the cheapest current price, and the lowest and highest ever
 * recorded, each with the shop and date. Shown on the Insurance Report (as its own section, not counted in its
 * totals) and on the Price History export.
 */
export function RecordedPrices({ report, linkItems = true }: { report: PriceReport; linkItems?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {report.rooms.map((g) => (
        <div key={g.room} className="flex flex-col">
          <h3 className="border-b border-line pb-1.5 text-sm font-bold">{g.room}</h3>
          {/* a table on wide screens and paper; stacked on phones */}
          <table className="w-full text-sm max-desk:hidden print:table">
            <thead>
              <tr className="text-left text-xs font-semibold text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">Item</th>
                <th className="py-2 pr-3 font-semibold">Latest</th>
                <th className="py-2 pr-3 font-semibold">Lowest recorded</th>
                <th className="py-2 font-semibold">Highest recorded</th>
              </tr>
            </thead>
            <tbody>
              {g.items.map((i) => (
                <tr key={i.id} className="border-t border-line align-top break-inside-avoid">
                  <td className="py-2.5 pr-3">
                    <ItemName i={i} link={linkItems} />
                  </td>
                  <td className="py-2.5 pr-3">{at(i.latest)}</td>
                  <td className="py-2.5 pr-3">{at(i.low)}</td>
                  <td className="py-2.5">{at(i.high)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="flex flex-col desk:hidden print:hidden">
            {g.items.map((i) => (
              <li key={i.id} className="flex flex-col gap-2 border-t border-line py-3 first:border-t-0">
                <ItemName i={i} link={linkItems} />
                <dl className="grid grid-cols-3 gap-2 text-sm">
                  {(
                    [
                      ["Latest", i.latest],
                      ["Lowest", i.low],
                      ["Highest", i.high],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="min-w-0">
                      <dt className="text-xs font-semibold text-muted-foreground">{k}</dt>
                      <dd className="min-w-0 break-words">{at(v)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function ItemName({ i, link }: { i: PricedItem; link: boolean }) {
  return (
    <span className="flex flex-col">
      {link ? (
        <Link href={`/fixtures/${i.id}#prices`} className="font-bold underline-offset-2 hover:underline print:no-underline">
          {i.name}
        </Link>
      ) : (
        <b>{i.name}</b>
      )}
      {i.detail ? <span className="text-xs font-semibold">{i.detail}</span> : null}
      <span className="text-xs font-medium text-muted-foreground">
        {i.sources.length === 1 ? i.sources[0].store : `${i.sources.length} shops`}
        {i.since ? ` · tracked since ${date(i.since)}` : ""}
      </span>
    </span>
  )
}
