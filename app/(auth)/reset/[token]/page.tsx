import { Suspense } from "react"
import Link from "next/link"
import { AuthCard } from "@/components/auth-card"
import { db } from "@/lib/db"
import { findUsableInvite } from "@/lib/invites"
import { ResetForm } from "./form"

export const metadata = { title: "Reset password · Docket" }

export default function ResetPage({ params }: PageProps<"/reset/[token]">) {
  return (
    <Suspense>
      <Body params={params} />
    </Suspense>
  )
}

async function Body({ params }: { params: PageProps<"/reset/[token]">["params"] }) {
  const { token } = await params
  const link = await findUsableInvite(token, "RESET")
  const user = link?.resetUserId
    ? await db.user.findUnique({ where: { id: link.resetUserId }, select: { name: true, email: true } })
    : null
  if (!user) {
    return (
      <AuthCard title="Link Not Valid" sub="This reset link has expired or has already been used. Ask an admin for a new one.">
        <Link href="/signin" className="text-center text-[13px] font-semibold hover:underline">
          Go to sign in
        </Link>
      </AuthCard>
    )
  }
  return (
    <AuthCard title="Choose a New Password" sub={`For ${user.name} (${user.email}). You'll be signed out everywhere.`}>
      <ResetForm token={token} />
    </AuthCard>
  )
}
