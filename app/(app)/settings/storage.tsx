import { FileText, Image as ImageIcon, Images } from "lucide-react"
import { cn } from "cn"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db"
import { diskSpace, householdUsage } from "@/lib/storage"

/** Sizes for people: "0 B", "312 KB", "48.2 MB", "1.27 GB". */
function size(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${Math.round(n / 1024)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-AU")} ${n === 1 ? one : many}`

/**
 * Storage: how much space this household's files take on the server, split into PDFs, photos, and the previews
 * and crops Docket makes from them; measured on disk, with the server's free space for scale.
 */
export async function StorageCard({ householdId }: { householdId: string }) {
  const [usage, disk, links, archived] = await Promise.all([
    householdUsage(householdId),
    diskSpace(),
    db.document.count({ where: { householdId, url: { not: null }, archivedAt: null } }),
    db.document.aggregate({ where: { householdId, archivedAt: { not: null }, storageKey: { not: null } }, _sum: { sizeBytes: true }, _count: true }),
  ])

  const rows = [
    { key: "documents", label: "Documents", hint: "PDFs: manuals, warranties, invoices", icon: FileText, tone: "bg-a1", ...usage.documents },
    { key: "photos", label: "Photos", hint: "Photos and scanned receipts, full size", icon: ImageIcon, tone: "bg-a2", ...usage.photos },
    { key: "previews", label: "Previews and Crops", hint: "Small copies Docket makes for lists and room and item photos", icon: Images, tone: "bg-a3", ...usage.previews },
  ]
  const total = usage.total

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage</CardTitle>
        <CardDescription>The space this household&apos;s files take up on the server.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-2xl font-bold tabular-nums">{size(total)}</span>
          {disk ? (
            <span className="text-right text-[13px] font-medium text-muted-foreground">
              {size(disk.free)} free of {size(disk.size)}
            </span>
          ) : null}
        </div>

        {/* the split, as one bar */}
        <div
          role="img"
          aria-label={rows.map((r) => `${r.label} ${size(r.bytes)}`).join(", ")}
          className="flex h-3 w-full overflow-hidden rounded-full bg-surface2"
        >
          {total
            ? rows.map((r) =>
                r.bytes ? <span key={r.key} className={cn("h-full border-r-2 border-surface last:border-r-0", r.tone)} style={{ width: `${(r.bytes / total) * 100}%`, minWidth: 4 }} /> : null,
              )
            : null}
        </div>

        <ul className="flex flex-col">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
              <span className={cn("flex size-10 flex-none items-center justify-center rounded-xl text-on-a", r.tone)}>
                <r.icon className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <b className="text-sm font-bold">{r.label}</b>
                <span className="truncate text-xs font-medium text-muted-foreground">{r.hint}</span>
              </span>
              <span className="flex flex-none flex-col items-end">
                <b className="text-sm font-bold tabular-nums">{size(r.bytes)}</b>
                <span className="text-xs font-medium text-muted-foreground tabular-nums">{plural(r.files, "file")}</span>
              </span>
            </li>
          ))}
        </ul>

        {links || archived._count ? (
          <p className="text-xs font-medium text-muted-foreground">
            {links ? `${plural(links, "web link")} ${links === 1 ? "takes" : "take"} no space. ` : null}
            {archived._count
              ? `${plural(archived._count, "archived document")} (${size(archived._sum.sizeBytes ?? 0)}) still ${archived._count === 1 ? "uses" : "use"} space until deleted.`
              : null}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
