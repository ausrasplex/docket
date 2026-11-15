import { cn } from "cn"

/** Folio's hero banner: a dark panel holding square accent stat cards that scroll sideways on phones. */
export function Hero({ eyebrow, title, children }: { eyebrow?: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-5 rounded-3xl bg-hero p-5 text-hero-ink desk:p-6">
      <div>
        {eyebrow ? <p className="text-sm font-semibold text-hero-muted">{eyebrow}</p> : null}
        <p className="text-[26px] leading-tight font-bold tracking-[-0.02em]">{title}</p>
      </div>
      <div className="-mx-5 flex snap-x gap-3 overflow-x-auto px-5 desk:mx-0 desk:px-0">{children}</div>
    </section>
  )
}

const TONE = { a1: "bg-a1", a2: "bg-a2", a3: "bg-a3" } as const

export function StatCard({
  tone,
  label,
  value,
  caption,
  icon,
}: {
  tone: keyof typeof TONE
  label: string
  value: string
  caption?: string
  icon?: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex aspect-square min-w-44 flex-1 snap-start flex-col justify-between rounded-2xl p-4 text-on-a",
        TONE[tone]
      )}
    >
      <div className="flex items-center justify-between text-sm font-semibold text-on-a-muted">
        {label}
        {icon}
      </div>
      <div>
        <p className="text-[28px] leading-none font-bold tabular-nums">{value}</p>
        {caption ? <p className="mt-1.5 text-xs font-semibold text-on-a-muted">{caption}</p> : null}
      </div>
    </div>
  )
}
