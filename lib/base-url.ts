import "server-only"
import { headers } from "next/headers"

/** The address people reach Docket on, for links made in the app (behind a reverse proxy too). */
export async function baseUrl() {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https")
  if (host) return `${proto}://${host}`
  return process.env.BETTER_AUTH_URL ?? "http://localhost:3000"
}
