import Link from "next/link"
import { LogOut, Settings } from "lucide-react"
import { requireHousehold } from "@/lib/dal"
import { signOut } from "@/app/(auth)/actions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ROLE_LABELS } from "@/lib/roles"
import { Initials } from "./initials"
import { ThemeSync } from "./theme-sync"
import { parseMode, parseTheme } from "@/lib/theme"

/** Bottom of the desktop sidebar: who is signed in and in which household, with Sign out. */
export async function AccountChip() {
  const c = await requireHousehold()
  return (
    <>
    <ThemeSync theme={parseTheme(c.user.theme as string)} mode={parseMode(c.user.mode as string)} />
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left outline-none hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]">
        <Initials name={c.user.name} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-bold">{c.user.name}</span>
          <span className="truncate text-xs font-medium text-muted-foreground">{c.household.name}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-60">
        <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
          {ROLE_LABELS[c.role]} · {c.household.name}
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild variant="destructive">
            <button type="submit" className="w-full">
              <LogOut />
              Sign Out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
    </>
  )
}
