"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { syncSets } from "@/lib/doc-sets"
import type { Prisma } from "@/generated/prisma/client"

type Result = { ok: true } | { ok: false; error: string }

/**
 * Sets which items share documents with this one (copies of the same product). The chosen items join its
 * set and get each other's manuals, warranties and links; unticked ones leave it and keep what they have.
 * Parts with the same name pair up too (each copy's outdoor unit shares with the others).
 */
export async function setDocumentSet(id: string, memberIds: string[]): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const f = await db.fixture.findFirst({ where: { id, householdId: c.householdId }, select: { id: true, name: true, parentId: true, docSetId: true } })
  if (!f) return { ok: false, error: "That item no longer exists." }
  if (f.parentId) return { ok: false, error: "Share documents from the item this part belongs to." }
  const wanted = [...new Set(memberIds.filter((x) => x !== id))]
  const others = await db.fixture.findMany({ where: { id: { in: wanted }, householdId: c.householdId, parentId: null }, select: { id: true } })
  if (others.length !== wanted.length) return { ok: false, error: "One of those items no longer exists." }

  const setId = f.docSetId ?? f.id
  const members = others.length ? [f.id, ...wanted] : []

  const touched = await db.$transaction(async (tx) => {
    const sets = new Set<string>([setId])
    // leaving: items no longer ticked (or this one, when nothing is), and their parts
    const leaving = await tx.fixture.findMany({
      where: { docSetId: setId, parentId: null, id: { notIn: members } },
      select: { id: true, parts: { select: { docSetId: true } } },
    })
    if (leaving.length) {
      for (const l of leaving) for (const p of l.parts) if (p.docSetId) sets.add(p.docSetId)
      await tx.fixture.updateMany({ where: { id: { in: leaving.map((l) => l.id) } }, data: { docSetId: null } })
      await tx.fixture.updateMany({ where: { parentId: { in: leaving.map((l) => l.id) } }, data: { docSetId: null } })
    }
    if (members.length) {
      // items moving over from another set leave that one behind
      const from = await tx.fixture.findMany({ where: { id: { in: members }, docSetId: { not: null } }, select: { docSetId: true } })
      for (const x of from) sets.add(x.docSetId!)
      await tx.fixture.updateMany({ where: { id: { in: members } }, data: { docSetId: setId } })

      // parts pair up by name
      const parts = await tx.fixture.findMany({
        where: { parentId: { in: members }, archivedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, docSetId: true },
      })
      const byName = new Map<string, typeof parts>()
      for (const p of parts) {
        const k = p.name.trim().toLowerCase()
        byName.set(k, [...(byName.get(k) ?? []), p])
      }
      for (const group of byName.values()) {
        if (group.length < 2) continue
        const partSet = group.find((p) => p.docSetId)?.docSetId ?? group[0].id
        for (const p of group) if (p.docSetId) sets.add(p.docSetId)
        sets.add(partSet)
        await tx.fixture.updateMany({ where: { id: { in: group.map((p) => p.id) } }, data: { docSetId: partSet } })
      }
    }
    await dropSingles([...sets], tx)
    return [...sets]
  })

  await syncSets(touched)
  await logActivity(c, {
    action: "updated",
    entityType: "Fixture",
    entityId: id,
    summary: others.length
      ? `${c.user.name} set ${f.name} to share documents with ${others.length === 1 ? "1 other item" : `${others.length} other items`}`
      : `${c.user.name} stopped ${f.name} sharing documents`,
  })
  revalidatePath("/fixtures", "layout")
  return { ok: true }
}

/** A set of one shares with nobody, so its last member leaves it. */
async function dropSingles(setIds: string[], tx: Prisma.TransactionClient) {
  const counts = await tx.fixture.groupBy({ by: ["docSetId"], where: { docSetId: { in: setIds } }, _count: true })
  const singles = counts.filter((x) => x._count === 1).map((x) => x.docSetId!)
  if (singles.length) await tx.fixture.updateMany({ where: { docSetId: { in: singles } }, data: { docSetId: null } })
}
