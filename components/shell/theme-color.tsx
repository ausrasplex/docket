"use client"

import { useEffect } from "react"

/**
 * Keeps the browser's theme colour (the phone status bar, and the title bar of the installed app) the same
 * as the page background, through theme and light/dark changes. The viewport export gives the first paint.
 */
export function ThemeColor() {
  useEffect(() => {
    const d = document.documentElement
    const sync = () => {
      const bg = getComputedStyle(document.body).backgroundColor
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
        m.content = bg
        m.removeAttribute("media")
      })
    }
    sync()
    const mo = new MutationObserver(sync)
    mo.observe(d, { attributes: true, attributeFilter: ["class", "data-theme", "data-mode"] })
    return () => mo.disconnect()
  }, [])
  return null
}
