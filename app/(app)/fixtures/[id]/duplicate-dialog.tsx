"use client"

import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { duplicateFixture } from "../duplicate-actions"

type Room = { id: string; name: string }
type Part = { id: string; name: string }
type Serials = { serial: string; parts: Record<string, string> }

/**
 * Duplicate: pick the rooms the same item is also in (the same air conditioner in three bedrooms) and type
 * each copy's serial numbers. Everything else is copied; manuals and links are shared with the original.
 */
export function DuplicateDialog({
  open,
  onOpenChange,
  id,
  name,
  roomId,
  rooms,
  parts,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  id: string
  name: string
  roomId: string | null
  rooms: Room[]
  parts: Part[]
}) {
  const router = useRouter()
  const [picked, setPicked] = useState<Record<string, Serials>>({})
  const [pending, start] = useTransition()
  const chosen = rooms.filter((r) => picked[r.id])
  const n = chosen.length

  const close = (o: boolean) => {
    if (pending) return
    onOpenChange(o)
    if (!o) setPicked({})
  }
  const toggle = (r: Room) =>
    setPicked(({ [r.id]: had, ...rest }) => (had ? rest : { ...rest, [r.id]: { serial: "", parts: {} } }))
  const setSerial = (roomId: string, partId: string | null, v: string) =>
    setPicked((p) => {
      const s = p[roomId]
      return { ...p, [roomId]: partId ? { ...s, parts: { ...s.parts, [partId]: v } } : { ...s, serial: v } }
    })

  const submit = () =>
    start(async () => {
      const r = await duplicateFixture(
        id,
        chosen.map((room) => ({ spaceId: room.id, serial: picked[room.id].serial, partSerials: picked[room.id].parts })),
      )
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      const names = chosen.map((x) => x.name)
      const where = names.length <= 3 ? names.join(", ").replace(/, ([^,]*)$/, " and $1") : `${names.length} rooms`
      toast(`${name} copied to ${where}`, r.ids.length === 1 ? { action: { label: "Open", onClick: () => router.push(`/fixtures/${r.ids[0]}`) } } : undefined)
      onOpenChange(false)
      setPicked({})
    })

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[min(720px,calc(100dvh-2rem))] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="gap-1 px-6 pt-6 pb-3 pr-14">
          <DialogTitle className="text-lg font-bold">Duplicate Item</DialogTitle>
          <DialogDescription className="text-[13px] text-muted-foreground">
            Where else is this {name}? Each copy gets its own serial numbers; the details, photo, manuals, links and service routines are copied.
          </DialogDescription>
        </DialogHeader>
        <div role="group" aria-label="Rooms" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-6 pt-1 pb-5">
          {rooms.length ? null : <p className="text-sm text-muted-foreground">Add a room first, then copy items into it.</p>}
          {rooms.map((r) => (
            <RoomRow
              key={r.id}
              room={r}
              here={r.id === roomId}
              value={picked[r.id]}
              parts={parts}
              onToggle={() => toggle(r)}
              onSerial={(partId, v) => setSerial(r.id, partId, v)}
            />
          ))}
        </div>
        <DialogFooter className="mx-0 mb-0 flex-row gap-2.5 [&>*]:flex-1 sm:[&>*]:flex-none">
          <Button variant="outline" onClick={() => close(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!n || pending}>
            {pending ? "Copying…" : n > 1 ? `Make ${n} Copies` : "Make Copy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RoomRow({
  room,
  here,
  value,
  parts,
  onToggle,
  onSerial,
}: {
  room: Room
  here: boolean
  value: Serials | undefined
  parts: Part[]
  onToggle: () => void
  onSerial: (partId: string | null, v: string) => void
}) {
  const on = !!value
  const detail = useId()
  return (
    <div className={cn("rounded-xl border-2 bg-surface2", on ? "border-sel" : "border-transparent")}>
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-label={room.name}
        aria-describedby={here ? detail : undefined}
        onClick={onToggle}
        className="flex min-h-13 w-full cursor-pointer items-center gap-3 rounded-[10px] px-3.5 py-2 text-left hover:bg-t1"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-5 flex-none items-center justify-center rounded-[5px] border-2",
            on ? "border-primary bg-primary text-primary-foreground" : "border-outline bg-surface",
          )}
        >
          {on ? <Check className="size-3.5" strokeWidth={3} /> : null}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-sm font-bold">{room.name}</b>
          {here ? (
            <span id={detail} className="text-xs font-medium text-muted-foreground">
              Where this one is (adds another here)
            </span>
          ) : null}
        </span>
      </button>
      {value ? (
        <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
          <SerialField label="Serial" aria={`Serial for ${room.name}`} value={value.serial} onChange={(v) => onSerial(null, v)} autoFocus />
          {parts.map((p) => (
            <SerialField
              key={p.id}
              label={`${p.name} Serial`}
              aria={`${p.name} serial for ${room.name}`}
              value={value.parts[p.id] ?? ""}
              onChange={(v) => onSerial(p.id, v)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function SerialField({
  label,
  aria,
  value,
  onChange,
  autoFocus,
}: {
  label: string
  aria: string
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} aria-label={aria} placeholder="Optional" autoComplete="off" autoFocus={autoFocus} className="bg-surface" />
    </label>
  )
}
