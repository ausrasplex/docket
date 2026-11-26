import "server-only"
import webpush from "web-push"
import { db } from "@/lib/db"
import { comingUp } from "@/lib/coming-up"

// Phone reminders (Web Push). The server makes its own key pair the first time someone turns reminders on;
// each device's subscription is stored per user. Once a day (after REMINDER_HOUR) every device gets one
// summary of what's due soon or overdue, but only when something new needs attention, or a week has passed.

const HOUR = Math.min(23, Math.max(0, Number(process.env.REMINDER_HOUR ?? 8) || 0))
const WEEK = 7 * 86_400_000

/** The server's public key (made on first use), for a browser to subscribe with. */
export async function vapidKeys(subject?: string) {
  let cfg = await db.serverConfig.findUnique({ where: { id: 1 } })
  if (!cfg?.vapidPublicKey || !cfg.vapidPrivateKey) {
    const k = webpush.generateVAPIDKeys()
    cfg = await db.serverConfig.upsert({
      where: { id: 1 },
      create: { id: 1, vapidPublicKey: k.publicKey, vapidPrivateKey: k.privateKey, pushSubject: subject ?? null },
      update: { vapidPublicKey: k.publicKey, vapidPrivateKey: k.privateKey },
    })
  }
  if (subject && subject !== cfg.pushSubject && subject.startsWith("https://")) {
    cfg = await db.serverConfig.update({ where: { id: 1 }, data: { pushSubject: subject } })
  }
  return { publicKey: cfg.vapidPublicKey!, privateKey: cfg.vapidPrivateKey!, subject: cfg.pushSubject }
}

export type PushMessage = { title: string; body: string; url: string; tag?: string }

/** Send to one device. A device that's gone (unsubscribed, app removed) is forgotten. */
async function sendTo(sub: { id: string; endpoint: string; p256dh: string; auth: string }, msg: PushMessage) {
  const k = await vapidKeys()
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(msg), {
      vapidDetails: { subject: k.subject ?? process.env.BETTER_AUTH_URL ?? "https://localhost", publicKey: k.publicKey, privateKey: k.privateKey },
      TTL: 12 * 3600,
    })
    return true
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) await db.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {})
    else console.error("Docket: push failed:", status ?? e)
    return false
  }
}

/** A test reminder to every device of one user. Returns how many it reached. */
export async function sendTest(userId: string) {
  const subs = await db.pushSubscription.findMany({ where: { userId } })
  const ok = await Promise.all(subs.map((s) => sendTo(s, { title: "Docket", body: "Reminders are on. You'll hear about services, rego, warranties and loans as they come due.", url: "/", tag: "test" })))
  return { sent: ok.filter(Boolean).length, devices: subs.length }
}

/** What needs attention for one user, across every household and property they belong to. */
async function dueFor(userId: string) {
  const props = await db.property.findMany({
    where: { archivedAt: null, household: { memberships: { some: { userId } } } },
    select: { id: true, householdId: true },
  })
  const lists = await Promise.all(props.map((p) => comingUp(p.householdId, p.id)))
  return lists.flat().sort((a, b) => a.sortAt - b.sortAt)
}

/** The daily summary for every device: only when something new is due, or weekly while things stay overdue. */
export async function sendReminders(now = new Date()) {
  const subs = await db.pushSubscription.findMany()
  const byUser = new Map<string, typeof subs>()
  for (const s of subs) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s])
  for (const [userId, list] of byUser) {
    const due = await dueFor(userId)
    if (!due.length) continue
    const keys = due.map((u) => `${u.fixtureId}:${u.what}:${u.due.tone}`)
    const lines = due.slice(0, 4).map((u) => `${u.item}: ${u.what === "Due Back" ? u.due.text : `${u.what}, ${u.due.text}`}`)
    if (due.length > 4) lines.push(`and ${due.length - 4} more`)
    const msg: PushMessage = {
      title: due.length === 1 ? "Docket: 1 thing needs attention" : `Docket: ${due.length} things need attention`,
      body: lines.join("\n"),
      url: due.length === 1 ? `/fixtures/${due[0].itemId}` : "/",
      tag: "coming-up",
    }
    for (const s of list) {
      const fresh = keys.some((k) => !s.lastKeys.includes(k))
      const stale = !s.lastSentAt || now.getTime() - s.lastSentAt.getTime() > WEEK
      if (!fresh && !stale) continue
      if (await sendTo(s, msg)) await db.pushSubscription.update({ where: { id: s.id }, data: { lastKeys: keys, lastSentAt: now } })
    }
  }
}

/** Checks every 15 minutes; sends once a day after REMINDER_HOUR. Started once from instrumentation.ts. */
export function scheduleReminders() {
  if (process.env.REMINDERS_DISABLED === "1") return
  const g = globalThis as unknown as { docketReminderTimer?: NodeJS.Timeout; docketReminderDay?: string }
  if (g.docketReminderTimer) return
  const check = async () => {
    const now = new Date()
    const today = now.toDateString()
    if (now.getHours() < HOUR || g.docketReminderDay === today) return
    g.docketReminderDay = today
    try {
      await sendReminders(now)
    } catch (e) {
      console.error("Docket: reminders failed:", e)
    }
  }
  setTimeout(check, 90_000).unref()
  g.docketReminderTimer = setInterval(check, 15 * 60_000)
  g.docketReminderTimer.unref()
}
