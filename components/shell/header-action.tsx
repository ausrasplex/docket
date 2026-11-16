"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"

/**
 * A page's action beside its title: the icon and label on desktop, just the icon on phones (the label stays for
 * screen readers). It opens its drawer through the address (`?add=…`), keeping the page's other filters.
 */
export function HeaderAction({
  add,
  icon,
  label,
  variant = "add",
}: {
  /** the `add` value the page's list reads to open its drawer */
  add: string
  icon: React.ReactNode
  label: string
  variant?: "add" | "outline"
}) {
  const path = usePathname()
  const params = useSearchParams()
  const next = new URLSearchParams(params)
  next.set("add", add)
  return (
    <Button asChild variant={variant} size="sm" className="max-desk:size-11 max-desk:px-0">
      <Link href={`${path}?${next}`} scroll={false} title={label}>
        {icon}
        <span className="max-desk:sr-only">{label}</span>
      </Link>
    </Button>
  )
}

/** Drop `?add=…` once its drawer closes, so a refresh doesn't reopen it; other filters stay. */
export function withoutAdd(path: string, params: URLSearchParams) {
  const next = new URLSearchParams(params)
  next.delete("add")
  const s = next.toString()
  return s ? `${path}?${s}` : path
}
