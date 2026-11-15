import "server-only"
import { createHash, randomBytes } from "node:crypto"

/** A random URL-safe token for invite and reset links (192 bits). Only its hash is stored. */
export function newToken() {
  return randomBytes(24).toString("base64url")
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex")
}
