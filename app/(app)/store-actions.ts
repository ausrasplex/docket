"use server"

import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"

/**
 * The shops this household has bought from (Where Bought on items, paint and finishes), most used first,
 * for the suggestions under the Where Bought field.
 */
export async function knownStores(): Promise<string[]> {
  const c = await requireHousehold()
  const [items, finishes] = await Promise.all([
    db.fixture.groupBy({ by: ["store"], where: { householdId: c.householdId, store: { not: null } }, _count: true }),
    db.finish.groupBy({ by: ["store"], where: { householdId: c.householdId, store: { not: null } }, _count: true }),
  ])
  // the same shop typed in different case counts once, under its most used spelling
  const byKey = new Map<string, { name: string; n: number; best: number }>()
  for (const r of [...items, ...finishes]) {
    const name = r.store!.trim()
    if (!name) continue
    const k = name.toLowerCase()
    const e = byKey.get(k) ?? { name, n: 0, best: 0 }
    e.n += r._count
    // on a tie, the capitalised spelling ("Bunnings" over "bunnings")
    const caps = (s: string) => s.replace(/[^A-Z]/g, "").length
    if (r._count > e.best || (r._count === e.best && caps(name) > caps(e.name))) Object.assign(e, { name, best: r._count })
    byKey.set(k, e)
  }
  return [...byKey.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).map((e) => e.name)
}
