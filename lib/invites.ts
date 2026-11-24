import "server-only"
import { db } from "@/lib/db"
import { hashToken } from "@/lib/tokens"
import type { InviteKind } from "@/generated/prisma/client"

/** The invite or reset link for a token, if it is still usable (not revoked, expired or used up). */
export async function findUsableInvite(token: string, kind: InviteKind | InviteKind[]) {
  const invite = await db.invite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { household: { select: { id: true, name: true } } },
  })
  if (!invite || !(Array.isArray(kind) ? kind : [kind]).includes(invite.kind)) return null
  if (invite.revokedAt) return null
  if (invite.expiresAt && invite.expiresAt < new Date()) return null
  if (invite.uses >= invite.maxUses) return null
  return invite
}
