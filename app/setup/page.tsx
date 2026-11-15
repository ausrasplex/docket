import { Suspense } from "react"
import { redirect } from "next/navigation"
import { AuthCard } from "@/components/auth-card"
import { db } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import { SetupForm } from "./form"

export const metadata = { title: "Set up · Docket" }

export default function SetupPage() {
  return (
    <Suspense>
      <Body />
    </Suspense>
  )
}

async function Body() {
  const user = await requireUser()
  const membership = await db.membership.findFirst({
    where: { userId: user.id },
    include: { household: { select: { name: true, properties: { where: { archivedAt: null }, select: { id: true }, take: 1 } } } },
  })
  if (membership?.household.properties.length) redirect("/")
  const first = user.name.split(" ")[0]
  return (
    <AuthCard title={`Welcome, ${first}`} sub="Name your household and the place you live. You can add more properties later.">
      <SetupForm householdName={membership?.household.name ?? `${user.name.split(" ").at(-1)} household`} hasHousehold={!!membership} />
    </AuthCard>
  )
}
