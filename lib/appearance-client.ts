"use client"

import { APPEARANCE_COOKIE, parseMode, parseTheme, type Mode, type ThemeId } from "@/lib/theme"

const DARK_MQ = "(prefers-color-scheme: dark)"

/** Applies a theme and mode to the page now and remembers them in the cookie the head script reads. */
export function applyAppearance(t: ThemeId, m: Mode) {
  const d = document.documentElement
  d.dataset.theme = t
  d.dataset.mode = m
  d.classList.toggle("dark", m === "dark" || (m === "system" && window.matchMedia(DARK_MQ).matches))
  document.cookie = `${APPEARANCE_COOKIE}=${t}.${m}; path=/; max-age=31536000; samesite=lax`
}

export function readAppearanceCookie(): { theme: ThemeId; mode: Mode } | null {
  const m = document.cookie.match(new RegExp(`(?:^|; )${APPEARANCE_COOKIE}=([a-z]+)\\.([a-z]+)`))
  return m ? { theme: parseTheme(m[1]), mode: parseMode(m[2]) } : null
}

/** Keeps "Device" mode in step when the device switches between light and dark. */
export function watchSystemMode() {
  const mq = window.matchMedia(DARK_MQ)
  const on = () => {
    if (document.documentElement.dataset.mode === "system") document.documentElement.classList.toggle("dark", mq.matches)
  }
  mq.addEventListener("change", on)
  return () => mq.removeEventListener("change", on)
}
