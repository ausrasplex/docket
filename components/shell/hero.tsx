import Link from "next/link"
import { cn } from "cn"

/**
 * Folio's hero banner: the summary text on the left and square accent stat cards on the right (they wrap
 * under the text and scroll sideways when there isn't room).
 */
export function Hero({
  eyebrow,
  title,
  line,
  children,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  line?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-wrap items-stretch gap-5 rounded-3xl bg-hero p-5 text-hero-ink desk:p-6">
      <div className="flex min-w-0 flex-[1_1_240px] flex-col justify-center gap-3.5">
        {eyebrow ? <p className="text-sm text-hero-muted">{eyebrow}</p> : null}
        <p className="text-[26px] leading-[1.2] font-bold tracking-[-0.02em]">{title}</p>
        {line ? <p className="text-sm text-hero-muted">{line}</p> : null}
      </div>
      <div className="flex min-w-0 flex-[1_1_520px] snap-x gap-3 overflow-x-auto pt-0.5 pb-1">{children}</div>
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
  href,
}: {
  tone: keyof typeof TONE
  label: string
  value: string
  caption?: string
  icon?: React.ReactNode
  href?: string
}) {
  const body = (
    <>
      <span className="flex min-h-5 items-center text-xs font-semibold text-on-a-muted [&_svg]:size-5">{icon}</span>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-2xl font-bold tracking-[-0.02em] tabular-nums">{value}</span>
      {caption ? <span className="mt-auto text-xs text-on-a-muted">{caption}</span> : null}
    </>
  )
  const cls = cn("flex aspect-square flex-[1_0_176px] snap-start flex-col gap-2.5 self-start rounded-[18px] p-4 text-on-a", TONE[tone])
  return href ? (
    <Link href={href} className={cn(cls, "lift")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}
