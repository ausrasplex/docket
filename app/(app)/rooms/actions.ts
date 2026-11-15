"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import type { SpaceKind } from "@/generated/prisma/enums"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const KINDS: SpaceKind[] = ["ROOM", "FLOOR", "EXTERIOR", "GARAGE", "WHOLE_HOUSE", "OTHER"]

export type SpaceInput = { name: string; kind: SpaceKind; parentId: string | null; notes: string }

async function checkParent(householdId: string, parentId: string | null, selfId?: string) {
  if (!parentId) return null
  if (parentId === selfId) return "A room can't be inside itself."
  const p = await db.space.findFirst({ where: { id: parentId, householdId, kind: "FLOOR", archivedAt: null } })
  return p ? null : "Pick a floor from the list."
}

export async function createSpace(input: SpaceInput): Promise<Result<{ id: string }>> {
  const c = await requireHousehold("MEMBER")
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Give it a name." }
  if (!KINDS.includes(input.kind)) return { ok: false, error: "Pick a type." }
  const parentId = input.kind === "FLOOR" ? null : input.parentId
  const bad = await checkParent(c.householdId, parentId)
  if (bad) return { ok: false, error: bad }
  const last = await db.space.aggregate({ where: { propertyId: c.property.id }, _max: { sortOrder: true } })
  const s = await db.space.create({
    data: {
      householdId: c.householdId,
      propertyId: c.property.id,
      name,
      kind: input.kind,
      parentId,
      notes: input.notes.trim() || null,
      sortOrder: (last._max.sortOrder ?? 0) + 1,
    },
  })
  await logActivity(c, { action: "created", entityType: "Space", entityId: s.id, summary: `${c.user.name} added ${name}` })
  revalidatePath("/rooms")
  return { ok: true, id: s.id }
}

export async function updateSpace(id: string, input: SpaceInput): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const s = await db.space.findFirst({ where: { id, householdId: c.householdId } })
  if (!s) return { ok: false, error: "That room no longer exists." }
  const name = input.name.trim()
  if (!name) return { ok: false, error: "Give it a name." }
  if (!KINDS.includes(input.kind)) return { ok: false, error: "Pick a type." }
  const parentId = input.kind === "FLOOR" ? null : input.parentId
  const bad = await checkParent(c.householdId, parentId, id)
  if (bad) return { ok: false, error: bad }
  await db.space.update({ where: { id }, data: { name, kind: input.kind, parentId, notes: input.notes.trim() || null } })
  revalidatePath("/rooms")
  revalidatePath(`/rooms/${id}`)
  return { ok: true }
}

/** Nothing is hard-deleted: archived rooms can be restored, and keep their history. */
export async function setSpaceArchived(id: string, archived: boolean): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const s = await db.space.findFirst({ where: { id, householdId: c.householdId } })
  if (!s) return { ok: false, error: "That room no longer exists." }
  await db.space.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } })
  await logActivity(c, { action: archived ? "archived" : "restored", entityType: "Space", entityId: id, summary: `${c.user.name} ${archived ? "archived" : "restored"} ${s.name}` })
  revalidatePath("/rooms")
  revalidatePath(`/rooms/${id}`)
  return { ok: true }
}
