import {
  Camera,
  DoorOpen,
  FileText,
  Hammer,
  House,
  Lamp,
  Paintbrush,
  Receipt,
  Settings,
  type LucideIcon,
} from "lucide-react"

export type NavItem = { href: string; label: string; icon: LucideIcon }

// Desktop sidebar order (the Add button sits above these, as in Folio)
export const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/rooms", label: "Rooms", icon: DoorOpen },
  { href: "/fixtures", label: "Fixtures", icon: Lamp },
  { href: "/jobs", label: "Jobs", icon: Hammer },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
]

// Phone tab bar: four tabs around the raised round Add in the middle
export const TABS_LEFT: NavItem[] = [NAV[0], NAV[1]]
export const TABS_RIGHT: NavItem[] = [NAV[4], NAV[5]]

export type AddItem = { href: string; label: string; detail: string; icon: LucideIcon; tone: "a1" | "a2" | "a3" }

// The Add menu: capture comes first because it is the main thing done on a phone
export const ADD: AddItem[] = [
  { href: "/capture", label: "Capture", detail: "Photograph a receipt, label or manual", icon: Camera, tone: "a3" },
  { href: "/fixtures/new", label: "Fixture", detail: "An appliance, tap, light or system", icon: Lamp, tone: "a1" },
  { href: "/jobs/new", label: "Job", detail: "Work done on the house", icon: Hammer, tone: "a2" },
  { href: "/expenses/new", label: "Receipt", detail: "A cost, with or without a job", icon: Receipt, tone: "a3" },
  { href: "/finishes/new", label: "Paint or finish", detail: "A colour or surface in a room", icon: Paintbrush, tone: "a1" },
]

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")
}
