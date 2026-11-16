import { Suspense } from "react"
import { AppShell } from "@/components/shell/app-shell"
import { TopBar, TopBarSkeleton } from "@/components/shell/top-bar"

// The shell is static (prerendered); only the top bar and each page's content read the session.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell
      top={
        <Suspense fallback={<TopBarSkeleton />}>
          <TopBar />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  )
}
