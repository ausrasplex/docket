"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { isAPIError } from "better-auth/api"
import { hashPassword } from "better-auth/crypto"
import { auth, INVITE_HEADER } from "@/lib/auth"
import { db } from "@/lib/db"
import { getSession } from "@/lib/dal"
import { findUsableInvite } from "@/lib/invites"

export type FormState = { error?: string } | undefined

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim()

function message(e: unknown) {
  if (isAPIError(e)) return e.body?.message ?? e.message
  return "That didn't work. Try again."
}

/** Only relative paths, so ?next= can't send people to another site. */
function safeNext(v: string) {
  return v.startsWith("/") && !v.startsWith("//") ? v : "/"
}

export async function signIn(_: FormState, f: FormData): Promise<FormState> {
  try {
    await auth.api.signInEmail({
      body: { email: str(f, "email").toLowerCase(), password: String(f.get("password") ?? "") },
      headers: await headers(),
    })
  } catch (e) {
    return { error: isAPIError(e) && e.status === "UNAUTHORIZED" ? "That email and password don't match." : message(e) }
  }
  redirect(safeNext(str(f, "next")))
}

/** First run only: the first account sets up Docket (the auth hook refuses this once anyone exists). */
export async function signUpFirst(_: FormState, f: FormData): Promise<FormState> {
  const v = checkNewAccount(f)
  if ("error" in v) return v
  try {
    await auth.api.signUpEmail({ body: v, headers: await headers() })
  } catch (e) {
    return { error: message(e) }
  }
  redirect("/setup")
}

function checkNewAccount(f: FormData) {
  const name = str(f, "name")
  const email = str(f, "email").toLowerCase()
  const password = String(f.get("password") ?? "")
  if (!name) return { error: "Add your name." }
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter an email address to sign in with." }
  if (password.length < 10) return { error: "Use at least 10 characters for the password." }
  return { name, email, password }
}

/** Accepts an invite link: creates the account first when needed, then joins the household. */
export async function acceptInvite(token: string, _: FormState, f: FormData): Promise<FormState> {
  const invite = await findUsableInvite(token, "JOIN")
  if (!invite) return { error: "This invite link has expired or has already been used." }

  let userId = (await getSession())?.user.id
  if (!userId) {
    const v = checkNewAccount(f)
    if ("error" in v) return v
    try {
      const h = new Headers(await headers())
      h.set(INVITE_HEADER, token)
      const res = await auth.api.signUpEmail({ body: v, headers: h })
      userId = res.user.id
    } catch (e) {
      return { error: message(e) }
    }
  }

  const joined = await db.$transaction(async (tx) => {
    // count the use only while the link still has uses left (two people racing for a single-use link)
    const used = await tx.invite.updateMany({
      where: { id: invite.id, uses: { lt: invite.maxUses }, revokedAt: null },
      data: { uses: { increment: 1 } },
    })
    if (used.count === 0) return false
    await tx.membership.upsert({
      where: { householdId_userId: { householdId: invite.householdId, userId: userId! } },
      create: { householdId: invite.householdId, userId: userId!, role: invite.role },
      update: {}, // already a member: keep their current role
    })
    await tx.inviteUse.upsert({
      where: { inviteId_userId: { inviteId: invite.id, userId: userId! } },
      create: { inviteId: invite.id, userId: userId! },
      update: {},
    })
    await tx.user.update({ where: { id: userId! }, data: { activeHouseholdId: invite.householdId } })
    const user = await tx.user.findUnique({ where: { id: userId! }, select: { name: true } })
    await tx.activity.create({
      data: {
        householdId: invite.householdId,
        userId,
        action: "joined",
        entityType: "Membership",
        entityId: userId!,
        summary: `${user?.name ?? "Someone"} joined the household`,
      },
    })
    return true
  })
  if (!joined) return { error: "This invite link has just been used up." }
  redirect("/")
}

/** Sets a new password from a one-time reset link an admin made. Signs the account out everywhere. */
export async function resetPassword(token: string, _: FormState, f: FormData): Promise<FormState> {
  const link = await findUsableInvite(token, "RESET")
  if (!link?.resetUserId) return { error: "This reset link has expired or has already been used." }
  const password = String(f.get("password") ?? "")
  if (password.length < 10) return { error: "Use at least 10 characters for the password." }
  if (password !== String(f.get("confirm") ?? "")) return { error: "The two passwords don't match." }

  const hash = await hashPassword(password)
  const userId = link.resetUserId
  await db.$transaction([
    db.invite.update({ where: { id: link.id }, data: { uses: { increment: 1 } } }),
    db.account.updateMany({ where: { userId, providerId: "credential" }, data: { password: hash } }),
    db.session.deleteMany({ where: { userId } }),
  ])
  redirect("/signin?reset=1")
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() })
  redirect("/signin")
}
