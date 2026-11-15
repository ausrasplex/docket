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
  { href: "/paint", label: "Paint", icon: Paintbrush },
  { href: "/jobs", label: "Jobs", icon: Hammer },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
]

// Phone tab bar: four tabs around the raised round Add in the middle
export const TABS_LEFT: NavItem[] = [NAV[0], NAV[1]]
export const TABS_RIGHT: NavItem[] = [NAV[5], NAV[6]] // Documents, Settings

export type AddItem = { href: string; label: string; detail: string; icon: LucideIcon; tone: "a1" | "a2" | "a3" }

// The Add menu: capture comes first because it is the main thing done on a phone.
// Job and Receipt point at their sections until those get their own add forms.
export const ADD: AddItem[] = [
  { href: "/capture", label: "Capture", detail: "Photograph a receipt, label or manual", icon: Camera, tone: "a3" },
  { href: "/fixtures?add=1", label: "Item", detail: "An appliance, tap, light or system", icon: Lamp, tone: "a1" },
  { href: "/jobs", label: "Job", detail: "Work done on the house", icon: Hammer, tone: "a2" },
  { href: "/capture", label: "Receipt", detail: "Photograph it now, add the cost later", icon: Receipt, tone: "a3" },
  { href: "/paint?add=1", label: "Paint or finish", detail: "A colour or surface in a room", icon: Paintbrush, tone: "a1" },
]

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/")
}
