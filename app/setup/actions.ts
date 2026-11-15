"use server"

import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import type { SpaceKind } from "@/generated/prisma/enums"

export type SetupState = { error?: string } | undefined

// Offered on the setup screen so a new household isn't empty; all can be renamed or archived later.
const STARTER_ROOMS: { name: string; kind: SpaceKind }[] = [
  { name: "Whole house", kind: "WHOLE_HOUSE" },
  { name: "Kitchen", kind: "ROOM" },
  { name: "Living room", kind: "ROOM" },
  { name: "Main bedroom", kind: "ROOM" },
  { name: "Bathroom", kind: "ROOM" },
  { name: "Laundry", kind: "ROOM" },
  { name: "Garage", kind: "GARAGE" },
  { name: "Outside", kind: "EXTERIOR" },
]

export async function createHousehold(_: SetupState, f: FormData): Promise<SetupState> {
  const user = await requireUser()
  const household = String(f.get("household") ?? "").trim()
  const property = String(f.get("property") ?? "").trim() || "Home"
  const address = String(f.get("address") ?? "").trim() || null
  const starter = f.get("starter") === "on"
  if (!household) return { error: "Give the household a name." }

  // Someone who already has a household (e.g. joined by invite) but no property just adds the property.
  const existing = await db.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } })

  await db.$transaction(async (tx) => {
    const householdId =
      existing?.householdId ??
      (
        await tx.household.create({
          data: { name: household, memberships: { create: { userId: user.id, role: "OWNER" } } },
        })
      ).id
    const p = await tx.property.create({ data: { householdId, name: property, address } })
    if (starter) {
      await tx.space.createMany({
        data: STARTER_ROOMS.map((r, i) => ({ householdId, propertyId: p.id, name: r.name, kind: r.kind, sortOrder: i })),
      })
    }
    await tx.user.update({ where: { id: user.id }, data: { activeHouseholdId: householdId } })
    await tx.activity.create({
      data: { householdId, userId: user.id, action: "created", entityType: "Property", entityId: p.id, summary: `${user.name} set up ${property}` },
    })
  })
  redirect("/")
}
