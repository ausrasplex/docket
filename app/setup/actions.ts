"use server"

import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import { readPlace, startPlace } from "@/lib/households"

export type SetupState = { error?: string } | undefined

export async function createHousehold(_: SetupState, f: FormData): Promise<SetupState> {
  const user = await requireUser()
  const place = readPlace(f)
  if ("error" in place) return place

  // Someone who already has a household (e.g. joined by invite) but no property just adds the property.
  const existing = await db.membership.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } })
  await db.$transaction((tx) => startPlace(tx, user, place, existing?.householdId))
  redirect("/")
}
