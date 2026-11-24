import { Suspense } from "react"
import Link from "next/link"
import { AuthCard } from "@/components/auth-card"
import { getSession } from "@/lib/dal"
import { findUsableInvite } from "@/lib/invites"
import { ROLE_DETAILS, ROLE_LABELS } from "@/lib/roles"
import { HouseholdInviteForm, InviteForm } from "./form"

export const metadata = { title: "Invite · Docket" }

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense>
      <Body params={params} />
    </Suspense>
  )
}

async function Body({ params }: { params: PageProps<"/invite/[token]">["params"] }) {
  const { token } = await params
  const invite = await findUsableInvite(token, ["JOIN", "HOUSEHOLD"])
  if (!invite) {
    return (
      <AuthCard title="Link Not Valid" sub="This invite link has expired, been revoked or already been used. Ask for a new one.">
        <Link href="/signin" className="text-center text-[13px] font-semibold hover:underline">
          Go to sign in
        </Link>
      </AuthCard>
    )
  }
  const session = await getSession()
  const signIn = session ? null : (
    <p className="text-center text-[13px] text-muted-foreground">
      Already have an account?{" "}
      <Link href={`/signin?next=/invite/${token}`} className="font-semibold text-ink hover:underline">
        Sign in first
      </Link>
    </p>
  )
  if (invite.kind === "HOUSEHOLD") {
    return (
      <AuthCard
        title="Start Your Household"
        sub="You've been invited to keep your home's records on this Docket server. Your household is your own: no one else sees it unless you invite them."
      >
        <HouseholdInviteForm token={token} signedInAs={session?.user.name ?? null} />
        {signIn}
      </AuthCard>
    )
  }
  return (
    <AuthCard
      title={`Join ${invite.household.name}`}
      sub={
        <>
          You&apos;ve been invited as <b className="text-ink">{ROLE_LABELS[invite.role]}</b>: {ROLE_DETAILS[invite.role].toLowerCase()}.
        </>
      }
    >
      <InviteForm token={token} signedInAs={session?.user.name ?? null} />
      {signIn}
    </AuthCard>
  )
}
