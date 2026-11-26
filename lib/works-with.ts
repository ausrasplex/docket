import { db } from "@/lib/db"

/** A Works With link is stored once, with the smaller id first, so either side finds the same row. */
export const pair = (x: string, y: string) => (x < y ? { aId: x, bId: y } : { aId: y, bId: x })

/** The ids of every item linked to this one, from either side of the pair. */
export async function worksWithIds(id: string) {
  const rows = await db.worksWith.findMany({ where: { OR: [{ aId: id }, { bId: id }] }, select: { aId: true, bId: true } })
  return rows.map((l) => (l.aId === id ? l.bId : l.aId))
}
