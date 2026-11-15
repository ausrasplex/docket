import { Suspense } from "react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { date } from "@/lib/format"
import { atLeast } from "@/lib/roles"
import { Appearance } from "./appearance"
import { Members } from "./members"
import { HouseholdName, Profile } from "./profile"

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <PageBody>
        <Suspense fallback={<Skeleton className="h-96 rounded-3xl" />}>
          <Settings />
        </Suspense>
      </PageBody>
    </>
  )
}

async function Settings() {
  const c = await requireHousehold()
  const admin = atLeast(c.role, "ADMIN")
  const [members, invites] = await Promise.all([
    db.membership.findMany({
      where: { householdId: c.householdId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    admin
      ? db.invite.findMany({
          where: { householdId: c.householdId, kind: "JOIN", revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          include: { createdBy: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [],
  ])
  const open = invites.filter((i) => i.uses < i.maxUses)

  return (
    <div className="grid grid-cols-1 items-start gap-5 desk:grid-cols-2">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Household</CardTitle>
            <CardDescription>Everyone here sees the same rooms, items and receipts.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <HouseholdName name={c.household.name} canEdit={admin} />
            <Members
              myRole={c.role}
              householdName={c.household.name}
              members={members.map((m) => ({
                id: m.id,
                userId: m.userId,
                name: m.user.name,
                email: m.user.email,
                role: m.role,
                isMe: m.userId === c.user.id,
              }))}
              invites={open.map((i) => ({
                id: i.id,
                role: i.role,
                uses: i.uses,
                maxUses: i.maxUses,
                expires: i.expiresAt ? date(i.expiresAt) : null,
                by: i.createdBy.name,
              }))}
            />
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Your Account</CardTitle>
            <CardDescription>Your name, the email you sign in with, and your password.</CardDescription>
          </CardHeader>
          <CardContent>
            <Profile name={c.user.name} email={c.user.email} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Saved to your account, so it follows you to other devices.</CardDescription>
          </CardHeader>
          <CardContent>
            <Appearance />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
