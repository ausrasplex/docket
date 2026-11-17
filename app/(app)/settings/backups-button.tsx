"use client"

import { useTransition } from "react"
import { DatabaseBackup, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { backUpNow } from "./actions"

export function BackUpNow() {
  const [pending, start] = useTransition()
  return (
    <Button
      type="button"
      variant="outline"
      className="self-start"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await backUpNow()
          if (r.ok) toast("Backed up")
          else toast.error(r.error)
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <DatabaseBackup />}
      {pending ? "Backing Up…" : "Back Up Now"}
    </Button>
  )
}
