"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"
import { NAV, TABS_LEFT, TABS_RIGHT, isActive, type NavItem } from "./nav"
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
    </ul>
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
