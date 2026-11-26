"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { pair, worksWithIds } from "@/lib/works-with"

type Result = { ok: true } | { ok: false; error: string }

/**
 * Set every item this one works with (a battery and the appliances it fits). Links are two-way: ticking the
 * stick blender here lists the battery on the blender's page too. Only whole items, not parts, can be linked.
 */
export async function setWorksWith(id: string, withIds: string[]): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const f = await db.fixture.findFirst({ where: { id, householdId: c.householdId, parentId: null }, select: { id: true, name: true } })
  if (!f) return { ok: false, error: "That item no longer exists." }
  const wanted = [...new Set(withIds)].filter((x) => x !== id)
  const found = await db.fixture.findMany({ where: { id: { in: wanted }, householdId: c.householdId, parentId: null }, select: { id: true, name: true } })
  if (found.length !== wanted.length) return { ok: false, error: "One of those items no longer exists. Refresh and try again." }

  const current = new Set(await worksWithIds(id))
  const add = wanted.filter((x) => !current.has(x))
  const remove = [...current].filter((x) => !wanted.includes(x))
  if (!add.length && !remove.length) return { ok: true }

  await db.$transaction([
    ...(remove.length ? [db.worksWith.deleteMany({ where: { OR: remove.map((x) => pair(id, x)) } })] : []),
    ...(add.length ? [db.worksWith.createMany({ data: add.map((x) => pair(id, x)), skipDuplicates: true })] : []),
  ])
  const names = found.filter((x) => add.includes(x.id)).map((x) => x.name)
  await logActivity(c, {
    action: "updated",
    entityType: "Fixture",
    entityId: id,
    summary: names.length
      ? `${c.user.name} linked ${f.name} with ${names.length <= 2 ? names.join(" and ") : `${names.length} items`}`
      : `${c.user.name} changed what ${f.name} works with`,
  })
  revalidatePath("/fixtures", "layout")
  return { ok: true }
}
