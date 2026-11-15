// Themes copied from Folio: five named token sets, each with a light and a dark mode.
// Values live in app/globals.css; this file only names them.
export const THEMES = ["lilac", "ocean", "forest", "sunset", "graphite"] as const
export type ThemeId = (typeof THEMES)[number]
export type Mode = "light" | "dark" | "system" // system: follow the device

export const THEME_LABELS: Record<ThemeId, string> = {
  lilac: "Lilac",
  ocean: "Ocean",
  forest: "Forest",
  sunset: "Sunset",
  graphite: "Graphite",
}

export const DEFAULT_THEME: ThemeId = "lilac"
export const DEFAULT_MODE: Mode = "light"

// The current choice is kept in a cookie so it applies before first paint on every device.
// Once accounts exist it is saved to the user's profile too (like Folio) and copied into this cookie on sign-in.
export const APPEARANCE_COOKIE = "docket-appearance" // value: "<theme>.<mode>", e.g. "lilac.dark"

export function parseTheme(v: string | undefined | null): ThemeId {
  return (THEMES as readonly string[]).includes(v ?? "") ? (v as ThemeId) : DEFAULT_THEME
}
export function parseMode(v: string | undefined | null): Mode {
  return v === "dark" || v === "system" ? v : DEFAULT_MODE
}

/**
 * Inline script for <head>: applies the saved theme and mode before the page paints, so there is no flash
 * and the root layout stays static (reading cookies on the server would block prerendering).
 */
export const APPLY_APPEARANCE_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${APPEARANCE_COOKIE}=([a-z]+)\\.([a-z]+)/);var t=${JSON.stringify(THEMES)};var d=document.documentElement;if(m&&t.indexOf(m[1])>=0)d.dataset.theme=m[1];if(m)d.dataset.mode=m[2];var dk=m&&(m[2]==="dark"||(m[2]==="system"&&matchMedia("(prefers-color-scheme: dark)").matches));if(dk)d.classList.add("dark");}catch(e){}})();`
