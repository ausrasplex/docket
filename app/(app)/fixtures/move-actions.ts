"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { syncMoves } from "@/lib/moves"
import type { ItemMoveKind } from "@/generated/prisma/enums"

type Result = { ok: true } | { ok: false; error: string }

export type MoveInput = {
  kind: ItemMoveKind
  date: string // yyyy-mm-dd
  /** MOVED: where it went; blank means back to its usual place */
  place: string
  /** LENT: who has it */
  person: string
  dueBack: string | null
  notes: string
}

const day = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null)

function refresh(id: string) {
  revalidatePath(`/fixtures/${id}`)
  revalidatePath("/fixtures")
  revalidatePath("/")
}

/** Log a move, a loan or its return. The item's current place and loan follow from the log. */
export async function addMove(fixtureId: string, input: MoveInput): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const f = await db.fixture.findFirst({ where: { id: fixtureId, householdId: c.householdId, parentId: null }, select: { id: true, name: true, lentTo: true } })
  if (!f) return { ok: false, error: "That item no longer exists." }
  const date = day(input.date)
  if (!date) return { ok: false, error: "Pick the date it happened." }
  if (date.getTime() > Date.now() + 86_400_000) return { ok: false, error: "That date hasn't happened yet." }
  const person = input.person.trim().slice(0, 80)
  if (input.kind === "LENT" && !person) return { ok: false, error: "Say who you lent it to." }
  if (input.kind === "RETURNED" && !f.lentTo) return { ok: false, error: "It isn't lent out." }
  const dueBack = input.kind === "LENT" ? day(input.dueBack) : null
  if (dueBack && dueBack < date) return { ok: false, error: "It can't be due back before it was lent." }

  await db.itemMove.create({
    data: {
      householdId: c.householdId,
      fixtureId,
      kind: input.kind,
      date,
      place: input.kind === "MOVED" ? input.place.trim().slice(0, 80) || null : null,
      person: input.kind === "LENT" ? person : input.kind === "RETURNED" ? f.lentTo : null,
      dueBack,
      notes: input.notes.trim() || null,
      createdById: c.user.id,
    },
  })
  await syncMoves(fixtureId)
  const summary =
    input.kind === "LENT"
      ? `${c.user.name} lent ${f.name} to ${person}`
      : input.kind === "RETURNED"
        ? `${f.lentTo} gave back ${f.name}`
        : input.place.trim()
          ? `${c.user.name} moved ${f.name} to ${input.place.trim()}`
          : `${c.user.name} put ${f.name} back in its usual place`
  await logActivity(c, { action: "updated", entityType: "Fixture", entityId: fixtureId, summary })
  refresh(fixtureId)
  return { ok: true }
}

/** Remove a log entry made by mistake; the item's place and loan are worked out again from what's left. */
export async function deleteMove(id: string): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const m = await db.itemMove.findFirst({ where: { id, householdId: c.householdId } })
  if (!m) return { ok: false, error: "That entry is already gone." }
  await db.itemMove.delete({ where: { id } })
  await syncMoves(m.fixtureId)
  refresh(m.fixtureId)
  return { ok: true }
}
