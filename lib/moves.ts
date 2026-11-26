import "server-only"
import { db } from "@/lib/db"
import type { Due } from "@/lib/service"

const DAY = 86_400_000
const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short", timeZone: "UTC" })

/**
 * Rebuild an item's current place and loan from its Moves and Loans log, so adding or deleting any entry
 * leaves them right: the place is the latest move's; it's lent while the latest loan has no return after it.
 */
export async function syncMoves(fixtureId: string) {
  const log = await db.itemMove.findMany({ where: { fixtureId }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] })
  const moved = log.find((m) => m.kind === "MOVED")
  const loan = log.find((m) => m.kind === "LENT" || m.kind === "RETURNED")
  const lent = loan?.kind === "LENT" ? loan : null
  await db.fixture.update({
    where: { id: fixtureId },
    data: { location: moved?.place ?? null, lentTo: lent?.person ?? null, lentAt: lent?.date ?? null, lentDueBack: lent?.dueBack ?? null },
  })
}

/** A loan's due-back date as a reminder: soon within a week, overdue after. */
export function dueBack(person: string, due: Date | null, now = new Date()): Due {
  if (!due) return { tone: "ok", text: `Lent to ${person}`, dueDate: null, dueKm: null }
  const days = Math.ceil((due.getTime() - now.getTime()) / DAY)
  if (days < 0) return { tone: "overdue", text: `${person} was to return it ${fmt(due)}`, dueDate: due, dueKm: null }
  if (days <= 7) return { tone: "soon", text: days === 0 ? `Due back from ${person} today` : `Due back from ${person} in ${days} day${days === 1 ? "" : "s"}`, dueDate: due, dueKm: null }
  return { tone: "ok", text: `Lent to ${person}, back ${fmt(due)}`, dueDate: due, dueKm: null }
}
