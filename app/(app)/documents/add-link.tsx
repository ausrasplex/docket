"use client"

import { useState } from "react"
import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AddLinkDrawer } from "@/components/documents/add-link-drawer"
import type { TargetOption } from "@/components/documents/target-picker"

export function AddLink({ targets }: { targets: TargetOption[] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Globe />
        Add Web Link
      </Button>
      <AddLinkDrawer open={open} onOpenChange={setOpen} targets={targets} />
    </>
  )
}
