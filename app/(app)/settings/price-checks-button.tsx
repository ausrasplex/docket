"use client"

import { useTransition } from "react"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { retryFailedPrices } from "../fixtures/price-actions"

export function RetryPrices() {
  const [pending, start] = useTransition()
  return (
    <Button
      type="button"
      variant="outline"
      className="self-start"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await retryFailedPrices()
          if (!r.ok) return void toast.error(r.error)
          if (r.fixed === r.tried) toast(`All ${r.tried} read this time`)
          else toast(`${r.fixed} of ${r.tried} read this time`, { description: r.fixed ? undefined : "The rest are still failing." })
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {pending ? "Checking…" : "Try Them Again"}
    </Button>
  )
}
