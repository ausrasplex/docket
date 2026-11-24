"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Archive, CalendarCheck, CalendarClock, CalendarX, Camera, Check, ChevronDown, FileUp, Gauge, History, Inbox, MoreHorizontal, Paperclip, Pencil, Trash2, Wrench, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Drawer, FieldLabel } from "@/components/drawer"
import { Section } from "@/components/form-bits"
import { DocumentRow, type DocLike } from "@/components/documents/document-row"
import type { InboxDoc } from "@/components/documents/doc-groups"
import { ContactPicker, type ContactLite } from "@/components/jobs/contact-picker"
import { fileTo } from "@/app/(app)/documents/actions"
import { DUE_TONE, formatKm, type Due } from "@/lib/service"
import { date as fmtDate, money } from "@/lib/format"
import { gstOf } from "@/lib/parse"
import { archivePlan, bookService, cancelBooking, deleteRecord, savePlan, saveRecord, type PlanInput, type RecordInput } from "../service-actions"

export type PlanRow = {
  id: string
  name: string
  everyMonths: number | null
  everyKm: number | null
  notes: string | null
  interval: string
  /** the chip: a booking, else whichever of the due date or estimate is sooner */
  due: Due
  /** "in 265 days · 12 Aug 2027 or at 95,000 km" */
  firm: string | null
  /** "in 200 days · 12 Jun 2027 (driving about 41 km a day)": when the km interval will probably be reached */
  estimate: string | null
  booked: { date: string; with: string | null; past: boolean } | null
}
/** A new service, started from "Serviced": today, earlier, or the booking that was due. */
type NewRecord = { new: true; date: string | null; planIds: string[] }
export type RecordRow = {
  id: string
  date: string // yyyy-mm-dd
  odometer: number | null
  title: string
  notes: string | null
  planIds: string[]
  contactId: string | null
  who: string | null
  vendor: string | null
  amount: string | null
  gst: string | null
  expenseId: string | null
  receipts: { linkId: string; doc: DocLike }[]
}

const today = () => new Date().toISOString().slice(0, 10)

/**
 * An item's servicing: its routines (with when each is next due) and its service log (with costs and
 * receipts). Used for vehicles, and for anything else that needs regular care (air-con, hot water, pool).
 */
