"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { isAPIError } from "better-auth/api"
import { verifyPassword } from "better-auth/crypto"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { logActivity, requireHousehold, requireUser } from "@/lib/dal"
import { baseUrl } from "@/lib/base-url"
import { hashToken, newToken } from "@/lib/tokens"
import { atLeast, ROLE_LABELS } from "@/lib/roles"
import { parseMode, parseTheme } from "@/lib/theme"
import type { Role } from "@/generated/prisma/enums"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

const DAY = 24 * 3600 * 1000
const INVITABLE: Role[] = ["ADMIN", "MEMBER", "VIEWER"]

/** Makes a shareable invite link. The token is shown once; only its hash is stored. */
export async function createInvite(input: { role: Role; expiresInDays: number | null; maxUses: number }): Promise<Result<{ url: string }>> {
  const c = await requireHousehold("ADMIN")
  if (!INVITABLE.includes(input.role)) return { ok: false, error: "Pick a role." }
  if (input.role === "ADMIN" && c.role !== "OWNER") return { ok: false, error: "Only the owner can invite admins." }
  const maxUses = Math.min(Math.max(1, Math.floor(input.maxUses)), 50)
  const token = newToken()
  await db.invite.create({
    data: {
      householdId: c.householdId,
      kind: "JOIN",
      tokenHash: hashToken(token),
      role: input.role,
      maxUses,
      expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * DAY) : null,
      createdById: c.user.id,
    },
  })
  revalidatePath("/settings")
  return { ok: true, url: `${await baseUrl()}/invite/${token}` }
}

export async function revokeInvite(id: string): Promise<Result> {
  const c = await requireHousehold("ADMIN")
  await db.invite.updateMany({ where: { id, householdId: c.householdId }, data: { revokedAt: new Date() } })
  revalidatePath("/settings")
  return { ok: true }
}

export async function changeRole(membershipId: string, role: Role): Promise<Result> {
  const c = await requireHousehold("ADMIN")
  const m = await db.membership.findFirst({ where: { id: membershipId, householdId: c.householdId }, include: { user: true } })
  if (!m) return { ok: false, error: "That person isn't in this household." }
  if (m.role === "OWNER") return { ok: false, error: "The owner's role can't be changed." }
  if (!INVITABLE.includes(role)) return { ok: false, error: "Pick a role." }
  if ((role === "ADMIN" || m.role === "ADMIN") && c.role !== "OWNER") return { ok: false, error: "Only the owner can change admins." }
  await db.membership.update({ where: { id: m.id }, data: { role } })
  await logActivity(c, { action: "updated", entityType: "Membership", entityId: m.id, summary: `${c.user.name} made ${m.user.name} ${ROLE_LABELS[role].toLowerCase()}` })
  revalidatePath("/settings")
  return { ok: true }
}

export async function removeMember(membershipId: string): Promise<Result> {
  const c = await requireHousehold("ADMIN")
  const m = await db.membership.findFirst({ where: { id: membershipId, householdId: c.householdId }, include: { user: true } })
  if (!m) return { ok: false, error: "That person isn't in this household." }
  if (m.role === "OWNER") return { ok: false, error: "The owner can't be removed." }
  if (m.role === "ADMIN" && c.role !== "OWNER") return { ok: false, error: "Only the owner can remove admins." }
  if (m.userId === c.user.id) return { ok: false, error: "You can't remove yourself here." }
  await db.$transaction([
    db.membership.delete({ where: { id: m.id } }),
    db.user.updateMany({ where: { id: m.userId, activeHouseholdId: c.householdId }, data: { activeHouseholdId: null } }),
  ])
  await logActivity(c, { action: "removed", entityType: "Membership", entityId: m.id, summary: `${c.user.name} removed ${m.user.name}` })
  revalidatePath("/settings")
  return { ok: true }
}

