"use client"

import { useEffect } from "react"
import type { Mode, ThemeId } from "@/lib/theme"
import { applyAppearance, readAppearanceCookie, watchSystemMode } from "@/lib/appearance-client"

/**
 * The account's saved theme wins: on a new device (or after changing it elsewhere) this applies it
 * and updates the cookie, so the next page load paints in the right theme straight away.
 */
export function ThemeSync({ theme, mode }: { theme: ThemeId; mode: Mode }) {
  useEffect(() => {
    const c = readAppearanceCookie()
    if (!c || c.theme !== theme || c.mode !== mode) applyAppearance(theme, mode)
    else document.documentElement.dataset.mode = mode
  }, [theme, mode])
  useEffect(() => watchSystemMode(), [])
  return null
}
