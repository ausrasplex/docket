import Link from "next/link"
import { requireHousehold } from "@/lib/dal"
import { Mark } from "@/components/brand/logo"
import { Skeleton } from "@/components/ui/skeleton"
import { Initials } from "./initials"
import { HouseholdSwitch } from "./household-switch"
import { ThemeSync } from "./theme-sync"
import { parseMode, parseTheme } from "@/lib/theme"

/**
 * Folio's sticky top bar on every page: the logo (phones only; it is the way Home there), the household
 * switcher, and your avatar on the right (it opens Settings, where Sign Out is). Page background at 72%
 * with a backdrop blur and a 1px underline.
 */
function Bar({ children }: { children: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-20 -mx-4 border-b border-line bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] px-4 py-2.5 backdrop-blur-[16px] backdrop-saturate-[1.4] desk:-mx-8 desk:px-8 desk:py-3.5">
      <div className="mx-auto flex min-h-11 max-w-[1100px] items-center gap-2.5">{children}</div>
    </header>
  )
}

function HomeLink() {
  return (
    <Link href="/" aria-label="Docket home" className="flex-none desk:hidden">
      <Mark size={40} />
    </Link>
  )
}

export async function TopBar() {
  const c = await requireHousehold()
  return (
    <Bar>
      <ThemeSync theme={parseTheme(c.user.theme as string)} mode={parseMode(c.user.mode as string)} />
      <HomeLink />
      <HouseholdSwitch current={c.householdId} households={c.households.map((h) => ({ id: h.id, name: h.name }))} />
      <Link href="/settings" aria-label="Your profile" className="ml-auto flex-none rounded-full">
        <Initials name={c.user.name} size={44} />
      </Link>
    </Bar>
  )
}

export function TopBarSkeleton() {
  return (
    <Bar>
      <HomeLink />
      <Skeleton className="h-11 w-32 rounded-full" />
      <Skeleton className="ml-auto size-11 rounded-full" />
    </Bar>
  )
}
