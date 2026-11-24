import "server-only"
import { db } from "@/lib/db"
import { slugify } from "@/lib/slug"
import type { Prisma } from "@/generated/prisma/client"
import type { SpaceKind } from "@/generated/prisma/enums"

// Offered when setting up so a new household isn't empty; all can be renamed or archived later.
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

export type NewPlace = { household: string; property: string; address: string | null; starter: boolean }

/** The household and property fields from the setup and new-household forms. */
export function readPlace(f: FormData): NewPlace | { error: string } {
  const household = String(f.get("household") ?? "").trim()
  if (!household) return { error: "Give the household a name." }
  if (household.length > 80) return { error: "Keep the household's name under 80 characters." }
  return {
    household,
    property: String(f.get("property") ?? "").trim().slice(0, 80) || "Home",
    address: String(f.get("address") ?? "").trim().slice(0, 200) || null,
    starter: f.get("starter") === "on",
  }
}

/**
 * Sets up a property (and its starter rooms) for a user, in a new household they own, or in `householdId`
 * when they already belong to one. Makes it the household they see.
 */
export async function startPlace(tx: Prisma.TransactionClient, user: { id: string; name: string }, place: NewPlace, householdId?: string) {
  const id =
    householdId ??
    (await tx.household.create({ data: { name: place.household, memberships: { create: { userId: user.id, role: "OWNER" } } } })).id
  const p = await tx.property.create({ data: { householdId: id, name: place.property, address: place.address } })
  if (place.starter) {
    await tx.space.createMany({
      // starter names are all different, and a new property has no rooms yet, so their slugs are free
      data: STARTER_ROOMS.map((r, i) => ({ householdId: id, propertyId: p.id, name: r.name, slug: slugify(r.name, "room"), kind: r.kind, sortOrder: i })),
    })
  }
  await tx.user.update({ where: { id: user.id }, data: { activeHouseholdId: id } })
  await tx.activity.create({
    data: { householdId: id, userId: user.id, action: "created", entityType: "Property", entityId: p.id, summary: `${user.name} set up ${place.property}` },
  })
  return id
}

/**
 * Whether someone with no household may start one on the setup screen: only the first account on a fresh
 * server (no households yet) and server admins. Everyone else needs an invite link, to join a household or
 * to start their own, so an account removed from its household can't quietly start another.
 */
export async function mayStartHousehold(userId: string) {
  if ((await db.household.count()) === 0) return true
  return isServerAdmin(userId)
}

/** Server admins run the Docket server: they can invite people to start households and see storage totals. */
export async function isServerAdmin(userId: string) {
  return !!(await db.user.findUnique({ where: { id: userId }, select: { serverAdmin: true } }))?.serverAdmin
}
