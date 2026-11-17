import {
  AirVent,
  Car,
  Cable,
  Cpu,
  Droplets,
  Flame,
  Lamp,
  Package,
  Plug,
  Refrigerator,
  ShieldCheck,
  Sofa,
  Speaker,
  Trees,
  Tv,
  Blinds,
  Wifi,
  type LucideIcon,
} from "lucide-react"
import type { FixtureCategory } from "@/generated/prisma/enums"

export const CATEGORIES: { id: FixtureCategory; label: string; icon: LucideIcon; tone: "a1" | "a2" | "a3" }[] = [
  { id: "APPLIANCE", label: "Appliance", icon: Refrigerator, tone: "a1" },
  { id: "HEATING_COOLING", label: "Heating & Cooling", icon: AirVent, tone: "a2" },
  { id: "HOT_WATER", label: "Hot Water", icon: Flame, tone: "a3" },
  { id: "PLUMBING", label: "Plumbing", icon: Droplets, tone: "a1" },
  { id: "TAPWARE", label: "Tapware", icon: Droplets, tone: "a2" },
  { id: "LIGHTING", label: "Lighting", icon: Lamp, tone: "a3" },
  { id: "ELECTRICAL", label: "Electrical", icon: Plug, tone: "a1" },
  { id: "SECURITY", label: "Security", icon: ShieldCheck, tone: "a2" },
  { id: "NETWORK", label: "Network", icon: Wifi, tone: "a3" },
  { id: "COMPUTER", label: "Computer", icon: Cpu, tone: "a1" },
  { id: "ENTERTAINMENT", label: "Entertainment", icon: Tv, tone: "a2" },
  { id: "AUDIO", label: "Audio", icon: Speaker, tone: "a3" },
  { id: "WINDOW_COVERING", label: "Blinds & Curtains", icon: Blinds, tone: "a3" },
  { id: "JOINERY", label: "Joinery", icon: Sofa, tone: "a1" },
  { id: "OUTDOOR", label: "Outdoor", icon: Trees, tone: "a2" },
  { id: "VEHICLE", label: "Vehicle", icon: Car, tone: "a3" },
  { id: "OTHER", label: "Other", icon: Package, tone: "a3" },
]

export const category = (c: FixtureCategory) => CATEGORIES.find((x) => x.id === c) ?? CATEGORIES.at(-1)!
export const PART_ICON = Cable

export type WarrantyState = { tone: "ok" | "soon" | "expired" | "none"; text: string }

/** "Warranty to 3 Mar 2031", "Warranty ends in 21 days", "Warranty ended 4 Jan 2025". */
export function warranty(expires: Date | null | undefined, now = new Date()): WarrantyState {
  if (!expires) return { tone: "none", text: "No warranty recorded" }
  const days = Math.ceil((expires.getTime() - now.getTime()) / 86_400_000)
  const d = expires.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  if (days < 0) return { tone: "expired", text: `Warranty ended ${d}` }
  if (days <= 90) return { tone: "soon", text: days === 0 ? "Warranty ends today" : `Warranty ends in ${days} day${days === 1 ? "" : "s"}` }
  return { tone: "ok", text: `Warranty to ${d}` }
}
