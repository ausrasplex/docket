"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AddLinkDrawer } from "@/components/documents/add-link-drawer"
import type { TargetOption } from "@/components/documents/target-picker"
import { withoutAdd } from "@/components/shell/header-action"

/** The Add Web Link drawer; the button beside the page title opens it with ?add=link. */
export function AddLink({ targets, openAdd }: { targets: TargetOption[]; openAdd: boolean }) {
  const router = useRouter()
  const path = usePathname()
  const params = useSearchParams()
  const [open, setOpen] = useState(openAdd)
  const [lastAdd, setLastAdd] = useState(openAdd)
  if (openAdd !== lastAdd) {
    setLastAdd(openAdd)
    if (openAdd) setOpen(true)
  }
  const onOpenChange = (o: boolean) => {
    setOpen(o)
    if (!o && openAdd) router.replace(withoutAdd(path, params), { scroll: false })
  }
  return <AddLinkDrawer open={open} onOpenChange={onOpenChange} targets={targets} />
}
