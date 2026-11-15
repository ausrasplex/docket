import { Building2, DoorOpen, House, Layers, Trees, Warehouse, type LucideIcon } from "lucide-react"
import type { SpaceKind } from "@/generated/prisma/enums"

export const SPACE_KINDS: { id: SpaceKind; label: string; detail: string; icon: LucideIcon; tone: "a1" | "a2" | "a3" }[] = [
  { id: "ROOM", label: "Room", detail: "Kitchen, bedroom, bathroom…", icon: DoorOpen, tone: "a1" },
  { id: "FLOOR", label: "Floor", detail: "A level that groups rooms", icon: Layers, tone: "a2" },
  { id: "GARAGE", label: "Garage or shed", detail: "", icon: Warehouse, tone: "a2" },
  { id: "EXTERIOR", label: "Outside", detail: "Yard, roof, walls, fences", icon: Trees, tone: "a3" },
  { id: "WHOLE_HOUSE", label: "Whole house", detail: "Hot water, switchboard, solar…", icon: House, tone: "a3" },
  { id: "OTHER", label: "Other", detail: "", icon: Building2, tone: "a1" },
]

export const spaceKind = (k: SpaceKind) => SPACE_KINDS.find((s) => s.id === k) ?? SPACE_KINDS[0]
