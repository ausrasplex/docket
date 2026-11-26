"use client"

import { useState, useTransition } from "react"
import { ArrowLeftRight, HandHelping, MapPin, MoreHorizontal, Trash2, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Drawer, FieldLabel } from "@/components/drawer"
import { useIntent } from "@/components/shell/intent"
import { DUE_TONE, type DueTone } from "@/lib/service"
import { addMove, deleteMove, type MoveInput } from "../move-actions"

export type MoveRow = { id: string; kind: "MOVED" | "LENT" | "RETURNED"; date: string; place: string | null; person: string | null; dueBack: string | null; notes: string | null }
export type MoveStatus = { location: string | null; lentTo: string | null; lentSince: string | null; due: { tone: DueTone; text: string } | null }

type Mode = "MOVED" | "LENT" | "RETURNED"
const today = () => new Date().toISOString().slice(0, 10)
const blank = (kind: Mode): MoveInput => ({ kind, date: today(), place: "", person: "", dueBack: null, notes: "" })

const LINE = {
  MOVED: (m: MoveRow) => (m.place ? `Moved to ${m.place}` : "Back in its usual place"),
  LENT: (m: MoveRow) => `Lent to ${m.person}${m.dueBack ? `, due back ${m.dueBack}` : ""}`,
  RETURNED: (m: MoveRow) => `Given back${m.person ? ` by ${m.person}` : ""}`,
}
const ICON = { MOVED: MapPin, LENT: HandHelping, RETURNED: Undo2 }

/**
 * Moves and Loans: where a portable thing is now, who has it, and its history. Moving it somewhere or
 * lending it out is logged; the place and loan shown at the top follow from the latest entries.
 */
export function MovesCard({
  fixtureId,
  name,
  canEdit,
  status,
  log,
  places,
}: {
  fixtureId: string
  name: string
  canEdit: boolean
  status: MoveStatus
  log: MoveRow[]
  /** suggestions for where it went: the rooms and places it's been before */
  places: string[]
}) {
  const lendIntent = useIntent("lend")
  const [mode, setMode] = useState<Mode | null>(lendIntent.hit && canEdit && !status.lentTo ? "LENT" : null)
  const [v, setV] = useState<MoveInput>(blank(mode ?? "MOVED"))
  const [pending, start] = useTransition()
  const set = <K extends keyof MoveInput>(k: K, val: MoveInput[K]) => setV((p) => ({ ...p, [k]: val }))

  const open = (m: Mode) => {
    setV(blank(m))
    setMode(m)
  }
  const close = () => {
    setMode(null)
    lendIntent.clear()
  }
  const save = () =>
    start(async () => {
      const r = await addMove(fixtureId, v)
      if (!r.ok) return void toast.error(r.error)
      toast(v.kind === "LENT" ? `Lent to ${v.person.trim()}` : v.kind === "RETURNED" ? "Given back" : "Moved")
      close()
    })
  const remove = (id: string) =>
    start(async () => {
      const r = await deleteMove(id)
      if (!r.ok) toast.error(r.error)
    })

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-2xl bg-surface2 px-4 py-3">
        <span className="flex items-center gap-2 text-sm">
          <MapPin className="size-4 flex-none text-muted-foreground" />
          {status.location ? (
            <span>
              At <b>{status.location}</b>
            </span>
          ) : (
            <span className="text-muted-foreground">In its usual place</span>
          )}
        </span>
        {status.lentTo ? (
          <span className="flex flex-wrap items-center gap-2 text-sm">
            <HandHelping className="size-4 flex-none text-muted-foreground" />
            <span>
              Lent to <b>{status.lentTo}</b>
              {status.lentSince ? <span className="text-muted-foreground"> since {status.lentSince}</span> : null}
            </span>
            {status.due && status.due.tone !== "ok" ? <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", DUE_TONE[status.due.tone])}>{status.due.text}</span> : null}
          </span>
        ) : null}
      </div>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => open("MOVED")}>
            <ArrowLeftRight />
            Moved It
          </Button>
          {status.lentTo ? (
            <Button variant="outline" onClick={() => open("RETURNED")}>
              <Undo2 />
              Given Back
            </Button>
          ) : (
            <Button variant="outline" onClick={() => open("LENT")}>
              <HandHelping />
              Lend Out
            </Button>
          )}
        </div>
      ) : null}

      {log.length ? (
        <ul className="flex flex-col">
          {log.map((m) => {
            const Icon = ICON[m.kind]
            return (
              <li key={m.id} className="flex items-start gap-3 border-t border-line py-2.5 first:border-t-0">
                <Icon className="mt-0.5 size-4 flex-none text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold">{LINE[m.kind](m)}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.date}
                    {m.notes ? ` · ${m.notes}` : ""}
                  </span>
                </span>
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Entry options">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem variant="destructive" disabled={pending} onSelect={() => remove(m.id)}>
                        <Trash2 />
                        Delete Entry
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      <Drawer
        open={!!mode}
        onOpenChange={(o) => !o && !pending && close()}
        title={mode === "LENT" ? `Lend Out ${name}` : mode === "RETURNED" ? `${name} Given Back` : `Move ${name}`}
        description={
          mode === "LENT"
            ? "Who has it, and when you'd like it back. It shows in Coming Up as the date gets close."
            : mode === "RETURNED"
              ? `${status.lentTo ?? "They"} gave it back.`
              : "Where it is now. Leave the place blank when it's back where it usually lives."
        }
        footer={
          <>
            <Button variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button disabled={pending || (mode === "LENT" && !v.person.trim())} onClick={save}>
              Save
            </Button>
          </>
        }
      >
        {mode === "MOVED" ? (
          <FieldLabel label="Where To">
            <Input value={v.place} onChange={(e) => set("place", e.target.value)} placeholder="Caravan, Mum's house, Garage" list="move-places" autoFocus />
          </FieldLabel>
        ) : null}
        <datalist id="move-places">
          {places.map((p) => (
            <option key={p} value={p} />
          ))}
        </datalist>
        {mode === "LENT" ? (
          <FieldLabel label="Lent To">
            <Input value={v.person} onChange={(e) => set("person", e.target.value)} placeholder="Sam next door" autoFocus />
          </FieldLabel>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <FieldLabel label={mode === "LENT" ? "Lent On" : mode === "RETURNED" ? "Given Back On" : "Moved On"}>
            <Input type="date" value={v.date} max={today()} onChange={(e) => set("date", e.target.value)} />
          </FieldLabel>
          {mode === "LENT" ? (
            <FieldLabel label="Due Back (optional)">
              <Input type="date" value={v.dueBack ?? ""} min={v.date} onChange={(e) => set("dueBack", e.target.value || null)} />
            </FieldLabel>
          ) : null}
        </div>
        <FieldLabel label="Notes (optional)">
          <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder={mode === "LENT" ? "With the charger and two batteries" : undefined} />
        </FieldLabel>
      </Drawer>
    </div>
  )
}