/** A one-time password-reset link for a member (Docket sends no email). Valid for 24 hours. */
export async function createResetLink(membershipId: string): Promise<Result<{ url: string }>> {
  const c = await requireHousehold("ADMIN")
  const m = await db.membership.findFirst({ where: { id: membershipId, householdId: c.householdId } })
  if (!m) return { ok: false, error: "That person isn't in this household." }
  if (!atLeast(c.role, m.role) || (m.role === "ADMIN" && c.role !== "OWNER")) {
    return { ok: false, error: "You can't reset the password of someone with a higher role." }
  }
  const token = newToken()
  await db.invite.create({
    data: {
      householdId: c.householdId,
      kind: "RESET",
      tokenHash: hashToken(token),
      resetUserId: m.userId,
      maxUses: 1,
      expiresAt: new Date(Date.now() + DAY),
      createdById: c.user.id,
    },
  })
  return { ok: true, url: `${await baseUrl()}/reset/${token}` }
}

export async function renameHousehold(name: string): Promise<Result> {
  const c = await requireHousehold("ADMIN")
  const n = name.trim()
  if (!n) return { ok: false, error: "Give the household a name." }
  await db.household.update({ where: { id: c.householdId }, data: { name: n } })
  revalidatePath("/", "layout")
  return { ok: true }
}

export async function updateProfile(name: string): Promise<Result> {
  const user = await requireUser()
  const n = name.trim()
  if (!n) return { ok: false, error: "Add your name." }
  await db.user.update({ where: { id: user.id }, data: { name: n } })
  revalidatePath("/", "layout")
  return { ok: true }
}

/** Checks the signed-in person's current password (asked before changing their email or password). */
async function passwordOk(userId: string, password: string) {
  const account = await db.account.findFirst({ where: { userId, providerId: "credential" }, select: { password: true } })
  return !!account?.password && (await verifyPassword({ hash: account.password, password }))
}

/** Changes the email you sign in with. Docket sends no email, so it just needs to be unused and your password. */
export async function changeEmail(newEmail: string, currentPassword: string): Promise<Result> {
  const user = await requireUser()
  const email = newEmail.trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter an email address to sign in with." }
  if (email === user.email) return { ok: false, error: "That's already your email." }
  if (!(await passwordOk(user.id, currentPassword))) return { ok: false, error: "Your current password isn't right." }
  if (await db.user.findUnique({ where: { email } })) return { ok: false, error: "Someone already signs in with that email." }
  await db.user.update({ where: { id: user.id }, data: { email, emailVerified: false } })
  revalidatePath("/", "layout")
  return { ok: true }
}

/** Changes your password. Signing out your other devices is on by default (a lost phone stays signed out). */
export async function changePassword(currentPassword: string, newPassword: string, signOutOthers: boolean): Promise<Result> {
  await requireUser()
  if (newPassword.length < 10) return { ok: false, error: "Use at least 10 characters for the new password." }
  if (newPassword === currentPassword) return { ok: false, error: "Choose a password different from the current one." }
  try {
    await auth.api.changePassword({ body: { currentPassword, newPassword, revokeOtherSessions: signOutOthers }, headers: await headers() })
  } catch (e) {
    if (isAPIError(e) && (e.status === "BAD_REQUEST" || e.status === "UNAUTHORIZED")) return { ok: false, error: "Your current password isn't right." }
    return { ok: false, error: "That didn't work. Try again." }
  }
  return { ok: true }
}

/** Saves the theme to the account, like Folio, so it follows you to other devices. */
export async function saveAppearance(theme: string, mode: string) {
  const user = await requireUser()
  await db.user.update({ where: { id: user.id }, data: { theme: parseTheme(theme), mode: parseMode(mode) } })
}

export async function switchHousehold(householdId: string): Promise<Result> {
  const user = await requireUser()
  const m = await db.membership.findFirst({ where: { userId: user.id, householdId } })
  if (!m) return { ok: false, error: "You're not in that household." }
  await db.user.update({ where: { id: user.id }, data: { activeHouseholdId: householdId } })
  revalidatePath("/", "layout")
  return { ok: true }
}
