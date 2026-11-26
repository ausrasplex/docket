"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * A page opened with `?do=<name>` (from a card's quick-action menu) opens that drawer straight away.
 * `hit` is true on arrival; call `clear()` when the drawer closes so a refresh doesn't reopen it.
 */
export function useIntent(name: string) {
  const params = useSearchParams()
  const router = useRouter()
  const path = usePathname()
  const hit = params.get("do") === name
  const clear = () => {
    if (!hit) return
    const next = new URLSearchParams(params)
    next.delete("do")
    const s = next.toString()
    router.replace(s ? `${path}?${s}` : path, { scroll: false })
  }
  return { hit, clear }
}