export function ServiceCard({
  fixtureId,
  itemName,
  odometer,
  plans,
  records,
  contacts,
  inbox,
  canEdit,
}: {
  fixtureId: string
  itemName: string
  odometer: number | null
  plans: PlanRow[]
  records: RecordRow[]
  contacts: ContactLite[]
  inbox: InboxDoc[]
  canEdit: boolean
}) {
  const [plan, setPlan] = useState<PlanRow | "new" | null>(null)
  const [record, setRecord] = useState<RecordRow | NewRecord | null>(null)
  const [booking, setBooking] = useState(false)
  const [deleting, setDeleting] = useState<RecordRow | null>(null)
  const [, start] = useTransition()
  const planName = (id: string) => plans.find((p) => p.id === id)?.name

  return (
    <div className="flex flex-col gap-5">
      {/* Routines */}
      <div className="flex flex-col gap-1">
        <h3 className="text-[15px] font-bold">Routines</h3>
        {plans.length ? (
          <ul className="flex flex-col">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                <span className="flex size-10 flex-none items-center justify-center rounded-full bg-t2">
                  <Wrench className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[15px] font-bold">{p.name}</span>
                  <span className="text-xs font-medium text-muted-foreground">{p.interval}</span>
                  <span className={cn("self-start rounded-full px-2 py-0.5 text-xs font-semibold", DUE_TONE[p.due.tone])}>{p.due.text}</span>
                  {p.booked && !p.booked.past ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold">
                      <CalendarCheck className="size-3.5 flex-none" />
                      Booked {fmtDate(new Date(`${p.booked.date}T00:00:00Z`))}
                      {p.booked.with ? <span className="font-medium text-muted-foreground">· {p.booked.with}</span> : null}
                    </span>
                  ) : null}
                  {p.firm ? (
                    <span className="text-xs font-medium">
                      <span className="font-semibold">Next service:</span> <span className="text-muted-foreground">{p.firm}</span>
                    </span>
                  ) : null}
                  {p.estimate ? (
                    <span className="text-xs font-medium">
                      <span className="font-semibold">Estimated:</span> <span className="text-muted-foreground">{p.estimate}</span>
                    </span>
                  ) : null}
                  {p.booked?.past && canEdit ? (
                    <span className="mt-1 flex flex-wrap gap-2">
                      <Button size="xs" onClick={() => setRecord({ new: true, date: p.booked!.date, planIds: [p.id] })}>
                        <Check />
                        Yes, Log It
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() =>
                          start(async () => {
                            const r = await cancelBooking(p.id)
                            if (!r.ok) toast.error(r.error)
                            else toast("Booking cancelled")
                          })
                        }
                      >
                        <CalendarX />
                        It Didn&apos;t Happen
                      </Button>
                    </span>
                  ) : null}
                </span>
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Options for ${p.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onSelect={() => setPlan(p)}>
                        <Pencil />
                        Edit Routine
                      </DropdownMenuItem>
                      {p.booked ? (
                        <DropdownMenuItem
                          onSelect={() =>
                            start(async () => {
                              const r = await cancelBooking(p.id)
                              if (!r.ok) toast.error(r.error)
                              else toast("Booking cancelled")
                            })
                          }
                        >
                          <CalendarX />
                          Cancel Booking
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          start(async () => {
                            const r = await archivePlan(p.id)
                            if (!r.ok) toast.error(r.error)
                            else toast(`${p.name} archived`)
                          })
                        }
                      >
                        <Archive />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-1 text-sm text-muted-foreground">No routines yet. Add one to see when the next service is due.</p>
        )}
      </div>

      {/* Log */}
      <div className="flex flex-col gap-1">
        <h3 className="flex items-center gap-2 text-[15px] font-bold">
          Service Log
          {odometer != null ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Gauge className="size-3.5" />
              {formatKm(odometer)}
            </span>
          ) : null}
        </h3>
        {records.length ? (
          <ul className="flex flex-col">
            {records.map((r) => (
              <li key={r.id} className="flex items-start gap-3 border-t border-line py-3 first:border-t-0">
                <span className="flex w-12 flex-none flex-col items-center rounded-xl bg-surface2 py-1.5 text-center leading-tight">
                  <span className="text-[15px] font-bold tabular-nums">{new Date(`${r.date}T00:00:00Z`).getUTCDate()}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    {new Date(`${r.date}T00:00:00Z`).toLocaleDateString("en-AU", { month: "short", year: "2-digit", timeZone: "UTC" })}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[15px] font-bold">{r.title}</span>
                  <span className="text-xs font-medium text-muted-foreground">
                    {[r.odometer != null ? formatKm(r.odometer) : null, r.who ?? r.vendor].filter(Boolean).join(" · ") || fmtDate(new Date(`${r.date}T00:00:00Z`))}
                  </span>
                  {r.planIds.length || r.receipts.length ? (
                    <span className="flex flex-wrap gap-1.5 text-xs font-semibold">
                      {r.planIds.map((id) => (planName(id) ? <span key={id} className="rounded-full bg-t2 px-2 py-0.5">{planName(id)}</span> : null))}
                      {r.receipts.length ? (
                        <span className="flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5">
                          <Paperclip className="size-3" />
                          {r.receipts.length}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </span>
                {r.amount ? <span className="text-[15px] font-bold tabular-nums">{money(r.amount, true)}</span> : null}
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Options for ${r.title}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onSelect={() => setRecord(r)}>
                        <Pencil />
                        Edit Service
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(r)}>
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-1 text-sm text-muted-foreground">Nothing logged yet.</p>
        )}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Wrench />
                Serviced
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuItem onSelect={() => setRecord({ new: true, date: today(), planIds: [] })}>
                <Check />
                <span className="flex flex-col">
                  Serviced Today
                  <span className="text-xs text-muted-foreground">Log it with today&apos;s date</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRecord({ new: true, date: null, planIds: [] })}>
                <History />
                <span className="flex flex-col">
                  Serviced Earlier
                  <span className="text-xs text-muted-foreground">Log a past service, on its date</span>
                </span>
              </DropdownMenuItem>
              {plans.length ? (
                <DropdownMenuItem onSelect={() => setBooking(true)}>
                  <CalendarClock />
                  <span className="flex flex-col">
                    Book a Service
                    <span className="text-xs text-muted-foreground">One coming up that&apos;s booked in</span>
                  </span>
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" onClick={() => setPlan("new")}>
            <Wrench />
            Add Routine
          </Button>
        </div>
      ) : null}

      <PlanDrawer fixtureId={fixtureId} plan={plan} onClose={() => setPlan(null)} />
      <BookDrawer fixtureId={fixtureId} itemName={itemName} plans={plans} open={booking} onClose={() => setBooking(false)} />
      <RecordDrawer
        fixtureId={fixtureId}
        itemName={itemName}
        odometer={odometer}
        record={record}
        plans={plans}
        contacts={contacts}
        inbox={inbox}
        onClose={() => setRecord(null)}
      />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>It&apos;s removed from the service log and its cost from the totals. Any receipt stays in Documents.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive-solid"
              onClick={() =>
                deleting &&
                start(async () => {
                  const r = await deleteRecord(deleting.id)
                  if (!r.ok) toast.error(r.error)
                  else toast("Service deleted")
                  setDeleting(null)
                })
              }
            >
              <Trash2 />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function PlanDrawer({ fixtureId, plan, onClose }: { fixtureId: string; plan: PlanRow | "new" | null; onClose: () => void }) {
  const blank: PlanInput = { name: "", everyMonths: "", everyKm: "", notes: "" }
  const [v, setV] = useState<PlanInput>(blank)
  const [shown, setShown] = useState<typeof plan>(null)
  if (plan !== shown) {
    setShown(plan)
    if (plan === "new") setV(blank)
    else if (plan) setV({ name: plan.name, everyMonths: plan.everyMonths ? String(plan.everyMonths) : "", everyKm: plan.everyKm ? String(plan.everyKm) : "", notes: plan.notes ?? "" })
  }
  const [pending, start] = useTransition()
  const set = (k: keyof PlanInput, val: string) => setV((p) => ({ ...p, [k]: val }))
  const editing = plan && plan !== "new"
  return (
    <Drawer
      open={!!plan}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Edit Routine" : "Add Routine"}
      description="How often it needs doing: by time, by distance, or both (whichever comes first)."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || !v.name.trim()}
            onClick={() =>
              start(async () => {
                const r = await savePlan(fixtureId, editing ? plan.id : null, v)
                if (!r.ok) return void toast.error(r.error)
                toast(editing ? "Saved" : "Routine added")
                onClose()
              })
            }
          >
            {editing ? "Save" : "Add Routine"}
          </Button>
        </>
      }
    >
      <FieldLabel label="Name">
        <Input value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="Logbook service" autoFocus />
      </FieldLabel>
      <div className="flex flex-wrap gap-2">
        {["Logbook service", "Oil change", "Tyre rotation", "Air filter", "Annual service"].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => set("name", n)}
            className="min-h-9 cursor-pointer rounded-full border border-outline bg-surface px-3 text-xs font-semibold hover:bg-surface2"
          >
            {n}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Every (Months)">
          <Input value={v.everyMonths} onChange={(e) => set("everyMonths", e.target.value)} inputMode="numeric" placeholder="12" />
        </FieldLabel>
        <FieldLabel label="Every (Km)">
          <Input value={v.everyKm} onChange={(e) => set("everyKm", e.target.value)} inputMode="numeric" placeholder="15000" />
        </FieldLabel>
      </div>
      <FieldLabel label="Notes (optional)">
        <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Oil grade, parts numbers, what the logbook asks for" />
      </FieldLabel>
    </Drawer>
  )
}

function RecordDrawer({
  fixtureId,
  itemName,
  odometer,
  record,
  plans,
  contacts,
  inbox,
  onClose,
}: {
  fixtureId: string
  itemName: string
  odometer: number | null
  record: RecordRow | NewRecord | null
  plans: PlanRow[]
  contacts: ContactLite[]
  inbox: InboxDoc[]
  onClose: () => void
}) {
  const router = useRouter()
  const blank = (): RecordInput => ({ date: today(), odometer: odometer != null ? String(odometer) : "", title: "", notes: "", planIds: [], contactId: null, vendor: "", amount: "", gst: "" })
  const [v, setV] = useState<RecordInput>(blank)
  const [incGst, setIncGst] = useState(true)
  const [files, setFiles] = useState<File[]>([])
  const [fromInbox, setFromInbox] = useState<string[]>([])
  const [showInbox, setShowInbox] = useState(false)
  const [shown, setShown] = useState<typeof record>(null)
  if (record !== shown) {
    setShown(record)
    setFiles([])
    setFromInbox([])
    setShowInbox(false)
    if (record && "new" in record) {
      const first = plans.find((p) => p.id === record.planIds[0])
      setV({ ...blank(), date: record.date, planIds: record.planIds, title: first?.name ?? "" })
      setIncGst(true)
    } else if (record) {
      setV({
        date: record.date,
        odometer: record.odometer != null ? String(record.odometer) : "",
        title: record.title,
        notes: record.notes ?? "",
        planIds: record.planIds,
        contactId: record.contactId,
        vendor: record.vendor ?? "",
        amount: record.amount ?? "",
        gst: record.gst ?? "",
      })
      setIncGst(!record.amount || !!record.gst)
    }
  }
  const [pending, start] = useTransition()
  const camera = useRef<HTMLInputElement>(null)
  const picker = useRef<HTMLInputElement>(null)
  const set = <K extends keyof RecordInput>(k: K, val: RecordInput[K]) => setV((p) => ({ ...p, [k]: val }))
  const setAmount = (a: string) => setV((p) => ({ ...p, amount: a, gst: incGst ? gstOf(a.replace(/[$,\s]/g, "")) : p.gst }))
  const togglePlan = (id: string) => {
    const on = v.planIds.includes(id)
    const ids = on ? v.planIds.filter((x) => x !== id) : [...v.planIds, id]
    // the first routine picked also names the service, if it has no name yet
    setV((p) => ({ ...p, planIds: ids, title: !on && !p.title.trim() ? (plans.find((x) => x.id === id)?.name ?? p.title) : p.title }))
  }
  const editing = record && !("new" in record) ? record : null
  const hasCost = !!v.amount.trim()

  const save = () =>
    start(async () => {
      const r = await saveRecord(fixtureId, editing ? editing.id : null, v)
      if (!r.ok) return void toast.error(r.error)
      // receipts go on the cost
      if (r.expenseId && (files.length || fromInbox.length)) {
        if (files.length) {
          const fd = new FormData()
          files.forEach((f) => fd.append("files", f))
          fd.append("expenseId", r.expenseId)
          const up = await fetch("/api/documents", { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({ error: "The receipt couldn't be uploaded." }))
          if (up.error) toast.error(up.error)
        }
        for (const id of fromInbox) {
          const f = await fileTo(id, { type: "expense", id: r.expenseId }, null)
          if (!f.ok) toast.error(f.error)
        }
      }
      toast(editing ? "Saved" : "Service logged")
      onClose()
      router.refresh()
    })

  return (
    <Drawer
      open={!!record}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? "Edit Service" : "Log Service"}
      description={editing ? undefined : `A service done to ${itemName}.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || !v.title.trim()} onClick={save}>
            {editing ? "Save" : "Log Service"}
          </Button>
        </>
      }
    >
      {plans.length ? (
        <div role="group" aria-label="Routines covered" className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-muted-foreground">Routines Covered</span>
          <div className="flex flex-wrap gap-2">
            {plans.map((p) => {
              const on = v.planIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => togglePlan(p.id)}
                  className={cn(
                    "flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold",
                    on ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2"
                  )}
                >
                  {on ? <Check className="size-4" /> : null}
                  {p.name}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      <FieldLabel label="What Was Done">
        <Input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="12-month logbook service" />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Date">
          <Input type="date" value={v.date ?? ""} onChange={(e) => set("date", e.target.value || null)} />
        </FieldLabel>
        <FieldLabel label="Odometer (km)">
          <Input value={v.odometer} onChange={(e) => set("odometer", e.target.value)} inputMode="numeric" placeholder="Optional" />
        </FieldLabel>
      </div>

      <Section title="Who and Cost" />
      <ContactPicker contacts={contacts} value={v.contactId} onChange={(id) => set("contactId", id)} label="Done By (a tradesperson or mechanic)" />
      <FieldLabel label="Or a Business">
        <Input value={v.vendor} onChange={(e) => set("vendor", e.target.value)} placeholder="Ultra Tune" />
      </FieldLabel>
      <FieldLabel label="Cost (optional)" hint="Counts as a repair in the yearly totals.">
        <Input value={v.amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="$" />
      </FieldLabel>
      {hasCost ? (
        <label className="-mt-1 flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
          <input
            type="checkbox"
            checked={incGst}
            onChange={(e) => {
              setIncGst(e.target.checked)
              set("gst", e.target.checked ? gstOf(v.amount.replace(/[$,\s]/g, "")) : "")
            }}
            className="size-5 accent-[var(--sel)]"
          />
          Includes GST
          {incGst ? <span className="font-medium text-muted-foreground">(${v.gst || "0.00"})</span> : null}
        </label>
      ) : null}

      {hasCost ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-muted-foreground">Receipt</span>
          {editing && editing.receipts.length ? (
            <div className="flex flex-col">
              {editing.receipts.map((x) => (
                <DocumentRow key={x.linkId} doc={x.doc} />
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
                  </button>
                )
              })}
            </div>
          ) : null}
          <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files && setFiles([...files, ...e.target.files])} />
          <input ref={picker} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => e.target.files && setFiles([...files, ...e.target.files])} />
        </div>
      ) : null}

      <FieldLabel label="Notes (optional)">
        <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Parts replaced, things to watch" />
      </FieldLabel>
    </Drawer>
  )
}

/** Book a service: the day it's booked in for and where. It shows as the next date until it's logged. */
function BookDrawer({ fixtureId, itemName, plans, open, onClose }: { fixtureId: string; itemName: string; plans: PlanRow[]; open: boolean; onClose: () => void }) {
  const [date, setDate] = useState("")
  const [withWho, setWithWho] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDate("")
      setWithWho("")
      // the first routine with an interval (what a logbook service covers); more can be ticked
      setPicked(plans.filter((p) => p.everyMonths || p.everyKm).map((p) => p.id).slice(0, 1))
    }
  }
  const [pending, start] = useTransition()
  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Book a Service"
      description={`A service for ${itemName} that's booked in. It shows as the next service, and on your calendar, until you log it.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || !date || !picked.length}
            onClick={() =>
              start(async () => {
                const r = await bookService(fixtureId, picked, date, withWho)
                if (!r.ok) return void toast.error(r.error)
                toast("Service booked")
                onClose()
              })
            }
          >
            <CalendarCheck />
            Book
          </Button>
        </>
      }
    >
      <div role="group" aria-label="Routines" className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted-foreground">For</span>
        <div className="flex flex-wrap gap-2">
          {plans.map((p) => {
            const on = picked.includes(p.id)
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(on ? picked.filter((x) => x !== p.id) : [...picked, p.id])}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold",
                  on ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2"
                )}
              >
                {on ? <Check className="size-4" /> : null}
                {p.name}
              </button>
            )
          })}
        </div>
      </div>
      <FieldLabel label="Booked For">
        <Input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} className="w-48" />
      </FieldLabel>
      <FieldLabel label="Where or Who (optional)">
        <Input value={withWho} onChange={(e) => setWithWho(e.target.value)} placeholder="Ultra Tune Hornsby" />
      </FieldLabel>
    </Drawer>
  )
}
