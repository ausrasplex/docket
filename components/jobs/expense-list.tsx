"use client"

import { useState, useTransition } from "react"
import { Archive, MoreHorizontal, Paperclip, Pencil } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { DocLike } from "@/components/documents/document-row"
import type { InboxDoc } from "@/components/documents/doc-groups"
import { expenseClass } from "@/lib/jobs"
import { date, money } from "@/lib/format"
import { setExpenseArchived, type ExpenseInput } from "@/app/(app)/jobs/actions"
import { ExpenseDrawer } from "./expense-drawer"
import type { ContactLite } from "./contact-picker"

export type ExpenseRowData = {
  id: string
  input: ExpenseInput
  payee: string | null
  job: { id: string; title: string } | null
  receipts: { linkId: string; doc: DocLike }[]
}

const CLASS_TONE = { CAPITAL_IMPROVEMENT: "bg-t1", REPAIR_MAINTENANCE: "bg-t2", FURNISHING: "bg-t3", OTHER: "bg-surface2" } as const

/** Costs as rows: date, what for, who, tax treatment, receipt count and amount. Tap to edit. */
export function ExpenseList({
  rows,
  jobs,
  contacts,
  inbox,
  canEdit,
  showJob = true,
  lockJob = false,
}: {
  rows: ExpenseRowData[]
  jobs: { id: string; title: string }[]
  contacts: ContactLite[]
  inbox: InboxDoc[]
  canEdit: boolean
  showJob?: boolean
  lockJob?: boolean
}) {
  const [editId, setEditId] = useState<string | null>(null)
  const [, start] = useTransition()
  const editing = rows.find((r) => r.id === editId) ?? null
  if (!rows.length) return null
  return (
    <>
      <ul className="flex flex-col">
        {rows.map((r) => {
          const i = r.input
          const cls = expenseClass(i.classification)
          return (
            <li key={r.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => setEditId(r.id)}
                className="lift group flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left disabled:cursor-default"
              >
                <span className="flex w-12 flex-none flex-col items-center rounded-xl bg-surface2 py-1.5 text-center leading-tight">
                  <span className="text-[15px] font-bold tabular-nums">{new Date(`${i.date}T00:00:00Z`).getUTCDate()}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase">
                    {new Date(`${i.date}T00:00:00Z`).toLocaleDateString("en-AU", { month: "short", timeZone: "UTC" })}
                  </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-bold">{i.description || r.payee || "Cost"}</span>
                  <span className="truncate text-xs font-medium text-muted-foreground">
                    {[i.description ? r.payee : null, showJob ? r.job?.title : null, date(new Date(`${i.date}T00:00:00Z`))].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1.5 text-xs font-semibold">
                    <span className={cn("rounded-full px-2 py-0.5", CLASS_TONE[i.classification])}>{cls.label}</span>
                    {r.receipts.length ? (
                      <span className="flex items-center gap-1 rounded-full bg-surface2 px-2 py-0.5">
                        <Paperclip className="size-3" />
                        {r.receipts.length}
                      </span>
                    ) : (
                      <span className="rounded-full bg-danger-soft px-2 py-0.5 text-danger">No receipt</span>
                    )}
                  </span>
                </span>
                <span className="flex flex-none flex-col items-end">
                  <span className="text-[15px] font-bold tabular-nums">{money(i.amount, true)}</span>
                  {i.gst ? <span className="text-xs text-muted-foreground tabular-nums">GST {money(i.gst, true)}</span> : null}
                </span>
              </button>
              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={`Options for ${i.description || r.payee || "cost"}`}>
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onSelect={() => setEditId(r.id)}>
                      <Pencil />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() =>
                        start(async () => {
                          const res = await setExpenseArchived(r.id, true)
                          if (!res.ok) toast.error(res.error)
                          else toast("Archived")
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
          )
        })}
      </ul>
      <ExpenseDrawer
        open={!!editing}
        onOpenChange={(o) => !o && setEditId(null)}
        initial={editing?.input ?? rows[0].input}
        editing={editing ? { id: editing.id, receipts: editing.receipts } : null}
        jobs={jobs}
        contacts={contacts}
        inbox={inbox}
        lockJob={lockJob}
      />
    </>
  )
}
