// A square crop of a photo, as fractions of the (EXIF-rotated) image, so it works on any size copy of it:
// the editor uses the 640px preview, the server cuts the cropped copy from the full-size original.
export type Crop = { left: number; top: number; width: number; height: number }

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Checks a crop from the browser: numbers, inside the image, not degenerate. */
export function validCrop(c: unknown): Crop | null {
  if (!c || typeof c !== "object") return null
  const { left, top, width, height } = c as Record<string, unknown>
  if (![left, top, width, height].every((n) => typeof n === "number" && Number.isFinite(n))) return null
  const crop = { left: clamp01(left as number), top: clamp01(top as number), width: clamp01(width as number), height: clamp01(height as number) }
  if (crop.width < 0.02 || crop.height < 0.02) return null
  if (crop.left + crop.width > 1.0001 || crop.top + crop.height > 1.0001) return null
  return crop
}

/** The crop in pixels for an image of the given size, kept square and inside it. */
export function cropPixels(c: Crop, w: number, h: number) {
  const size = Math.max(1, Math.min(Math.round(c.width * w), Math.round(c.height * h), w, h))
  const left = Math.min(Math.max(0, Math.round(c.left * w)), w - size)
  const top = Math.min(Math.max(0, Math.round(c.top * h)), h - size)
  return { left, top, width: size, height: size }
}
