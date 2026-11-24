"use client"

import { useState, useTransition } from "react"
import { Archive, ArchiveRestore, Copy, MoreHorizontal, Pencil } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { FinishDrawer } from "@/components/finishes/finish-drawer"
import { sameColour, type FinishRow } from "@/components/finishes/finish-types"
import { setFinishArchived } from "../actions"

/** The ⋯ menu on a paint's page: edit it, use the colour in another room, archive or restore it. */
export function PaintMenu({ row, archived, rooms, brands }: { row: FinishRow; archived: boolean; rooms: { id: string; name: string }[]; brands: string[] }) {
  const [mode, setMode] = useState<"edit" | "copy" | null>(null)
  const [pending, start] = useTransition()
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Paint options" className="bg-surface">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onSelect={() => setMode("edit")}>
            <Pencil />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setMode("copy")}>
            <Copy />
            Use in Another Room
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant={archived ? "default" : "destructive"}
            disabled={pending}
            onSelect={() =>
              start(async () => {
                const r = await setFinishArchived(row.id, !archived)
                if (!r.ok) toast.error(r.error)
                else toast(archived ? "Restored" : "Archived")
              })
            }
          >
            {archived ? <ArchiveRestore /> : <Archive />}
            {archived ? "Restore" : `Archive From ${row.room}`}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FinishDrawer
        open={!!mode}
        onOpenChange={(o) => !o && setMode(null)}
        initial={mode === "copy" ? sameColour(row.input) : row.input}
        editing={mode === "edit" ? row : null}
        rooms={rooms}
        brands={brands}
      />
    </>
  )
}
