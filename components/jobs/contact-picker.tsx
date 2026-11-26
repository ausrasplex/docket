"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SelectItem, SelectSeparator } from "@/components/ui/select"
import { Dropdown, NONE, WordDropdown } from "@/components/dropdown"
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
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Dropdown label={label} value={value ?? NONE} onChange={(id) => onChange(id === NONE ? null : id)}>
            <SelectItem value={NONE}>None</SelectItem>
            {all.length ? <SelectSeparator /> : null}
            {all.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
                {c.trade ? <span className="font-medium text-muted-foreground">· {c.trade}</span> : null}
              </SelectItem>
            ))}
          </Dropdown>
        </div>
        {!adding ? (
          <Button type="button" variant="outline" className="h-12" onClick={() => setAdding(true)}>
            <Plus />
            New
          </Button>
        ) : null}
      </div>
      {adding ? (
        <div className="flex flex-col gap-2.5 rounded-2xl bg-surface2 p-3">
          <Input aria-label="Their name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or business" autoFocus className="bg-surface" />
          <WordDropdown label="Trade" value={trade} onChange={setTrade} options={TRADES} />
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
