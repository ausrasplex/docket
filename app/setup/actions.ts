"use server"

import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import { mayStartHousehold, readPlace, startPlace } from "@/lib/households"

export type SetupState = { error?: string } | undefined

export async function createHousehold(_: SetupState, f: FormData): Promise<SetupState> {
  const user = await requireUser()
  const place = readPlace(f)
  if ("error" in place) return place

  // Someone who already has a household (e.g. joined by invite) but no property just adds the property.
  const existing = await db.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } })
  // a new household needs an invite link (see mayStartHousehold)
  if (!existing && !(await mayStartHousehold(user.id))) return { error: "You need an invite link to start a household on this server." }
  await db.$transaction((tx) => startPlace(tx, user, place, existing?.householdId))
  redirect("/")
}
