"use client"

import { useTransition } from "react"
import Link from "next/link"
import { ArchiveRestore, ChevronLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CategoryTile } from "@/components/fixtures/category-tile"
import { CoverTile } from "@/components/covers/cover-tile"
import type { FixtureCategory } from "@/generated/prisma/enums"
import { setFixtureArchived } from "./actions"

export type ArchivedRow = {
  id: string
  name: string
  category: FixtureCategory
  photo: string | null
  detail: string
  archived: string
  /** for a part: its item, and whether that's archived too */
  partOf: { id: string; name: string; archived: boolean } | null
}

/**
 * Fixtures › Archived: items and parts that were archived, newest first, each with Restore. Archived parts
 * can't be reached any other way (a part's page is its item's page, which only lists current parts).
 */
export function ArchivedList({ rows, canEdit }: { rows: ArchivedRow[]; canEdit: boolean }) {
  const [pending, start] = useTransition()
  const restore = (r: ArchivedRow) =>
    start(async () => {
      const x = await setFixtureArchived(r.id, false)
      if (!x.ok) return void toast.error(x.error)
      toast(`${r.name} restored`)
    })

  return (
    <div className="flex flex-col gap-4">
      <Link href="/fixtures" className="flex items-center gap-1 self-start text-sm font-semibold text-muted-foreground hover:text-ink">
        <ChevronLeft className="size-4" />
        Back to Fixtures
      </Link>
      {rows.length ? (
        <ul className="flex flex-col rounded-3xl bg-surface px-4">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
              {r.partOf ? <CoverTile icon={{ type: "part" }} src={r.photo} className="size-10 rounded-xl" /> : <CategoryTile value={r.category} src={r.photo} className="size-10 rounded-xl" />}
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                {r.partOf ? (
                  <span className="truncate text-[15px] font-bold">{r.name}</span>
                ) : (
                  <Link href={`/fixtures/${r.id}`} className="truncate text-[15px] font-bold hover:underline">
                    {r.name}
                  </Link>
                )}
                <span className="truncate text-xs font-medium text-muted-foreground">
                  {[r.partOf ? `Part of ${r.partOf.name}${r.partOf.archived ? " (also archived)" : ""}` : null, r.detail, `Archived ${r.archived}`].filter(Boolean).join(" · ")}
                </span>
              </span>
              {canEdit ? (
                <Button variant="outline" size="sm" disabled={pending} onClick={() => restore(r)}>
                  <ArchiveRestore />
                  <span className="max-desk:sr-only">Restore</span>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-surface2 px-4 py-3 text-sm text-muted-foreground">Nothing archived. Archived items and parts appear here, ready to restore.</p>
      )}
    </div>
  )
}
