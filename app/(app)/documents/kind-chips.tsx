"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { cn } from "cn"

/** The kind filter on Documents. A search in progress (?q=) carries over to the kind you switch to. */
export function KindChips({ chips, kind }: { chips: { id: string | null; label: string }[]; kind: string | null }) {
  const q = useSearchParams().get("q")
  const href = (id: string | null) => {
    const sp = new URLSearchParams()
    if (id) sp.set("kind", id)
    if (q) sp.set("q", q)
    const s = sp.toString()
    return `/documents${s ? `?${s}` : ""}`
  }
  return (
    <div className="-mx-4 flex flex-1 gap-2 overflow-x-auto px-4 desk:mx-0 desk:flex-wrap desk:px-0">
      {chips.map((c) => (
        <Link
          key={c.id ?? "all"}
          href={href(c.id)}
          aria-current={c.id === kind ? "page" : undefined}
          className={cn(
            "flex min-h-11 flex-none items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap",
            c.id === kind ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2",
          )}
        >
          {c.label}
        </Link>
      ))}
    </div>
  )
}
