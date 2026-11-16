"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}
const now = () => new Date().toDateString()
const none = () => ""

/** "Good morning/afternoon/evening, Name" in the viewer's own time zone (computed in the browser). */
export function Greeting({ name }: { name?: string }) {
  const d = useSyncExternalStore(subscribe, now, none)
  const h = d ? new Date().getHours() : -1
  const hi = h < 0 ? "Welcome back" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
  return <>{name ? `${hi}, ${name}` : hi}</>
}

/** Today's date, e.g. "Monday 16 November 2026", in the viewer's time zone. */
export function Today() {
  const d = useSyncExternalStore(subscribe, now, none)
  if (!d) return <>&nbsp;</>
  const t = new Date(d)
  const part = (o: Intl.DateTimeFormatOptions) => t.toLocaleDateString("en-AU", o)
  return <>{`${part({ weekday: "long" })} ${t.getDate()} ${part({ month: "long" })} ${t.getFullYear()}`}</>
}
