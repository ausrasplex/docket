"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, FieldLabel } from "@/components/drawer"
import { Chip, Chips, Section } from "@/components/form-bits"
import { JOB_STATUSES } from "@/lib/jobs"
import { createJob, updateJob, type JobInput } from "@/app/(app)/jobs/actions"
import { ContactPicker, type ContactLite } from "./contact-picker"

export const BLANK_JOB: JobInput = {
  title: "",
  status: "DONE",
  spaceIds: [],
  contactId: null,
  startedAt: null,
  finishedAt: null,
  permitNumber: "",
  description: "",
}

/** Add or edit a job: what was done, where, by whom and when. Costs are added on the job's page. */
export function JobDrawer({
  open,
  onOpenChange,
  initial,
  editingId,
  editingSlug,
  rooms,
  contacts,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: JobInput
  editingId?: string
  /** the job's current address, to follow it when a rename changes it */
  editingSlug?: string
  rooms: { id: string; name: string }[]
  contacts: ContactLite[]
}) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [pending, start] = useTransition()
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setV(initial)
  }
  const set = <K extends keyof JobInput>(k: K, val: JobInput[K]) => setV((p) => ({ ...p, [k]: val }))
  const toggleRoom = (id: string) => set("spaceIds", v.spaceIds.includes(id) ? v.spaceIds.filter((x) => x !== id) : [...v.spaceIds, id])

  const save = () =>
    start(async () => {
      const r = editingId ? await updateJob(editingId, v) : await createJob(v)
      if (!r.ok) return void toast.error(r.error)
      toast(editingId ? "Saved" : "Job added")
      onOpenChange(false)
      if (!editingId && "slug" in r) router.push(`/jobs/${r.slug}`)
      else if (editingId && editingSlug && "slug" in r && r.slug !== editingSlug) router.replace(`/jobs/${r.slug}`)
    })

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={editingId ? "Edit Job" : "Add Job"}
      description={editingId ? undefined : "A renovation, repair or installation. Add its costs and receipts next."}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending || !v.title.trim()} onClick={save}>
            {editingId ? "Save" : "Add Job"}
          </Button>
        </>
      }
    >
      <FieldLabel label="What Was Done">
        <Input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Bathroom renovation" autoFocus />
      </FieldLabel>
      <Chips label="Status">
        {JOB_STATUSES.map((s) => (
          <Chip key={s.id} on={v.status === s.id} onClick={() => set("status", s.id)}>
            {s.label}
          </Chip>
        ))}
      </Chips>
      <Chips label="Rooms">
        {rooms.map((r) => (
          <Chip key={r.id} on={v.spaceIds.includes(r.id)} onClick={() => toggleRoom(r.id)}>
            {r.name}
          </Chip>
        ))}
      </Chips>
      <ContactPicker contacts={contacts} value={v.contactId} onChange={(id) => set("contactId", id)} />

      <Section title="Dates and Approvals" />
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Started">
          <Input type="date" value={v.startedAt ?? ""} onChange={(e) => set("startedAt", e.target.value || null)} />
        </FieldLabel>
        <FieldLabel label="Finished">
          <Input type="date" value={v.finishedAt ?? ""} onChange={(e) => set("finishedAt", e.target.value || null)} />
        </FieldLabel>
      </div>
      <FieldLabel label="Permit or Approval Number (optional)">
        <Input value={v.permitNumber} onChange={(e) => set("permitNumber", e.target.value)} placeholder="Council or building permit" />
      </FieldLabel>
      <FieldLabel label="Details (optional)">
        <Textarea value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Scope, materials, anything to remember" />
      </FieldLabel>
    </Drawer>
  )
}
