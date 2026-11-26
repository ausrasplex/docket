import "server-only"
import { db } from "@/lib/db"
import { serviceOutlook } from "@/lib/service"

// The calendar feed: a person's upcoming dates across their households as an iCalendar (.ics) file that
// Google, Apple and Outlook calendars subscribe to and refresh on their own. All-day events only: services
// (booked, due, or estimated from how far a car is driven), warranties ending, and car registrations.

export type CalendarEvent = {
  uid: string
  date: Date // a day (UTC midnight)
  title: string
  description: string
  location: string
  url: string
}

/** How far around today the feed reaches: recent past (so an overdue date stays visible) to a few years out. */
const BACK_DAYS = 60
const AHEAD_DAYS = 365 * 3

export async function calendarEvents(userId: string, base: string, now = new Date()): Promise<CalendarEvent[]> {
  const from = new Date(now.getTime() - BACK_DAYS * 86_400_000)
  const to = new Date(now.getTime() + AHEAD_DAYS * 86_400_000)
  const inWindow = (d: Date | null | undefined): d is Date => !!d && d >= from && d <= to

  const items = await db.fixture.findMany({
    where: { archivedAt: null, property: { archivedAt: null }, household: { memberships: { some: { userId } } } },
    select: {
      id: true,
      name: true,
      category: true,
      odometer: true,
      warrantyExpiresAt: true,
      registrationExpiresAt: true,
      lentTo: true,
      lentDueBack: true,
      serviceEnabled: true,
      parent: { select: { id: true, name: true, serviceEnabled: true } },
      property: { select: { name: true } },
      household: { select: { name: true } },
      servicePlans: { where: { archivedAt: null }, select: { id: true, name: true, everyMonths: true, everyKm: true, bookedFor: true, bookedWith: true } },
      serviceRecords: { orderBy: [{ date: "desc" }, { createdAt: "desc" }], select: { date: true, odometer: true, plans: { select: { id: true } } } },
    },
  })
  const households = new Set(items.map((f) => f.household.name))

  const out: CalendarEvent[] = []
  for (const f of items) {
    const item = f.parent ? `${f.parent.name} › ${f.name}` : f.name
    const url = `${base}/fixtures/${f.parent?.id ?? f.id}`
    // with several households, say whose it is
    const location = households.size > 1 ? `${f.property.name} (${f.household.name})` : f.property.name
    const readings = f.serviceRecords.map((r) => ({ date: r.date, odometer: r.odometer }))

    // an item with servicing turned off (or a part of one) keeps its routines but stops reminding
    const servicing = f.serviceEnabled && (f.parent?.serviceEnabled ?? true)
    for (const p of servicing ? f.servicePlans : []) {
      const done = f.serviceRecords.filter((r) => r.plans.some((x) => x.id === p.id)).map((r) => ({ date: r.date, odometer: r.odometer }))
      const o = serviceOutlook(p, done, readings, f.odometer, now)
      if (!o.next || !inWindow(o.next.date)) continue
      const km = o.due.dueKm != null ? ` or at ${o.due.dueKm.toLocaleString("en-AU")} km` : ""
      const title =
        o.next.kind === "booked"
          ? `Service booked: ${item}${p.bookedWith ? ` at ${p.bookedWith}` : ""}`
          : o.next.kind === "estimate"
            ? `Service probably due: ${item}`
            : `Service due: ${item}`
      const description =
        o.next.kind === "booked"
          ? `${p.name}, booked in${p.bookedWith ? ` with ${p.bookedWith}` : ""}. Log it in Docket once it's done.`
          : o.next.kind === "estimate"
            ? o.estimate?.perDay
              ? `${p.name}: an estimate of when the kilometres will be reached${km}, from driving about ${Math.round(o.estimate.perDay)} km a day. The date moves as new readings are logged.`
              : `${p.name}: an estimate from the usual time between past services${km}.`
            : `${p.name}: due by this date${km}, whichever comes first.`
      out.push({ uid: `service-${p.id}`, date: o.next.date, title, description, location, url })
    }
    if (inWindow(f.warrantyExpiresAt)) {
      out.push({ uid: `warranty-${f.id}`, date: f.warrantyExpiresAt, title: `Warranty ends: ${item}`, description: `The last day of ${item}'s warranty, as recorded in Docket.`, location, url })
    }
    if (f.category === "VEHICLE" && inWindow(f.registrationExpiresAt)) {
      out.push({ uid: `rego-${f.id}`, date: f.registrationExpiresAt, title: `Rego due: ${item}`, description: `${item}'s registration expires.`, location, url })
    }
    if (f.lentTo && inWindow(f.lentDueBack)) {
      out.push({ uid: `lent-${f.id}`, date: f.lentDueBack, title: `Due back: ${item} from ${f.lentTo}`, description: `${f.lentTo} borrowed ${item} and said they'd return it by now.`, location, url })
    }
  }
  return out.sort((a, b) => a.date.getTime() - b.date.getTime())
}

// ───────── iCalendar text (RFC 5545) ─────────

/** Escapes text values: backslash, semicolon, comma and line breaks. */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")

/** Lines are at most 75 bytes; longer ones continue on the next line after a space (never splitting a character). */
function fold(line: string) {
  const out: string[] = []
  let cur = ""
  let bytes = 0
  for (const ch of line) {
    const n = Buffer.byteLength(ch)
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ""
      bytes = 0
    }
    cur += ch
    bytes += n
  }
  out.push(cur)
  return out.join("\r\n ")
}

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "")
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")

export function toICS(events: CalendarEvent[], name: string, now = new Date()) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Docket//Home records//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    "X-WR-CALDESC:Services\\, warranties and rego from Docket",
    // how often calendar apps should check again (they may wait longer)
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
  ]
  for (const e of events) {
    const next = new Date(e.date.getTime() + 86_400_000)
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}@docket`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${ymd(e.date)}`,
      `DTEND;VALUE=DATE:${ymd(next)}`,
      `SUMMARY:${esc(e.title)}`,
      `DESCRIPTION:${esc(`${e.description}\n\n${e.url}`)}`,
      `LOCATION:${esc(e.location)}`,
      `URL:${e.url}`,
      "TRANSP:TRANSPARENT", // an all-day reminder, not busy time
      // a reminder a week before, at 9am (calendars that honour alarms in subscriptions)
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(e.title)}`,
      "TRIGGER:-P6DT15H",
      "END:VALARM",
      "END:VEVENT",
    )
  }
  lines.push("END:VCALENDAR")
  return lines.map(fold).join("\r\n") + "\r\n"
}
