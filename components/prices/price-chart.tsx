import { money } from "@/lib/format"

type Point = { price: number; at: Date | string }

const day = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: process.env.TZ || undefined })

/**
 * One shop's price over time as a step line (the price holds until the next change), carried on to `until` (its
 * last good check). The lowest and highest points are marked and labelled; hovering a step shows its price and
 * date. One series per chart, so it needs no legend: the shop's name sits beside it.
 */
export function PriceChart({ points, until, height = 64, label }: { points: Point[]; until?: Date | string | null; height?: number; label: string }) {
  if (!points.length) return null
  const pts = points.map((p) => ({ price: p.price, at: new Date(p.at) }))
  const end = until ? new Date(until) : pts.at(-1)!.at
  const t0 = pts[0].at.getTime()
  const t1 = Math.max(end.getTime(), pts.at(-1)!.at.getTime(), t0 + 86_400_000)
  const prices = pts.map((p) => p.price)
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const W = 300
  const H = height
  const pad = { top: 14, bottom: 14, x: 4 }
  const x = (t: number) => pad.x + ((t - t0) / (t1 - t0)) * (W - pad.x * 2)
  const y = (v: number) => (hi === lo ? H / 2 : pad.top + (1 - (v - lo) / (hi - lo)) * (H - pad.top - pad.bottom))

  let d = `M${x(t0)},${y(pts[0].price)}`
  pts.forEach((p, i) => {
    if (i) d += ` H${x(p.at.getTime())} V${y(p.price)}`
  })
  d += ` H${x(t1)}`

  const lowAt = pts.find((p) => p.price === lo)!
  const highAt = pts.find((p) => p.price === hi)!
  const marks = hi === lo ? [{ p: lowAt, text: money(lo), below: false }] : [
    { p: highAt, text: `High ${money(hi)}`, below: false },
    { p: lowAt, text: `Low ${money(lo)}`, below: true },
  ]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full overflow-visible" role="img" aria-label={`${label}: price from ${money(lo)} to ${money(hi)}`}>
      <line x1={pad.x} x2={W - pad.x} y1={H - 1} y2={H - 1} stroke="var(--line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke="var(--sel)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {pts.map((p, i) => {
        const x0 = x(p.at.getTime())
        const x1 = i + 1 < pts.length ? x(pts[i + 1].at.getTime()) : x(t1)
        return (
          // a hover target the width of the whole step, bigger than the line itself
          <rect key={i} x={x0} y={0} width={Math.max(4, x1 - x0)} height={H} fill="transparent">
            <title>{`${money(p.price, true)} from ${day(p.at)}`}</title>
          </rect>
        )
      })}
      {marks.map((m) => {
        const cx = x(m.p.at.getTime())
        const cy = y(m.p.price)
        const anchor = cx > W * 0.75 ? "end" : cx < W * 0.25 ? "start" : "middle"
        return (
          <g key={m.text} pointerEvents="none">
            <circle cx={cx} cy={cy} r="4" fill="var(--sel)" stroke="var(--surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <text x={cx} y={m.below ? cy + 13 : cy - 7} textAnchor={anchor} fontSize="10" fontWeight="700" fill="var(--mutedInk)">
              {m.text}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
