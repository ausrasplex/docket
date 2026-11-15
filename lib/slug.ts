import "server-only"
import { db } from "@/lib/db"

// Readable addresses: /rooms/kitchen, /fixtures/split-system, /jobs/bathroom-renovation.
// A slug is the name in lower case with anything that isn't a letter or digit turned into hyphens,
// unique within the household (a repeat gets -2, -3 …). The migration that added them uses the same rule.

/** "Main Bedroom!" → "main-bedroom"; "Butler's Pantry" → "butlers-pantry"; "Café" → "cafe"; blank → the fallback. */
export function slugify(name: string, fallback: string) {
  const s = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // drop accents
    .toLowerCase()
    .replace(/['’]/g, "") // "Butler's Pantry" → butlers-pantry
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "")
  return s || fallback
}

type Kind = "space" | "fixture" | "job"
const FALLBACK: Record<Kind, string> = { space: "room", fixture: "item", job: "job" }

async function taken(kind: Kind, householdId: string, base: string, excludeId?: string) {
  const where = { householdId, slug: { startsWith: base }, ...(excludeId ? { NOT: { id: excludeId } } : {}) }
  const rows =
    kind === "space"
      ? await db.space.findMany({ where, select: { slug: true } })
      : kind === "fixture"
        ? await db.fixture.findMany({ where, select: { slug: true } })
        : await db.job.findMany({ where, select: { slug: true } })
  return new Set(rows.map((r) => r.slug))
}

/** A slug for this name that no other room / item / job in the household has (ignoring `excludeId`, itself). */
export async function uniqueSlug(kind: Kind, householdId: string, name: string, excludeId?: string) {
  const base = slugify(name, FALLBACK[kind])
  const used = await taken(kind, householdId, base, excludeId)
  if (!used.has(base)) return base
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`
}

/**
 * How pages find a room, item or job from its address. Old links used the record's id (also lower-case
 * letters and digits, so it can't be told apart by shape), so either is accepted; pages then switch the
 * address to the readable one.
 */
export const bySlugOrId = (householdId: string, param: string) => ({ householdId, OR: [{ slug: param }, { id: param }] })
