"use client"

import { useState, useTransition } from "react"
import { Globe, LifeBuoy, Mail, Pencil, Phone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Drawer, FieldLabel } from "@/components/drawer"
import { updateBrand } from "../actions"

type Brand = {
  id: string
  name: string
  website: string | null
  supportUrl: string | null
  supportPhone: string | null
  supportEmail: string | null
  notes: string | null
}

const host = (u: string) => {
  try {
    const x = new URL(u)
    return (x.hostname + x.pathname).replace(/^www\./, "").replace(/\/$/, "")
  } catch {
    return u
  }
}

/** The maker's contact details, set once and shared by every item of this brand. */
export function BrandCard({ brand, canEdit }: { brand: Brand; canEdit: boolean }) {
  const [open, setOpen] = useState(false)
  const rows = [
    brand.supportUrl && { icon: LifeBuoy, text: host(brand.supportUrl), href: brand.supportUrl, label: "Support" },
    brand.website && { icon: Globe, text: host(brand.website), href: brand.website, label: "Website" },
    brand.supportPhone && { icon: Phone, text: brand.supportPhone, href: `tel:${brand.supportPhone.replace(/\s/g, "")}`, label: "Phone" },
    brand.supportEmail && { icon: Mail, text: brand.supportEmail, href: `mailto:${brand.supportEmail}`, label: "Email" },
  ].filter(Boolean) as { icon: typeof Globe; text: string; href: string; label: string }[]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{brand.name}</CardTitle>
        <CardDescription>Shared by every {brand.name} item.</CardDescription>
        {canEdit ? (
          <CardAction>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Pencil />
              Edit
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col">
        {rows.length ? (
          rows.map((r) => (
            <a
              key={r.label}
              href={r.href}
              target={r.href.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="lift group flex items-center gap-3 border-t border-line py-2.5 first:border-t-0"
            >
              <span className="flex size-9 flex-none items-center justify-center rounded-full bg-surface2">
                <r.icon className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-xs font-semibold text-muted-foreground">{r.label}</span>
                <span className="truncate text-sm font-semibold">{r.text}</span>
              </span>
            </a>
          ))
        ) : (
          <p className="rounded-2xl bg-surface2 px-4 py-3 text-sm text-muted-foreground">
            No support details yet. {canEdit ? "Add the support site and phone number once, and every item of this brand gets them." : ""}
          </p>
        )}
        {brand.notes ? <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{brand.notes}</p> : null}
      </CardContent>
      {canEdit ? <BrandDrawer open={open} onOpenChange={setOpen} brand={brand} /> : null}
    </Card>
  )
}

function BrandDrawer({ open, onOpenChange, brand }: { open: boolean; onOpenChange: (o: boolean) => void; brand: Brand }) {
  const init = () => ({
    website: brand.website ?? "",
    supportUrl: brand.supportUrl ?? "",
    supportPhone: brand.supportPhone ?? "",
    supportEmail: brand.supportEmail ?? "",
    notes: brand.notes ?? "",
  })
  const [v, setV] = useState(init)
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) setV(init())
  }
  const [pending, start] = useTransition()
  const set = (k: keyof ReturnType<typeof init>, val: string) => setV((p) => ({ ...p, [k]: val }))
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${brand.name}`}
      description="Used on every item of this brand."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await updateBrand(brand.id, v)
                if (!r.ok) return void toast.error(r.error)
                toast("Brand saved")
                onOpenChange(false)
              })
            }
          >
            Save
          </Button>
        </>
      }
    >
      <FieldLabel label="Support Site" hint="Their support, manuals or warranty-claim page.">
        <Input value={v.supportUrl} onChange={(e) => set("supportUrl", e.target.value)} placeholder="daikin.com.au/support" inputMode="url" autoFocus />
      </FieldLabel>
      <FieldLabel label="Website">
        <Input value={v.website} onChange={(e) => set("website", e.target.value)} placeholder="daikin.com.au" inputMode="url" />
      </FieldLabel>
      <div className="grid grid-cols-2 gap-3">
        <FieldLabel label="Support Phone">
          <Input value={v.supportPhone} onChange={(e) => set("supportPhone", e.target.value)} inputMode="tel" placeholder="1300 …" />
        </FieldLabel>
        <FieldLabel label="Support Email">
          <Input value={v.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} inputMode="email" />
        </FieldLabel>
      </div>
      <FieldLabel label="Notes (optional)">
        <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Account number, warranty registration…" />
      </FieldLabel>
    </Drawer>
  )
}
