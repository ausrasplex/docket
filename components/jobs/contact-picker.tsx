"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Chip, Chips } from "@/components/form-bits"
import { TRADES } from "@/lib/jobs"
import { saveContact } from "@/app/(app)/jobs/actions"

export type ContactLite = { id: string; name: string; business: string | null; trade: string | null; phone: string | null }

export const BLANK_CONTACT = { name: "", business: "", trade: "", phone: "", email: "", website: "", abn: "", licence: "", notes: "" }

/** Pick a tradesperson, or add a new one inline (name, trade, phone) without leaving the form. */
export function ContactPicker({
  contacts,
  value,
  onChange,
  label = "Tradesperson",
}: {
  contacts: ContactLite[]
  value: string | null
  onChange: (id: string | null) => void
  label?: string
}) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const [trade, setTrade] = useState("")
  const [phone, setPhone] = useState("")
  const [extra, setExtra] = useState<ContactLite[]>([]) // added here, before the page refreshes
  const [pending, start] = useTransition()
  const all = [...contacts, ...extra.filter((e) => !contacts.some((c) => c.id === e.id))]

  const add = () =>
    start(async () => {
      const r = await saveContact(null, { ...BLANK_CONTACT, name, trade, phone })
      if (!r.ok) return void toast.error(r.error)
      setExtra((p) => [...p, { id: r.id, name: name.trim(), business: null, trade: trade || null, phone: phone || null }])
      onChange(r.id)
      setAdding(false)
      setName("")
      setTrade("")
      setPhone("")
    })

  return (
    <div className="flex flex-col gap-2">
      <Chips label={label}>
        <Chip on={!value} onClick={() => onChange(null)}>
          None
        </Chip>
        {all.map((c) => (
          <Chip key={c.id} on={value === c.id} onClick={() => onChange(c.id)}>
            {c.name}
            {c.trade ? <span className="font-medium opacity-70">· {c.trade}</span> : null}
          </Chip>
        ))}
        {!adding ? (
          // an action, not one of the choices, so a plain button rather than a radio chip
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-outline px-3.5 text-[13px] font-semibold hover:bg-surface2"
          >
            <Plus className="size-4" />
            New
          </button>
        ) : null}
      </Chips>
      {adding ? (
        <div className="flex flex-col gap-2.5 rounded-2xl bg-surface2 p-3">
          <Input aria-label="Their name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or business" autoFocus className="bg-surface" />
          <div className="flex flex-wrap gap-1.5">
            {TRADES.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={trade === t}
                onClick={() => setTrade(trade === t ? "" : t)}
                className={
                  "min-h-9 cursor-pointer rounded-full px-3 text-xs font-semibold " +
                  (trade === t ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2")
                }
              >
                {t}
              </button>
            ))}
          </div>
          <Input aria-label="Their phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" inputMode="tel" className="bg-surface" />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" disabled={pending || !name.trim()} onClick={add}>
              Add Tradesperson
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
