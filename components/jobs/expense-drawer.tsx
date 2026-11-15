"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Camera, Check, FileUp, Inbox, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, FieldLabel, OptionRow } from "@/components/drawer"
import { Chip, Chips, Section } from "@/components/form-bits"
import { DocumentRow, type DocLike } from "@/components/documents/document-row"
import { DocMenu } from "@/components/documents/doc-menu"
import type { InboxDoc } from "@/components/documents/doc-groups"
import { EXPENSE_CATEGORIES, EXPENSE_CLASSES, PAYMENT_METHODS } from "@/lib/jobs"
import { gstOf } from "@/lib/parse"
import { createExpense, updateExpense, type ExpenseInput } from "@/app/(app)/jobs/actions"
import { fileTo } from "@/app/(app)/documents/actions"
import { ContactPicker, type ContactLite } from "./contact-picker"

export const BLANK_EXPENSE: ExpenseInput = {
  description: "",
  vendor: "",
  contactId: null,
  jobId: null,
  date: null,
  amount: "",
  gst: "",
  classification: "REPAIR_MAINTENANCE",
  category: "",
  paymentMethod: "",
  notes: "",
}

export type ExpenseEditing = { id: string; receipts: { linkId: string; doc: DocLike }[] }

/**
 * Add or edit a cost. The receipt can be photographed, uploaded or picked from the capture inbox right
 * here; files are attached once the cost is saved.
 */
