"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, Settings } from "lucide-react"
import { toast } from "sonner"
import { switchHousehold } from "@/app/(app)/settings/actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/** The household pill in the top bar: shows the current household and switches between yours. */
export function HouseholdSwitch({ current, households }: { current: string; households: { id: string; name: string }[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const name = households.find((h) => h.id === current)?.name ?? "Household"

  function pick(id: string) {
    if (id === current) return
    start(async () => {
      const r = await switchHousehold(id)
      if (!r.ok) toast.error(r.error)
      else router.push("/")
    })
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={pending}
        className="flex min-h-11 min-w-0 cursor-pointer items-center gap-2 rounded-full bg-surface px-4 text-sm font-semibold text-ink outline-none hover:bg-surface2 disabled:opacity-60"
      >
        <span className="truncate">{name}</span>
        <ChevronDown className="size-3.5 flex-none text-muted-foreground" strokeWidth={2.4} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">Households</DropdownMenuLabel>
        {households.map((h) => (
          <DropdownMenuItem key={h.id} onSelect={() => pick(h.id)} className="justify-between">
            <span className="truncate">{h.name}</span>
            {h.id === current ? <Check className="text-sel" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Household settings
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
