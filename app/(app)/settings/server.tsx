import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"
import { date } from "@/lib/format"
import { diskSpace, householdUsage } from "@/lib/storage"
import { HouseholdInvites } from "./server-invites"
import { UploadLimit } from "./upload-limit"
import { UPLOAD_LIMITS, maxUploadMb } from "@/lib/server-config"

/** Sizes for people: "0 B", "312 KB", "48.2 MB", "1.27 GB". */
function size(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${Math.round(n / 1024)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

/**
 * Server (server admins only): links that let someone start their own household here, and how much space each
 * household's files take. Only totals: running the server doesn't show anyone else's records.
 */
export async function ServerCard({ currentHouseholdId }: { currentHouseholdId: string }) {
  const [households, invites, disk, uploadMb] = await Promise.all([
    db.household.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, createdAt: true, _count: { select: { memberships: true } } } }),
    db.invite.findMany({
      where: { kind: "HOUSEHOLD", revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { createdBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    diskSpace(),
    maxUploadMb(),
  ])
  const usage = await Promise.all(households.map((h) => householdUsage(h.id)))
  const rows = households.map((h, i) => ({ ...h, bytes: usage[i].total })).sort((a, b) => b.bytes - a.bytes)
  const total = rows.reduce((n, r) => n + r.bytes, 0)
  const open = invites.filter((i) => i.uses < i.maxUses)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server</CardTitle>
        <CardDescription>You run this Docket server. Invite people to start their own household, and keep an eye on space.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <HouseholdInvites
          invites={open.map((i) => ({ id: i.id, uses: i.uses, maxUses: i.maxUses, expires: i.expiresAt ? date(i.expiresAt) : null, by: i.createdBy.name }))}
        />

        <UploadLimit value={uploadMb} options={UPLOAD_LIMITS} />

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[13px] font-bold text-muted-foreground">Storage by Household</h3>
            <span className="text-right text-[13px] font-medium text-muted-foreground">
              {size(total)} in all{disk ? ` · ${size(disk.free)} free` : ""}
            </span>
          </div>
          <ul className="flex flex-col">
            {rows.map((h) => (
              <li key={h.id} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="truncate text-sm font-bold">
                    {h.name}
                    {h.id === currentHouseholdId ? <span className="font-semibold text-muted-foreground"> · this one</span> : null}
                  </b>
                  <span className="text-xs font-medium text-muted-foreground">
                    {h._count.memberships} {h._count.memberships === 1 ? "person" : "people"} · since {date(h.createdAt)}
                  </span>
                </span>
                <span className="flex flex-none flex-col items-end gap-1">
                  <b className="text-sm font-bold tabular-nums">{size(h.bytes)}</b>
                  <span className="h-1.5 w-20 overflow-hidden rounded-full bg-surface2">
                    <span className="block h-full rounded-full bg-a1" style={{ width: total ? `${Math.max(2, (h.bytes / total) * 100)}%` : 0 }} />
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs font-medium text-muted-foreground">Totals only: documents, photos and previews together. What&apos;s in other households stays private to them.</p>
        </div>
      </CardContent>
    </Card>
  )
}
