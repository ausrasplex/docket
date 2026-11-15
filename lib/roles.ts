import type { Role } from "@/generated/prisma/enums"

const RANK: Record<Role, number> = { VIEWER: 0, MEMBER: 1, ADMIN: 2, OWNER: 3 }

/** True when `role` is at least `min` (OWNER > ADMIN > MEMBER > VIEWER). */
export function atLeast(role: Role, min: Role) {
  return RANK[role] >= RANK[min]
}

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
  VIEWER: "Viewer",
}

export const ROLE_DETAILS: Record<Role, string> = {
  OWNER: "Everything, including deleting the household",
  ADMIN: "Manage members and invites, and edit everything",
  MEMBER: "Add and edit records",
  VIEWER: "Read and export only",
}
