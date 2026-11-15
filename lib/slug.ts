import "server-only"
import { db } from "@/lib/db"

// Readable addresses for rooms: /rooms/kitchen, /rooms/main-bedroom. (Items and jobs use their random id.)
// A slug is the name in lower case with anything that isn't a letter or digit turned into hyphens,
// unique within the household (a repeat gets -2, -3 …). The migration that added them uses the same rule.

/** "Main Bedroom!" → "main-bedroom"; "Butler's Pantry" → "butlers-pantry"; "Café" → "cafe"; blank → the fallback. */
export function slugify(name: string, fallback: string) {
  const s = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // drop accents
    .toLowerCase()
    .replace(/['\u2019]/g, "") // "Butler's Pantry" → butlers-pantry
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "")
  return s || fallback
}

/** A slug for this room's name that no other room in the household has (ignoring `excludeId`, itself). */
export async function uniqueRoomSlug(householdId: string, name: string, excludeId?: string) {
  const base = slugify(name, "room")
  const rows = await db.space.findMany({
    where: { householdId, slug: { startsWith: base }, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { slug: true },
  })
  const used = new Set(rows.map((r) => r.slug))
  if (!used.has(base)) return base
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`
}

/**
 * How room pages find a room from its address. Old links used the room's id (also lower-case letters and
 * digits, so it can't be told apart by shape), so either is accepted; the page then switches to the slug.
 */
export const bySlugOrId = (householdId: string, param: string) => ({ householdId, OR: [{ slug: param }, { id: param }] })
