import { Suspense } from "react"
import Link from "next/link"
import { ChevronRight, ClipboardList, ShieldCheck, TrendingUp } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { date } from "@/lib/format"
import { atLeast } from "@/lib/roles"
import { isServerAdmin } from "@/lib/households"
import { Appearance } from "./appearance"
import { BackupsCard } from "./backups"
import { PriceChecksCard } from "./price-checks"
import { ServerCard } from "./server"
import { CalendarCard } from "./calendar"
import { Reminders } from "./reminders"
import { Members } from "./members"
import { HouseholdName, Profile } from "./profile"
import { StorageCard } from "./storage"

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
  const [members, invites, serverAdmin, feed, pushDevices] = await Promise.all([
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
    isServerAdmin(c.user.id),
    db.calendarFeed.findUnique({ where: { userId: c.user.id }, select: { createdAt: true, lastUsedAt: true } }),
    db.pushSubscription.findMany({ where: { userId: c.user.id }, orderBy: { createdAt: "asc" }, select: { device: true } }),
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
        <Suspense fallback={<Skeleton className="h-80 rounded-3xl" />}>
          <StorageCard householdId={c.householdId} />
        </Suspense>
        {admin ? (
          <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
            <BackupsCard />
          </Suspense>
        ) : null}
        {admin ? (
          <Suspense fallback={<Skeleton className="h-48 rounded-3xl" />}>
            <PriceChecksCard householdId={c.householdId} />
          </Suspense>
        ) : null}
        {serverAdmin ? (
          <Suspense fallback={<Skeleton className="h-64 rounded-3xl" />}>
            <ServerCard currentHouseholdId={c.householdId} />
          </Suspense>
        ) : null}
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
            <CardTitle>Reminders</CardTitle>
            <CardDescription>A notification on your phone or computer when a service, rego, warranty or loan comes due.</CardDescription>
          </CardHeader>
          <CardContent>
            <Reminders devices={pushDevices.map((d) => d.device ?? "A device")} />
          </CardContent>
        </Card>
        <CalendarCard feed={feed ? { made: date(feed.createdAt), checked: feed.lastUsedAt?.toISOString() ?? null } : null} />
        <Card>
          <CardHeader>
            <CardTitle>Exports</CardTitle>
            <CardDescription>Your records gathered up for someone else.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2.5">
            <Link href="/exports/schedule" className="flex items-center gap-3 rounded-2xl bg-surface2 p-3 hover:bg-sel-soft">
              <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-a2 text-on-a">
                <ClipboardList className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-sm font-bold">Fixtures and Finishes</b>
                <span className="text-xs font-medium text-muted-foreground">Every product by trade and room, with store, colour and size: a PDF to print and keep</span>
              </span>
              <ChevronRight className="size-5 flex-none text-muted-foreground" />
            </Link>
            <Link href="/exports/insurance" className="flex items-center gap-3 rounded-2xl bg-surface2 p-3 hover:bg-sel-soft">
              <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-a1 text-on-a">
                <ShieldCheck className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-sm font-bold">Insurance Report</b>
                <span className="text-xs font-medium text-muted-foreground">Every item with its serial, value, photo and receipt, to print or download</span>
              </span>
              <ChevronRight className="size-5 flex-none text-muted-foreground" />
            </Link>
            <Link href="/exports/prices" className="flex items-center gap-3 rounded-2xl bg-surface2 p-3 hover:bg-sel-soft">
              <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-a3 text-on-a">
                <TrendingUp className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-sm font-bold">Price History</b>
                <span className="text-xs font-medium text-muted-foreground">Every tracked item with its latest, lowest and highest price, and the full history</span>
              </span>
              <ChevronRight className="size-5 flex-none text-muted-foreground" />
            </Link>
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
