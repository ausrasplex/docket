import { CircleAlert, CircleCheck, DatabaseBackup } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { backupSettings, backupStatus, listSnapshots } from "@/lib/backup"
import { bytes } from "@/lib/format"
import { BackUpNow } from "./backups-button"

const when = (d: Date) =>
  d.toLocaleString("en-AU", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: process.env.TZ || undefined })

const hourLabel = (h: number) => (h === 0 ? "midnight" : h === 12 ? "midday" : h < 12 ? `${h} am` : `${h - 12} pm`)

/**
 * Backups (admins and the owner): when Docket last backed up the server, what it kept and where. The backup
 * covers every household on this server, so it can be run and seen here but not downloaded.
 */
export async function BackupsCard() {
  const [status, snaps] = await Promise.all([backupStatus(), listSnapshots()])
  const s = backupSettings()
  const newest = snaps[0]
  return (
    <Card>
      <CardHeader>
        <CardTitle>Backups</CardTitle>
        <CardDescription>
          {s.enabled ? `Docket backs up every night from ${hourLabel(s.hour)}: all records, and every uploaded file.` : "Nightly backups are turned off on this server (BACKUP_DISABLED)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status && !status.ok ? (
          <div className="flex items-start gap-3 rounded-2xl bg-destructive/10 p-3 text-sm">
            <CircleAlert className="mt-0.5 size-5 flex-none text-destructive" />
            <span className="flex flex-col">
              <b>The last backup failed ({when(new Date(status.at))})</b>
              <span className="text-xs font-medium break-words text-muted-foreground">{status.error}</span>
            </span>
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-a2 text-on-a">
            {newest ? <CircleCheck className="size-[18px]" /> : <DatabaseBackup className="size-[18px]" />}
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <b className="text-sm font-bold">{newest ? `Last backed up ${when(newest.at)}` : "Not backed up yet"}</b>
            <span className="text-xs font-medium text-muted-foreground">
              {newest
                ? `${snaps.length} of the last ${s.keep} kept, newest ${bytes(newest.bytes)}${status?.ok && status.filesTotal != null ? `; ${status.filesTotal.toLocaleString("en-AU")} files copied` : ""}`
                : "The first one runs about a minute after Docket starts."}
            </span>
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl bg-surface2 p-3">
          <span className="text-xs font-semibold text-muted-foreground">Saved on the server in</span>
          <code className="text-[13px] font-semibold break-all">{s.dir}</code>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          Keep a copy off this server too (another computer, a USB drive or cloud storage): a backup on the same machine won&apos;t survive that
          machine failing. The README explains how to restore one.
        </p>
        <BackUpNow />
      </CardContent>
    </Card>
  )
}
