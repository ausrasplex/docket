import { db } from "@/lib/db"
import { baseUrl } from "@/lib/base-url"
import { calendarEvents, toICS } from "@/lib/calendar"
import { hashToken } from "@/lib/tokens"

/**
 * A person's calendar feed (/api/calendar/<secret>.ics). Calendar apps fetch it without signing in, so the
 * secret in the address is the key: it only shows dates and item names, and making a new link stops the old one.
 */
export async function GET(_req: Request, { params }: RouteContext<"/api/calendar/[token]">) {
  const { token } = await params
  const secret = token.replace(/\.ics$/i, "")
  const feed = secret ? await db.calendarFeed.findUnique({ where: { tokenHash: hashToken(secret) }, select: { id: true, userId: true, lastUsedAt: true } }) : null
  if (!feed) return new Response("This calendar link has been turned off or replaced.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } })

  const now = new Date()
  const ics = toICS(await calendarEvents(feed.userId, await baseUrl(), now), "Docket", now)
  // note when it was last fetched (at most every ten minutes, calendar apps poll often)
  if (!feed.lastUsedAt || now.getTime() - feed.lastUsedAt.getTime() > 10 * 60_000) {
    await db.calendarFeed.update({ where: { id: feed.id }, data: { lastUsedAt: now } })
  }
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="docket.ics"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  })
}
