"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Drawer, FieldLabel } from "@/components/drawer"
import type { DocumentKind } from "@/generated/prisma/enums"
import { addWebLink, type Target } from "@/app/(app)/documents/actions"
import { KindSelect } from "./kind-select"
import { TargetPicker, type TargetOption } from "./target-picker"

const LINK_KINDS: DocumentKind[] = ["MANUAL", "SUPPORT", "SOFTWARE", "SPEC_SHEET", "WARRANTY", "OTHER"]

/**
 * Save a web page as a document: an online manual, support page or driver download.
 * Either pick where it goes (`targets`) or pass a fixed `target` (e.g. on an item's page).
 */
export function AddLinkDrawer({
  open,
  onOpenChange,
  targets,
  target: fixed,
  targetName,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  targets?: TargetOption[]
  target?: Target
  targetName?: string
}) {
  const [url, setUrl] = useState("")
  const [title, setTitle] = useState("")
  const [label, setLabel] = useState("")
  const [kind, setKind] = useState<DocumentKind>("MANUAL")
  const [picked, setPicked] = useState<Target[]>([])
  const [pending, start] = useTransition()
  const target = fixed ?? picked[0] ?? null

  const save = () =>
    start(async () => {
      const r = await addWebLink({ url, title, kind, target, label })
      if (!r.ok) return void toast.error(r.error)
      toast("Link saved")
      setUrl("")
      setTitle("")
      setLabel("")
      setKind("MANUAL")
      setPicked([])
      onOpenChange(false)
    })

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Add Web Link"
      description={targetName ? `For ${targetName}: an online manual, support page or download.` : "An online manual, a support page or a driver download."}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={pending || !url.trim()} onClick={save}>
            Save Link
          </Button>
        </>
      }
    >
      <FieldLabel label="Web Address">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="daikin.com.au/support" inputMode="url" autoFocus />
      </FieldLabel>
      <FieldLabel label="Title (optional)" hint="Leave blank to use the site's name.">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Online user manual" />
      </FieldLabel>
      <KindSelect value={kind} onChange={setKind} only={(k) => LINK_KINDS.includes(k)} />
      {!fixed && targets ? <TargetPicker options={targets} value={picked} onChange={setPicked} label="File To (optional)" /> : null}
      {target ? (
        <FieldLabel label="Label (optional)" hint="What it's for: “Drivers”, “BIOS updates”, “Indoor unit”.">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </FieldLabel>
      ) : null}
    </Drawer>
  )
}
