import { Suspense } from "react"
import { AppShell } from "@/components/shell/app-shell"
import { AccountChip } from "@/components/shell/account-chip"
import { Skeleton } from "@/components/ui/skeleton"
import { TopBar, TopBarSkeleton } from "@/components/shell/top-bar"

// The shell is static (prerendered); only the top bar, the account chip and each page's content read the session.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      top={
        <Suspense fallback={<TopBarSkeleton />}>
          <TopBar />
        </Suspense>
      }
      account={
        <Suspense fallback={<Skeleton className="h-14 w-full rounded-xl" />}>
          <AccountChip />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  )
}
