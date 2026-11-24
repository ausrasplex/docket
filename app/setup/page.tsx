import { Suspense } from "react"
import { redirect } from "next/navigation"
import { AuthCard } from "@/components/auth-card"
import { db } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import { mayStartHousehold } from "@/lib/households"
import { signOut } from "@/app/(auth)/actions"
import { Button } from "@/components/ui/button"
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
  if (!membership && !(await mayStartHousehold(user.id))) {
    return (
      <AuthCard
        title={`You're Not in a Household, ${first}`}
        sub="Your account isn't part of a household on this server any more. Ask a household's owner for an invite link to join theirs, or the person who runs this server for a link to start your own."
      >
        <form action={signOut}>
          <Button type="submit" variant="outline" className="w-full">
            Sign Out
          </Button>
        </form>
      </AuthCard>
    )
  }
  return (
    <AuthCard title={`Welcome, ${first}`} sub="Name your household and the place you live. You can add more properties later.">
      <SetupForm householdName={membership?.household.name ?? `${user.name.split(" ").at(-1)} household`} hasHousehold={!!membership} />
    </AuthCard>
  )
}
