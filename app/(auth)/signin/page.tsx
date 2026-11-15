import { Suspense } from "react"
import Link from "next/link"
import { AuthCard } from "@/components/auth-card"
import { db } from "@/lib/db"
import { SignInForm } from "./form"

export const metadata = { title: "Sign in · Docket" }

export default function SignInPage({ searchParams }: PageProps<"/signin">) {
  return (
    <AuthCard title="Sign In" sub="Your home's rooms, fixtures, manuals and receipts.">
      <Suspense>
        <Body searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  )
}

async function Body({ searchParams }: { searchParams: PageProps<"/signin">["searchParams"] }) {
  const sp = await searchParams
  const next = typeof sp.next === "string" ? sp.next : "/"
  const firstRun = (await db.user.count()) === 0
  return (
    <>
      {sp.reset ? (
        <p className="rounded-[14px] bg-t3 px-3.5 py-3 text-sm font-semibold">Password changed. Sign in with the new one.</p>
      ) : null}
      <SignInForm next={next} />
      <p className="text-center text-[13px] text-muted-foreground">
        {firstRun ? (
          <>
            New here?{" "}
            <Link href="/signup" className="font-semibold text-ink hover:underline">
              Create the first account
            </Link>
          </>
        ) : (
          "No account? Ask someone in your household for an invite link."
        )}
      </p>
    </>
  )
}
