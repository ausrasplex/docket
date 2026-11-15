"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}
const hourNow = () => new Date().getHours()
const noHour = () => -1

/** "Good morning/afternoon/evening" in the viewer's own time zone (computed in the browser). */
export function Greeting() {
  const h = useSyncExternalStore(subscribe, hourNow, noHour)
  if (h < 0) return <>Welcome back</>
  return <>{h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"}</>
}
