"use client"

import { useSyncExternalStore } from "react"
import { Check, Monitor, Moon, Sun } from "lucide-react"
import { cn } from "cn"
import { THEMES, THEME_LABELS, parseMode, parseTheme, type Mode, type ThemeId } from "@/lib/theme"
import { applyAppearance } from "@/lib/appearance-client"
import { saveAppearance } from "./actions"

// Swatches show each theme's hero and three accents (light values from Folio's token table)
const SWATCH: Record<ThemeId, string[]> = {
  lilac: ["#2b2849", "#b8a5fa", "#fddcb4", "#e8fb4f"],
  ocean: ["#12324d", "#9fd0f5", "#bfe9e0", "#ffe9a8"],
  forest: ["#23402f", "#bfe3b4", "#f3dcb2", "#d8ef9e"],
  sunset: ["#4a2330", "#ffb8a3", "#ffe0a3", "#f5c6ec"],
  graphite: ["#222222", "#d9d9e0", "#e6e0d4", "#cfe0d8"],
}

const MODES: { id: Mode; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "Device", icon: Monitor },
]

// The <html> element is the source of truth; re-render when its attributes change.
function subscribe(cb: () => void) {
  const mo = new MutationObserver(cb)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode", "class"] })
  return () => mo.disconnect()
}
const read = () => {
  const d = document.documentElement
  const mode = d.dataset.mode ? parseMode(d.dataset.mode) : d.classList.contains("dark") ? "dark" : "light"
  return `${parseTheme(d.dataset.theme)}.${mode}`
}

export function Appearance() {
  const [theme, mode] = useSyncExternalStore(subscribe, read, () => "lilac.light").split(".") as [ThemeId, Mode]
  const pick = (t: ThemeId, m: Mode) => {
    applyAppearance(t, m)
    void saveAppearance(t, m)
  }
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Mode" className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            onClick={() => pick(theme, m.id)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-semibold",
              mode === m.id ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2"
            )}
          >
            <m.icon className="size-[18px]" />
            {m.label}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Theme" className="grid gap-2">
        {THEMES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={theme === t}
            onClick={() => pick(t, mode)}
            className={cn(
              "flex min-h-15 cursor-pointer items-center gap-3 rounded-xl border-2 bg-surface2 px-3.5 py-2.5 text-left hover:bg-t1",
              theme === t ? "border-sel" : "border-transparent"
            )}
          >
            <span className="flex -space-x-1.5">
              {SWATCH[t].map((c) => (
                <span key={c} className="size-6 rounded-full border-2 border-surface" style={{ background: c }} />
              ))}
            </span>
            <span className="flex-1 text-sm font-bold">{THEME_LABELS[t]}</span>
            {theme === t ? <Check className="size-5 text-sel" /> : null}
          </button>
        ))}
      </div>
    </div>
  )
}
