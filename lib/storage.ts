import "server-only"
import { createHash, randomBytes } from "node:crypto"
import { mkdir, readFile, rm, writeFile, stat } from "node:fs/promises"
import path from "node:path"
import sharp from "sharp"

// Files live on disk under UPLOAD_DIR (a mounted volume in Docker); the database stores only the key.
// Keys look like "<householdId>/2026/11/<random>.jpg" and are only ever made here.

// turbopackIgnore: a runtime folder, not part of the build (otherwise the whole project gets traced)
const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./data/uploads")
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const TYPES: Record<string, { ext: string; image: boolean }> = {
  "image/jpeg": { ext: "jpg", image: true },
  "image/png": { ext: "png", image: true },
  "image/webp": { ext: "webp", image: true },
  "image/gif": { ext: "gif", image: true },
  "image/heic": { ext: "heic", image: true },
  "image/heif": { ext: "heif", image: true },
  "image/avif": { ext: "avif", image: true },
  "application/pdf": { ext: "pdf", image: false },
}

export function acceptedType(mime: string) {
  return TYPES[mime] ?? null
}

/** Resolves a stored key to a path, refusing anything that would escape the upload folder. */
function resolveKey(key: string) {
  const p = path.resolve(/*turbopackIgnore: true*/ ROOT, key)
  if (!p.startsWith(ROOT + path.sep)) throw new Error("Bad storage key")
  return p
}

/** Checks the bytes really are what the browser said (a renamed file can't slip through). */
function sniff(buf: Buffer, mime: string) {
  if (mime === "application/pdf") return buf.subarray(0, 5).toString("latin1") === "%PDF-"
  if (mime === "image/jpeg") return buf[0] === 0xff && buf[1] === 0xd8
  if (mime === "image/png") return buf.subarray(1, 4).toString("latin1") === "PNG"
  if (mime === "image/gif") return buf.subarray(0, 3).toString("latin1") === "GIF"
  if (mime === "image/webp") return buf.subarray(8, 12).toString("latin1") === "WEBP"
  return buf.subarray(4, 8).toString("latin1") === "ftyp" // heic, heif, avif
}

export type Stored = {
  storageKey: string
  thumbnailKey: string | null
  mimeType: string
  sizeBytes: number
  sha256: string
}

export async function storeFile(householdId: string, buf: Buffer, mime: string): Promise<Stored> {
  const t = acceptedType(mime)
  if (!t) throw new Error("Only photos and PDFs can be uploaded.")
  if (buf.length > MAX_UPLOAD_BYTES) throw new Error("Files can be up to 25 MB.")
  if (!sniff(buf, mime)) throw new Error("That file isn't the type it claims to be.")

  const now = new Date()
  const dir = `${householdId}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  const name = randomBytes(12).toString("base64url")
  const storageKey = `${dir}/${name}.${t.ext}`
  await mkdir(/*turbopackIgnore: true*/ path.dirname(resolveKey(storageKey)), { recursive: true })
  await writeFile(/*turbopackIgnore: true*/ resolveKey(storageKey), buf, { flag: "wx" })

  let thumbnailKey: string | null = null
  if (t.image) {
    try {
      // rotate() applies the phone's EXIF orientation, so photos aren't sideways
      const thumb = await sharp(buf).rotate().resize(640, 640, { fit: "inside", withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
      thumbnailKey = `${dir}/${name}.thumb.webp`
      await writeFile(/*turbopackIgnore: true*/ resolveKey(thumbnailKey), thumb, { flag: "wx" })
    } catch {
      thumbnailKey = null // e.g. HEIC from some phones: kept, just without a preview
    }
  }

  return { storageKey, thumbnailKey, mimeType: mime, sizeBytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") }
}

export async function readStored(key: string) {
  const p = resolveKey(key)
  const [data, s] = await Promise.all([readFile(/*turbopackIgnore: true*/ p), stat(/*turbopackIgnore: true*/ p)])
  return { data, mtime: s.mtime }
}

/** Saves a file Docket made itself (e.g. a cropped room photo) next to the household's uploads. */
export async function storeDerived(householdId: string, buf: Buffer, ext: string) {
  const key = `${householdId}/derived/${randomBytes(12).toString("base64url")}.${ext}`
  await mkdir(/*turbopackIgnore: true*/ path.dirname(resolveKey(key)), { recursive: true })
  await writeFile(/*turbopackIgnore: true*/ resolveKey(key), buf, { flag: "wx" })
  return key
}

/** Removes a file Docket made itself. Missing files are fine (already gone). */
export async function removeStored(key: string) {
  await rm(/*turbopackIgnore: true*/ resolveKey(key), { force: true })
}
