"use client"

import { useEffect, useState, useTransition } from "react"
import { Bell, BellOff, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { pushKey, removePush, savePush, testPush } from "./push-actions"

type State = "loading" | "unsupported" | "insecure" | "ios-install" | "blocked" | "off" | "on"

/** base64url → bytes, for the server's public key */
function keyBytes(b64: string) {
  const s = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

/** "iPhone", "Android", "Chrome on Windows": enough to tell devices apart */
function deviceName() {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return "iPhone"
  if (/iPad/.test(ua)) return "iPad"
  if (/Android/.test(ua)) return "Android"
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser"
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : ""
  return os ? `${browser} on ${os}` : browser
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/" })
}

/**
 * Settings › Reminders: turn phone reminders on for this device. Docket then sends one summary a day of what's
 * due soon or overdue (services, rego, warranties, loans), only when something new comes up.
 */
export function Reminders({ devices }: { devices: string[] }) {
  const [state, setState] = useState<State>("loading")
  const [pending, start] = useTransition()

  useEffect(() => {
    let live = true
    ;(async () => {
      const s: State = await (async () => {
        if (!window.isSecureContext) return "insecure"
        const ios = /iPhone|iPad/.test(navigator.userAgent)
        const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) return ios && !standalone ? "ios-install" : "unsupported"
        if (Notification.permission === "denied") return "blocked"
        const reg = await navigator.serviceWorker.getRegistration("/")
        const sub = await reg?.pushManager.getSubscription()
        return sub ? "on" : "off"
      })()
      if (live) setState(s)
    })()
    return () => {
      live = false
    }
  }, [])

  const turnOn = () =>
    start(async () => {
      const perm = await Notification.requestPermission()
      if (perm !== "granted") {
        setState(perm === "denied" ? "blocked" : "off")
        return void toast("Notifications weren't allowed")
      }
      const k = await pushKey()
      if (!k.ok) return void toast.error(k.error)
      try {
        const reg = await registration()
        await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(k.key) })
        const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
        const r = await savePush({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, deviceName())
        if (!r.ok) return void toast.error(r.error)
        setState("on")
        toast("Reminders are on for this device")
      } catch {
        toast.error("This browser couldn't turn on reminders.")
      }
    })

  const turnOff = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/")
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await removePush(sub.endpoint)
        await sub.unsubscribe().catch(() => {})
      }
      setState("off")
      toast("Reminders are off for this device")
    })

  const test = () =>
    start(async () => {
      const r = await testPush()
      if (!r.ok) return void toast.error(r.error)
      toast(r.sent === 1 ? "Test sent" : `Test sent to ${r.sent} devices`)
    })

  const note = {
    loading: null,
    unsupported: "This browser can't show reminders. Try Chrome, Edge, Firefox or Safari.",
    insecure: "Reminders need Docket to be opened over https (a secure address). On a plain http address, browsers don't allow them.",
    "ios-install": "On iPhone and iPad, add Docket to your Home Screen first (Share › Add to Home Screen), then open it from there and come back here.",
    blocked: "Notifications are blocked for Docket in this browser's settings. Allow them there, then come back.",
    off: null,
    on: "This device gets a summary each morning when something new is due soon or overdue.",
  }[state]

  return (
    <div className="flex flex-col gap-3">
      {note ? <p className="rounded-2xl bg-surface2 px-4 py-3 text-sm text-muted-foreground">{note}</p> : null}
      <div className="flex flex-wrap gap-2">
        {state === "off" ? (
          <Button disabled={pending} onClick={turnOn}>
            {pending ? <Loader2 className="animate-spin" /> : <Bell />}
            Turn On for This Device
          </Button>
        ) : null}
        {state === "on" ? (
          <>
            <Button variant="outline" disabled={pending} onClick={test}>
              <Send />
              Send a Test
            </Button>
            <Button variant="outline" disabled={pending} onClick={turnOff}>
              <BellOff />
              Turn Off Here
            </Button>
          </>
        ) : null}
      </div>
      {devices.length ? (
        <p className="text-xs font-medium text-muted-foreground">
          On for: {devices.join(", ")}
        </p>
      ) : null}
    </div>
  )
}
