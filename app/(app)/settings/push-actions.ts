"use server"

import { db } from "@/lib/db"
import { requireUser } from "@/lib/dal"
import { baseUrl } from "@/lib/base-url"
import { sendTest, vapidKeys } from "@/lib/push"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

/** The key a browser subscribes with (the server makes its key pair on first use). */
export async function pushKey(): Promise<Result<{ key: string }>> {
  await requireUser()
  const k = await vapidKeys(await baseUrl())
  return { ok: true, key: k.publicKey }
}

/** Remember this device for reminders. */
export async function savePush(sub: { endpoint: string; p256dh: string; auth: string }, device: string): Promise<Result> {
  const user = await requireUser()
  if (!/^https:\/\//.test(sub.endpoint) || !sub.p256dh || !sub.auth) return { ok: false, error: "That browser didn't give a usable subscription." }
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { userId: user.id, endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, device: device.slice(0, 60) || null },
    update: { userId: user.id, p256dh: sub.p256dh, auth: sub.auth, device: device.slice(0, 60) || null },
  })
  return { ok: true }
}

/** Stop reminders on one device (this one), or on all of this person's devices. */
export async function removePush(endpoint: string | null): Promise<Result> {
  const user = await requireUser()
  await db.pushSubscription.deleteMany({ where: { userId: user.id, ...(endpoint ? { endpoint } : {}) } })
  return { ok: true }
}

/** Send a test reminder to every device of this person. */
export async function testPush(): Promise<Result<{ sent: number }>> {
  const user = await requireUser()
  const r = await sendTest(user.id)
  if (!r.devices) return { ok: false, error: "No devices have reminders turned on yet." }
  if (!r.sent) return { ok: false, error: "The reminder couldn't be delivered. Turn reminders off and on again on this device." }
  return { ok: true, sent: r.sent }
}
