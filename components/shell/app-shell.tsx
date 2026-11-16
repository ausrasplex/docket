import { Suspense } from "react"
import Link from "next/link"
import { Logo } from "@/components/brand/logo"
import { SideNav, TabNav } from "./nav-links"

const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0"

/**
 * Folio's layout: 224px sidebar on desktop, a bottom tab bar with a raised round Add under 860px.
 * Content is capped at 1100px; padding 32px on desktop, 16px on phones.
 */
export function AppShell({ children, account, top }: { children: React.ReactNode; account?: React.ReactNode; top?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink desk:flex-row">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 z-30 hidden h-screen w-56 flex-none flex-col gap-7 self-start border-r border-line px-[18px] py-7 desk:flex">
        <Link href="/" className="px-2" aria-label="Docket home">
          <Logo />
        </Link>
        <nav aria-label="Main">
          <Suspense fallback={<SideNav static />}>
            <SideNav />
          </Suspense>
        </nav>
        <div className="mt-auto">{account}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 px-4 pb-6 desk:px-8 desk:pb-12">
          {top}
          {children}
        </main>
        <footer className="mx-4 border-t border-line py-4 text-center text-xs font-medium text-muted-foreground desk:mx-8">
          Docket © v{VERSION}
        </footer>
      </div>

      {/* Phone tab bar */}
      <nav aria-label="Main" className="sticky bottom-0 z-25 border-t border-line bg-surface px-2 py-1.5 desk:hidden">
        <Suspense fallback={<TabNav static />}>
          <TabNav />
        </Suspense>
      </nav>
    </div>
  )
}
