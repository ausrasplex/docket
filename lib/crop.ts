// A square crop of a photo, as fractions of the (EXIF-rotated) image, so it works on any size copy of it:
// the editor uses the 640px preview, the server cuts the cropped copy from the full-size original.
// Zoomed out, the square can reach past the photo's edges (left/top below 0, width/height above 1); the
// gap is filled with white.
export type Crop = { left: number; top: number; width: number; height: number }

/** How far the square may reach past the photo, as a multiple of the photo's sides. */
const MAX_SPAN = 3

/** Checks a crop from the browser: numbers, not degenerate, overlapping the photo, not absurdly far out. */
export function validCrop(c: unknown): Crop | null {
  if (!c || typeof c !== "object") return null
  const { left, top, width, height } = c as Record<string, unknown>
  const nums = [left, top, width, height]
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null
  const crop = { left: left as number, top: top as number, width: width as number, height: height as number }
  if (crop.width < 0.02 || crop.height < 0.02 || crop.width > MAX_SPAN || crop.height > MAX_SPAN) return null
  // some of the photo must be in it
  if (crop.left >= 1 || crop.top >= 1 || crop.left + crop.width <= 0 || crop.top + crop.height <= 0) return null
  return crop
}

/**
 * The crop in pixels for an image of the given size, kept square: `area` is the part of the image inside it
 * and `pad` the white margin on each side making up the rest (all zero when the crop is inside the image).
 */
export function cropPixels(c: Crop, w: number, h: number) {
  const size = Math.max(1, Math.min(Math.round(c.width * w), Math.round(c.height * h)))
  // inside the image along a side the square fits in; otherwise just never off it entirely
  const place = (start: number, len: number) => (size <= len ? Math.min(Math.max(0, start), len - size) : Math.min(0, Math.max(len - size, start)))
  const left = place(Math.round(c.left * w), w)
  const top = place(Math.round(c.top * h), h)
  const x0 = Math.max(0, left)
  const y0 = Math.max(0, top)
  const x1 = Math.min(w, left + size)
  const y1 = Math.min(h, top + size)
  return {
    size,
    area: { left: x0, top: y0, width: x1 - x0, height: y1 - y0 },
    pad: { left: x0 - left, top: y0 - top, right: left + size - x1, bottom: top + size - y1 },
  }
}
