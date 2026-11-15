import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { atLeast } from "@/lib/roles"
import type { Role } from "@/generated/prisma/enums"

// Data access layer: every page and action gets the user and household through these,
// so the household scoping and role checks live in one place.
// They read the request, so pages call them inside a <Suspense> boundary (Cache Components).

/** The signed-in session, or null. Read once per request. */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }))

export async function requireUser() {
  const session = await getSession()
  if (!session) redirect("/signin")
  return session.user
}

export type Ctx = Awaited<ReturnType<typeof loadContext>>

const loadContext = cache(async (userId: string, activeHouseholdId: string | null | undefined) => {
  const memberships = await db.membership.findMany({
    where: { userId },
    include: { household: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  })
  const current = memberships.find((m) => m.householdId === activeHouseholdId) ?? memberships[0]
  if (!current) return null
  const property = await db.property.findFirst({
    where: { householdId: current.householdId, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  })
  return {
    householdId: current.householdId,
    household: current.household,
    role: current.role,
    households: memberships.map((m) => ({ id: m.householdId, name: m.household.name, role: m.role })),
    property,
  }
})

/**
 * The signed-in user and their current household. Sends them to sign in or to set up a household.
 * With `min`, also requires that role (throws for actions; pages should hide controls instead).
 */
export async function requireHousehold(min: Role = "VIEWER") {
  const user = await requireUser()
  const ctx = await loadContext(user.id, user.activeHouseholdId as string | null | undefined)
  if (!ctx) redirect("/setup")
  if (!ctx.property) redirect("/setup")
  if (!atLeast(ctx.role, min)) throw new Error("You don't have permission to do that.")
  return { user, ...ctx, property: ctx.property }
}

/** Records a line in the household's activity feed. */
export async function logActivity(
  c: { householdId: string; user: { id: string } },
  entry: { action: string; entityType: string; entityId: string; summary: string }
) {
  await db.activity.create({ data: { householdId: c.householdId, userId: c.user.id, ...entry } })
}
