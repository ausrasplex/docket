"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"
import { Ellipsis } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { MORE, NAV, TABS_LEFT, TABS_RIGHT, isActive, type NavItem } from "./nav"
import { AddMenu } from "./add-menu"

// These read the URL to highlight the current page, so the shell renders them inside <Suspense>
// (with the same links, un-highlighted, as the fallback) and stays prerendered on dynamic routes.

export function SideNav({ static: isStatic }: { static?: boolean }) {
  return isStatic ? <SideList pathname={null} /> : <SideNavLive />
}
function SideNavLive() {
  return <SideList pathname={usePathname()} />
}

function SideList({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex flex-col gap-1.5">
      <li className="mb-2.5">
        <AddMenu variant="side" />
      </li>
      {NAV.map((n) => (
        <li key={n.href}>
          <SideLink item={n} on={!!pathname && isActive(pathname, n.href)} />
        </li>
      ))}
    </ul>
  )
}

export function TabNav({ static: isStatic }: { static?: boolean }) {
  return isStatic ? <TabList pathname={null} /> : <TabNavLive />
}
function TabNavLive() {
  return <TabList pathname={usePathname()} />
}

function TabList({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex justify-between gap-0.5">
      {TABS_LEFT.map((n) => (
        <li key={n.href} className="flex-1">
          <TabLink item={n} on={!!pathname && isActive(pathname, n.href)} />
        </li>
      ))}
      <li className="flex flex-1 items-start justify-center">
        <AddMenu variant="tab" />
      </li>
      {TABS_RIGHT.map((n) => (
        <li key={n.href} className="flex-1">
          <TabLink item={n} on={!!pathname && isActive(pathname, n.href)} />
        </li>
      ))}
      <li className="flex-1">
        <MoreMenu pathname={pathname} />
      </li>
    </ul>
  )
}

/** The last tab: opens upward with the pages that don't fit in the bar. Highlighted while on one of them. */
function MoreMenu({ pathname }: { pathname: string | null }) {
  const current = pathname ? MORE.find((n) => isActive(pathname, n.href)) : undefined
  return (
    <DropdownMenu modal>
      <DropdownMenuTrigger
        aria-label="More pages"
        className={cn(
          "flex min-h-15 w-full cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1.5 text-[11px] font-semibold outline-none",
          current ? "bg-nav-on text-ink" : "text-muted-foreground data-[state=open]:text-ink"
        )}
      >
        {current ? <current.icon className="size-5" /> : <Ellipsis className="size-5" />}
        {current ? current.label : "More"}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-[min(240px,calc(100vw-32px))] rounded-3xl p-2 shadow-dialog">
        {MORE.map((n) => {
          const on = !!pathname && isActive(pathname, n.href)
          return (
            <DropdownMenuItem key={n.href} asChild className={cn("min-h-12 gap-3 rounded-xl px-3 text-sm font-semibold", on && "bg-nav-on")}>
              <Link href={n.href} aria-current={on ? "page" : undefined}>
                <n.icon className="size-5" />
                {n.label}
              </Link>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SideLink({ item, on }: { item: NavItem; on: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3.5 text-sm font-semibold",
        on
          ? "bg-surface text-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]"
          : "text-muted-foreground hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] hover:text-ink"
      )}
    >
      <item.icon className="size-5" />
      {item.label}
    </Link>
  )
}

function TabLink({ item, on }: { item: NavItem; on: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex min-h-15 flex-col items-center justify-center gap-0.5 rounded-md px-0.5 py-1.5 text-[11px] font-semibold",
        on ? "bg-nav-on text-ink" : "text-muted-foreground"
      )}
    >
      <item.icon className="size-5" />
      {item.label}
    </Link>
  )
}
