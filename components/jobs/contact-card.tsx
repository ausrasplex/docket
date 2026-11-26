"use client"

import { useState, useTransition } from "react"
import { Globe, Mail, Pencil, Phone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, FieldLabel } from "@/components/drawer"
import { WordDropdown } from "@/components/dropdown"
import { Initials } from "@/components/shell/initials"
import { TRADES } from "@/lib/jobs"
import { saveContact, type ContactInput } from "@/app/(app)/jobs/actions"

export type ContactFull = ContactInput & { id: string; jobs: number }

/** A tradesperson as a row, with call/email buttons and an Edit drawer for the full details. */
export function ContactRow({ c, canEdit }: { c: ContactFull; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
      <Initials name={c.name} size={40} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{c.name}</span>
        <span className="truncate text-xs font-medium text-muted-foreground">
          {[c.trade, c.business, c.licence ? `Lic. ${c.licence}` : null, c.jobs ? `${c.jobs} job${c.jobs === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ") || "No details yet"}
        </span>
      </span>
      {c.phone ? (
        <a href={`tel:${c.phone.replace(/\s/g, "")}`} aria-label={`Call ${c.name}`} className="flex size-10 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Phone className="size-[18px]" />
        </a>
      ) : null}
      {c.email ? (
        <a href={`mailto:${c.email}`} aria-label={`Email ${c.name}`} className="flex size-10 flex-none items-center justify-center rounded-full border border-outline hover:bg-surface2">
          <Mail className="size-[18px]" />
        </a>
      ) : null}
      {c.website ? (
        <a href={c.website} target="_blank" rel="noopener noreferrer" aria-label={`${c.name}'s website`} className="flex size-10 flex-none items-center justify-center rounded-full border border-outline hover:bg-surface2">
          <Globe className="size-[18px]" />
        </a>
      ) : null}
      {canEdit ? (
        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.name}`} onClick={() => setOpen(true)}>
          <Pencil />
        </Button>
      ) : null}
      {canEdit ? <ContactDrawer open={open} onOpenChange={setOpen} contact={c} /> : null}
    </li>
  )
}

function ContactDrawer({ open, onOpenChange, contact }: { open: boolean; onOpenChange: (o: boolean) => void; contact: ContactFull }) {
  const init = (): ContactInput => ({
    name: contact.name,
    business: contact.business,
    trade: contact.trade,
    phone: contact.phone,
    email: contact.email,
    website: contact.website,
    abn: contact.abn,
    licence: contact.licence,
    notes: contact.notes,
  })
  const [v, setV] = useState(init)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setV(init())
  }
  const [pending, start] = useTransition()
  const set = (k: keyof ContactInput, val: string) => setV((p) => ({ ...p, [k]: val }))
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${contact.name}`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || !v.name.trim()}
            onClick={() =>
              start(async () => {
                const r = await saveContact(contact.id, v)
                if (!r.ok) return void toast.error(r.error)
                toast("Saved")
                onOpenChange(false)
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <FieldLabel label="Name">
        <Input value={v.name} onChange={(e) => set("name", e.target.value)} />
      </FieldLabel>
      <FieldLabel label="Business">
        <Input value={v.business} onChange={(e) => set("business", e.target.value)} />
      </FieldLabel>
      <WordDropdown label="Trade" value={v.trade} onChange={(t) => set("trade", t)} options={TRADES} />
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Phone">
          <Input value={v.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" />
        </FieldLabel>
        <FieldLabel label="Email">
          <Input value={v.email} onChange={(e) => set("email", e.target.value)} inputMode="email" />
        </FieldLabel>
      </div>
      <FieldLabel label="Website">
        <Input value={v.website} onChange={(e) => set("website", e.target.value)} inputMode="url" />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="ABN">
          <Input value={v.abn} onChange={(e) => set("abn", e.target.value)} inputMode="numeric" />
        </FieldLabel>
        <FieldLabel label="Licence Number">
          <Input value={v.licence} onChange={(e) => set("licence", e.target.value)} />
        </FieldLabel>
      </div>
      <FieldLabel label="Notes (optional)">
        <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} />
      </FieldLabel>
    </Drawer>
  )
}
