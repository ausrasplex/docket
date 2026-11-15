"use client"

import { useState, useTransition } from "react"
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { InboxDoc } from "@/components/documents/doc-groups"
import { JobDrawer } from "@/components/jobs/job-drawer"
import { BLANK_EXPENSE, ExpenseDrawer } from "@/components/jobs/expense-drawer"
import type { ContactLite } from "@/components/jobs/contact-picker"
import { setJobArchived, type JobInput } from "../actions"

export function JobMenu({
  id,
  slug,
  title,
  archived,
  initial,
  rooms,
  contacts,
}: {
  id: string
  slug: string
  title: string
  archived: boolean
  initial: JobInput
  rooms: { id: string; name: string }[]
  contacts: ContactLite[]
}) {
  const [edit, setEdit] = useState(false)
  const [, start] = useTransition()
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Job options" className="bg-surface">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setEdit(true)}>
            <Pencil />
            Edit Job
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant={archived ? "default" : "destructive"}
            onSelect={() =>
              start(async () => {
                const r = await setJobArchived(id, !archived)
                if (!r.ok) toast.error(r.error)
                else toast(archived ? `${title} restored` : `${title} archived`)
              })
            }
          >
            {archived ? <ArchiveRestore /> : <Archive />}
            {archived ? "Restore Job" : "Archive Job"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <JobDrawer open={edit} onOpenChange={setEdit} initial={initial} editingId={id} editingSlug={slug} rooms={rooms} contacts={contacts} />
    </>
  )
}

/** "Add Cost" on a job: the job is fixed and its tradesperson is pre-selected. */
export function AddJobCost({ jobId, contactId, contacts, inbox }: { jobId: string; contactId: string | null; contacts: ContactLite[]; inbox: InboxDoc[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" className="mt-3 self-start" onClick={() => setOpen(true)}>
        <Plus />
        Add Cost
      </Button>
      <ExpenseDrawer
        open={open}
        onOpenChange={setOpen}
        initial={{ ...BLANK_EXPENSE, jobId, contactId, classification: "CAPITAL_IMPROVEMENT" }}
        jobs={[]}
        contacts={contacts}
        inbox={inbox}
        lockJob
      />
    </>
  )
}
