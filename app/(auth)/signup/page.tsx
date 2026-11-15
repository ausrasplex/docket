import { Suspense } from "react"
import Link from "next/link"
import { AuthCard } from "@/components/auth-card"
import { db } from "@/lib/db"
import { SignUpForm } from "./form"

export const metadata = { title: "Create account · Docket" }

export default function SignUpPage() {
  return (
    <Suspense>
      <Body />
    </Suspense>
  )
}

async function Body() {
  // Open only until the first account exists; everyone after that joins through an invite link.
  if ((await db.user.count()) > 0) {
    return (
      <AuthCard title="Invite Needed" sub="Docket is already set up. Ask someone in your household for an invite link.">
        <Link href="/signin" className="text-center text-[13px] font-semibold hover:underline">
          Back to sign in
        </Link>
      </AuthCard>
    )
  }
  return (
    <AuthCard title="Welcome to Docket" sub="Create the first account. You'll set up your household next, then invite others.">
      <SignUpForm />
    </AuthCard>
  )
}
