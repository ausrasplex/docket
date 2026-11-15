"use client"

import { useState, useTransition } from "react"
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { BLANK_FIXTURE, FixtureDrawer } from "../fixture-drawer"
import { setFixtureArchived, type FixtureInput } from "../actions"

export function FixtureMenu({
  id,
  name,
  archived,
  initial,
  rooms,
  brands,
}: {
  id: string
  name: string
  archived: boolean
  initial: FixtureInput
  rooms: { id: string; name: string }[]
  brands: string[]
}) {
  const [edit, setEdit] = useState(false)
  const [addPart, setAddPart] = useState(false)
  const [, start] = useTransition()
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Item options" className="bg-surface">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setEdit(true)}>
            <Pencil />
            Edit Item
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAddPart(true)}>
            <Plus />
            Add Part
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant={archived ? "default" : "destructive"}
            onSelect={() =>
              start(async () => {
                const r = await setFixtureArchived(id, !archived)
                if (!r.ok) toast.error(r.error)
                else toast(archived ? `${name} restored` : `${name} archived`)
              })
            }
          >
            {archived ? <ArchiveRestore /> : <Archive />}
            {archived ? "Restore Item" : "Archive Item"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FixtureDrawer open={edit} onOpenChange={setEdit} initial={initial} editingId={id} rooms={rooms} brands={brands} />
      <FixtureDrawer
        open={addPart}
        onOpenChange={setAddPart}
        initial={{ ...BLANK_FIXTURE, category: initial.category, brand: initial.brand }}
        parent={{ id, name }}
        rooms={rooms}
        brands={brands}
      />
    </>
  )
}
