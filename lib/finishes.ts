import type { FinishKind, Surface } from "@/generated/prisma/enums"

export const SURFACES: { id: Surface; label: string }[] = [
  { id: "WALLS", label: "Walls" },
  { id: "FEATURE_WALL", label: "Feature Wall" },
  { id: "CEILING", label: "Ceiling" },
  { id: "TRIM", label: "Trim & Skirting" },
  { id: "DOORS", label: "Doors" },
  { id: "WINDOWS", label: "Window Frames" },
  { id: "CABINETRY", label: "Cabinetry" },
  { id: "BENCHTOP", label: "Benchtop" },
  { id: "SPLASHBACK", label: "Splashback" },
  { id: "FLOOR", label: "Floor" },
  { id: "EXTERIOR", label: "Exterior" },
  { id: "OTHER", label: "Other" },
]

export const FINISH_KINDS: { id: FinishKind; label: string }[] = [
  { id: "PAINT", label: "Paint" },
  { id: "STAIN", label: "Stain or Oil" },
  { id: "TILE", label: "Tile" },
  { id: "FLOORING", label: "Flooring" },
  { id: "WALLPAPER", label: "Wallpaper" },
  { id: "STONE", label: "Stone" },
  { id: "LAMINATE", label: "Laminate" },
  { id: "OTHER", label: "Other" },
]

/** Common Australian paint sheen names, flattest first. */
export const SHEENS = ["Flat", "Matt", "Low Sheen", "Satin", "Semi-Gloss", "Gloss"]

export const surfaceLabel = (s: Surface) => SURFACES.find((x) => x.id === s)?.label ?? "Other"
export const finishKindLabel = (k: FinishKind) => FINISH_KINDS.find((x) => x.id === k)?.label ?? "Other"

/** "#F2EFE6" or "f2efe6" → "#f2efe6"; anything else → null. */
export function normaliseHex(v: string): string | null {
  const m = v.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return null
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1]
  return `#${h.toLowerCase()}`
}

/** What people call it: the colour name, else its code, else the product (tiles, flooring), else the type. */
export function colourTitle(f: { colourName: string | null; colourCode: string | null; product?: string | null; kind: FinishKind }) {
  return f.colourName || f.colourCode || f.product || finishKindLabel(f.kind)
}