export function ExpenseDrawer({
  open,
  onOpenChange,
  initial,
  editing,
  jobs,
  contacts,
  inbox,
  lockJob = false,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  initial: ExpenseInput
  editing?: ExpenseEditing | null
  jobs: { id: string; title: string }[]
  contacts: ContactLite[]
  inbox: InboxDoc[]
  /** on a job's page the job is fixed */
  lockJob?: boolean
}) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [incGst, setIncGst] = useState(true)
  const [files, setFiles] = useState<File[]>([])
  const [fromInbox, setFromInbox] = useState<string[]>([])
  const [showInbox, setShowInbox] = useState(false)
  const [pending, start] = useTransition()
  const camera = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setV({ ...initial, date: initial.date ?? new Date().toISOString().slice(0, 10) })
      setIncGst(!editing || !!initial.gst)
      setFiles([])
      setFromInbox([])
      setShowInbox(false)
    }
  }
  const set = <K extends keyof ExpenseInput>(k: K, val: ExpenseInput[K]) => setV((p) => ({ ...p, [k]: val }))
  // GST-inclusive prices: GST is a eleventh of the total, kept in step while the box is ticked
  const setAmount = (a: string) => setV((p) => ({ ...p, amount: a, gst: incGst ? gstOf(a.replace(/[$,\s]/g, "")) : p.gst }))
  const toggleGst = (on: boolean) => {
    setIncGst(on)
    set("gst", on ? gstOf(v.amount.replace(/[$,\s]/g, "")) : "")
  }

  const save = () =>
    start(async () => {
      let id = editing?.id
      if (editing) {
        const r = await updateExpense(editing.id, v)
        if (!r.ok) return void toast.error(r.error)
      } else {
        const r = await createExpense(v)
        if (!r.ok) return void toast.error(r.error)
        id = r.id
      }
      if (!id) return
      // attach the receipt: new files first, then anything picked from the inbox
      if (files.length) {
        const fd = new FormData()
        files.forEach((f) => fd.append("files", f))
        fd.append("expenseId", id)
        const up = await fetch("/api/documents", { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({ error: "The receipt couldn't be uploaded." }))
        if (up.error) toast.error(up.error)
        up.errors?.forEach((e: string) => toast.error(e))
      }
      for (const docId of fromInbox) {
        const f = await fileTo(docId, { type: "expense", id }, null)
        if (!f.ok) toast.error(f.error)
      }
      toast(editing ? "Saved" : "Cost added")
      onOpenChange(false)
      router.refresh()
    })

  const receipts = editing?.receipts ?? []
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? "Edit Cost" : "Add Cost or Receipt"}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending || !v.amount.trim()} onClick={save}>
            {editing ? "Save" : "Add Cost"}
          </Button>
        </>
      }
    >
      {/* The receipt first: on a phone you photograph it, then type the total */}
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted-foreground">Receipt</span>
        {receipts.length ? (
          <div className="flex flex-col">
            {receipts.map((r) => (
              <DocumentRow key={r.linkId} doc={r.doc} trailing={<DocMenu doc={{ id: r.doc.id, title: r.doc.title, isLink: !!r.doc.url }} onDeleted={() => router.refresh()} />} />
            ))}
          </div>
        ) : null}
        {files.map((f, i) => (
          <div key={i} className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2 text-sm">
            <FileUp className="size-4 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{f.name}</span>
            <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))} className="cursor-pointer rounded-full p-1 hover:bg-surface">
              <X className="size-4" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => camera.current?.click()}>
            <Camera />
            Take Photo
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => picker.current?.click()}>
            <FileUp />
            Upload
          </Button>
          {inbox.length ? (
            <Button type="button" variant={showInbox ? "secondary" : "outline"} size="sm" onClick={() => setShowInbox(!showInbox)}>
              <Inbox />
              From Inbox{fromInbox.length ? ` (${fromInbox.length})` : ""}
            </Button>
          ) : null}
        </div>
        {showInbox ? (
          <div className="grid grid-cols-3 gap-2">
            {inbox.map((d) => {
              const on = fromInbox.includes(d.id)
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={on}
                  aria-label={d.title}
                  onClick={() => setFromInbox(on ? fromInbox.filter((x) => x !== d.id) : [...fromInbox, d.id])}
                  className={cn("relative aspect-square cursor-pointer overflow-hidden rounded-xl border-2 bg-surface2", on ? "border-sel" : "border-transparent")}
                >
                  {d.hasThumb ? (
                    // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file
                    <img src={`/api/files/${d.id}?v=thumb`} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex size-full items-center justify-center p-1 text-center text-[11px] font-semibold">{d.title}</span>
                  )}
                  {on ? (
                    <span className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-sel text-white">
                      <Check className="size-3.5" />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ) : null}
        <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files && setFiles([...files, ...e.target.files])} />
        <input ref={picker} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => e.target.files && setFiles([...files, ...e.target.files])} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Total Paid">
          <Input value={v.amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="$" autoFocus={!editing} />
        </FieldLabel>
        <FieldLabel label="Date">
          <Input type="date" value={v.date ?? ""} onChange={(e) => set("date", e.target.value || null)} />
        </FieldLabel>
      </div>
      <label className="-mt-1 flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
        <input type="checkbox" checked={incGst} onChange={(e) => toggleGst(e.target.checked)} className="size-5 accent-[var(--sel)]" />
        Includes GST
        {incGst ? <span className="font-medium text-muted-foreground">({v.gst ? `$${v.gst}` : "$0.00"})</span> : null}
      </label>
      {incGst ? null : (
        <FieldLabel label="GST (if any)">
          <Input value={v.gst} onChange={(e) => set("gst", e.target.value)} inputMode="decimal" placeholder="$" />
        </FieldLabel>
      )}
      <FieldLabel label="What For">
        <Input value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Tiles and adhesive" />
      </FieldLabel>

      <div role="radiogroup" aria-label="Tax treatment" className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted-foreground">Tax Treatment</span>
        {EXPENSE_CLASSES.map((x) => (
          <OptionRow key={x.id} selected={v.classification === x.id} onSelect={() => set("classification", x.id)} title={x.label} detail={x.detail} />
        ))}
        <span className="text-xs text-muted-foreground">Used by the tax export. Check anything unusual with your accountant.</span>
      </div>

      {!lockJob && jobs.length ? (
        <Chips label="Job (optional)">
          <Chip on={!v.jobId} onClick={() => set("jobId", null)}>
            None
          </Chip>
          {jobs.map((j) => (
            <Chip key={j.id} on={v.jobId === j.id} onClick={() => set("jobId", j.id)}>
              {j.title}
            </Chip>
          ))}
        </Chips>
      ) : null}

      <Section title="Who and How" />
      <ContactPicker contacts={contacts} value={v.contactId} onChange={(id) => set("contactId", id)} label="Paid To (a tradesperson)" />
      <FieldLabel label="Or a Shop or Supplier">
        <Input value={v.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="Bunnings" />
      </FieldLabel>
      <Chips label="Category">
        {EXPENSE_CATEGORIES.map((c) => (
          <Chip key={c} on={v.category === c} onClick={() => set("category", v.category === c ? "" : c)}>
            {c}
          </Chip>
        ))}
      </Chips>
      <Chips label="Paid By">
        {PAYMENT_METHODS.map((m) => (
          <Chip key={m} on={v.paymentMethod === m} onClick={() => set("paymentMethod", v.paymentMethod === m ? "" : m)}>
            {m}
          </Chip>
        ))}
      </Chips>
      <FieldLabel label="Notes (optional)">
        <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} />
      </FieldLabel>
    </Drawer>
  )
}
