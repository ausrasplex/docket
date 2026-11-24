"use client"

import { useState, useTransition } from "react"
import { CalendarDays, CalendarPlus, CalendarX, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Drawer } from "@/components/drawer"
import { CopyField } from "@/components/copy-field"
import { makeCalendarLink, turnOffCalendarLink } from "./actions"

/** "3 hours ago", for when a calendar app last fetched the feed. */
function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 2) return "just now"
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  return `${Math.round(hours / 24)} days ago`
}

/**
 * Calendar: a private address to subscribe to in Google, Apple or Outlook calendars, with services due (and
 * booked, or estimated from driving), warranties ending and rego, across every household you're in.
 */
export function CalendarCard({ feed }: { feed: { made: string; checked: string | null } | null }) {
  const [url, setUrl] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const make = () =>
    start(async () => {
      const r = await makeCalendarLink()
      if (!r.ok) return void toast.error(r.error)
      setUrl(r.url)
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar</CardTitle>
        <CardDescription>Services due, bookings, warranties ending and rego, in the calendar you already use. Only you see your link.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {feed ? (
          <div className="flex items-center gap-3 rounded-2xl bg-surface2 p-3">
            <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-a3 text-on-a">
              <CalendarDays className="size-[18px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="text-sm font-bold">Calendar link is on</b>
              <span className="text-xs font-medium text-muted-foreground">
                Made {feed.made} · {feed.checked ? `last checked ${ago(feed.checked)}` : "not checked by a calendar yet"}
              </span>
            </span>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant={feed ? "outline" : "default"} disabled={pending} onClick={make}>
            {feed ? <RefreshCw /> : <CalendarPlus />}
            {feed ? "Make a New Link" : "Make Calendar Link"}
          </Button>
          {feed ? (
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await turnOffCalendarLink()
                  if (!r.ok) toast.error(r.error)
                  else toast("Calendar link turned off")
                })
              }
            >
              <CalendarX />
              Turn Off
            </Button>
          ) : null}
        </div>
        {feed ? <p className="text-xs font-medium text-muted-foreground">A new link stops the old one, if it&apos;s been shared by mistake or you&apos;ve lost it.</p> : null}
      </CardContent>

      <Drawer open={!!url} onOpenChange={(o) => !o && setUrl(null)} title="Your Calendar Link" description="Add it to your calendar as a subscription. This is the only time it's shown, so add it now (or make a new one later).">
        {url ? (
          <div className="flex flex-col gap-4">
            <CopyField value={url} shareTitle="Docket calendar" />
            <Button asChild variant="outline" className="self-start">
              <a href={url.replace(/^https?:/, "webcal:")}>
                <CalendarPlus />
                Open in Calendar App
              </a>
            </Button>
            <div className="flex flex-col gap-2 text-sm">
              <p>
                <b>Google Calendar:</b> on a computer, Other calendars › + › From URL, then paste the link.
              </p>
              <p>
                <b>iPhone or Mac:</b> tap Open in Calendar App, or Settings › Calendar › Accounts › Add Subscribed Calendar.
              </p>
              <p>
                <b>Outlook:</b> Add calendar › Subscribe from web, then paste the link.
              </p>
              <p className="text-xs font-medium text-muted-foreground">
                Calendars check for changes every few hours (Google can take up to a day). Anyone with the link can see these dates and item names, nothing else.
              </p>
            </div>
          </div>
        ) : null}
      </Drawer>
    </Card>
  )
}
