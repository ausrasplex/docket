import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"

// Pages anyone can open. Everything else needs a session cookie.
const PUBLIC = ["/signin", "/signup", "/invite/", "/reset/", "/api/auth/"]

/**
 * Fast, optimistic check: no session cookie → sign in. The real check (is the session valid,
 * is the user a member of this household) happens on the server in lib/dal.ts.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p))) return NextResponse.next()
  if (getSessionCookie(req)) return NextResponse.next()
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sign in first" }, { status: 401 })
  const url = new URL("/signin", req.url)
  if (pathname !== "/") url.searchParams.set("next", pathname + search)
  return NextResponse.redirect(url)
}

export const config = {
  // skip Next's assets, icons and the manifest
  matcher: ["/((?!_next/static|_next/image|icon.png|icon-|apple-touch-icon|brand/|manifest.webmanifest|favicon).*)"],
}
