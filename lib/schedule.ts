import "server-only"
import { db } from "@/lib/db"
import { category } from "@/lib/fixtures"
import { finishKindLabel, surfaceLabel } from "@/lib/finishes"
import type { FinishKind, FixtureCategory } from "@/generated/prisma/enums"

// The fixtures and finishes schedule: what's in the house, by trade, then by room. What an owner keeps on
// paper (or hands a tradie) to match a downlight, re-order a tile or touch up a wall: what each thing is, its
// product, where it was bought, and its colour, finish and size. Printed from /exports/schedule as a PDF.

export type ScheduleGroup = {
  id: string
  label: string
  hint: string
  categories: FixtureCategory[]
  finishes: FinishKind[]
  /** ticked to begin with: the house itself, not what you'd take with you */
  on: boolean
}

export const SCHEDULE_GROUPS: ScheduleGroup[] = [
  {
    id: "electrical",
    label: "Electrical",
    hint: "Lighting, power, appliances, heating and cooling, solar, security, network and AV",
    categories: ["ELECTRICAL", "LIGHTING", "APPLIANCE", "HEATING_COOLING", "SOLAR", "SECURITY", "NETWORK", "AUDIO", "ENTERTAINMENT"],
    finishes: [],
    on: true,
  },
  { id: "plumbing", label: "Plumbing", hint: "Tapware, sanitaryware, hot water and pumps", categories: ["PLUMBING", "TAPWARE", "HOT_WATER"], finishes: [], on: true },
  { id: "paint", label: "Paint", hint: "Paint, stain and wallpaper", categories: [], finishes: ["PAINT", "STAIN", "WALLPAPER"], on: true },
  { id: "tiles", label: "Tiles and Stone", hint: "Floor and wall tiles, splashbacks and stone", categories: [], finishes: ["TILE", "STONE"], on: true },
  { id: "flooring", label: "Flooring", hint: "Timber, vinyl, carpet and laminate", categories: [], finishes: ["FLOORING", "LAMINATE"], on: true },
  { id: "fillers", label: "Fillers", hint: "Grout, silicone and sealants", categories: [], finishes: ["GROUT", "SEALANT"], on: true },
  { id: "joinery", label: "Joinery and Window Coverings", hint: "Cabinetry, vanities, blinds and curtains", categories: ["JOINERY", "WINDOW_COVERING"], finishes: [], on: true },
  { id: "outdoor", label: "Outdoor", hint: "Garden, pool and outdoor equipment", categories: ["OUTDOOR"], finishes: [], on: true },
  { id: "other", label: "Other", hint: "Everything else fixed to the house", categories: ["OTHER"], finishes: ["OTHER"], on: true },
  { id: "furniture", label: "Furniture", hint: "Couches, beds, tables and storage", categories: ["FURNITURE"], finishes: [], on: false },
  {
    id: "belongings",
    label: "Belongings",
    hint: "Computers, phones, cameras, vehicles, tools and other things you'd take with you",
    categories: ["COMPUTER", "PHONE_TABLET", "CAMERA", "VEHICLE", "JEWELLERY", "ART", "MUSIC", "FITNESS", "TOOLS"],
    finishes: [],
    on: false,
  },
]

export type ScheduleRow = {
  id: string
  /** what it is: "Downlight", or a finish's surface: "Feature Wall" */
  item: string
  /** under the item: the item a part belongs to, or which part of the room a finish is on */
  itemNote: string | null
  /** brand and model, or a finish's brand and product */
  product: string
  store: string | null
  /** colour, finish and size, as one line: "White / 90mm cutout" */
  look: string | null
  /** an item's cropped photo (a storage key) */
  photoKey: string | null
  /** a finish's swatch */
  hex: string | null
}

export type ScheduleRoom = { room: string; rows: ScheduleRow[] }
export type ScheduleSection = { group: ScheduleGroup; rooms: ScheduleRoom[]; count: number }

const join = (parts: (string | null | undefined)[], sep: string) => parts.map((p) => p?.trim()).filter(Boolean).join(sep) || null

/** Which group an item or finish prints in. */
const groupOfCategory = (c: FixtureCategory) => SCHEDULE_GROUPS.find((g) => g.categories.includes(c))!
const groupOfFinish = (k: FinishKind) => SCHEDULE_GROUPS.find((g) => g.finishes.includes(k))!

const NO_ROOM = "No Room"
const PORTABLE = "Portable"

/** Every group with its rooms and rows (empty groups too, for the picker's counts). */
export async function schedule(householdId: string, propertyId: string): Promise<ScheduleSection[]> {
  const partSelect = {
    id: true,
    name: true,
    model: true,
    store: true,
    colour: true,
    size: true,
    coverCropKey: true,
    sortOrder: true,
    brand: { select: { name: true } },
    space: { select: { name: true, sortOrder: true } },
  } as const
  const [items, finishes, spaces] = await Promise.all([
    db.fixture.findMany({
      where: { householdId, propertyId, archivedAt: null, parentId: null },
      orderBy: { name: "asc" },
      select: { ...partSelect, category: true, portable: true, parts: { where: { archivedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: partSelect } },
    }),
    db.finish.findMany({
      where: { householdId, archivedAt: null, space: { propertyId, archivedAt: null } },
      orderBy: [{ surface: "asc" }, { colourName: "asc" }],
      select: {
        id: true,
        surface: true,
        surfaceNote: true,
        kind: true,
        product: true,
        colourName: true,
        colourCode: true,
        hex: true,
        sheen: true,
        size: true,
        store: true,
        brand: { select: { name: true } },
        space: { select: { name: true, sortOrder: true } },
      },
    }),
    db.space.findMany({ where: { householdId, propertyId }, select: { name: true, sortOrder: true } }),
  ])

  // group → room → rows
  const byGroup = new Map<string, Map<string, ScheduleRow[]>>()
  const add = (g: ScheduleGroup, room: string, row: ScheduleRow) => {
    const rooms = byGroup.get(g.id) ?? new Map<string, ScheduleRow[]>()
    rooms.set(room, [...(rooms.get(room) ?? []), row])
    byGroup.set(g.id, rooms)
  }

  for (const f of items) {
    // portable things belong to no room; they're belongings whatever their category
    const g = f.portable ? SCHEDULE_GROUPS.find((x) => x.id === "belongings")! : groupOfCategory(f.category)
    const room = f.portable ? PORTABLE : (f.space?.name ?? NO_ROOM)
    add(g, room, {
      id: f.id,
      item: f.name,
      itemNote: null,
      product: join([f.brand?.name, f.model], " ") ?? category(f.category).label,
      store: f.store,
      look: join([f.colour, f.size], " / "),
      photoKey: f.coverCropKey,
      hex: null,
    })
    // a part is listed when there's something to say about it (its own make, model, store, colour or size)
    for (const p of f.parts) {
      if (!(p.brand || p.model || p.store || p.colour || p.size)) continue
      add(g, f.portable ? PORTABLE : (p.space?.name ?? room), {
        id: p.id,
        item: p.name,
        itemNote: `Part of ${f.name}`,
        product: join([p.brand?.name ?? f.brand?.name, p.model], " ") ?? "",
        store: p.store,
        look: join([p.colour, p.size], " / "),
        photoKey: p.coverCropKey,
        hex: null,
      })
    }
  }

  for (const f of finishes) {
    const colour = f.colourName && f.colourCode ? `${f.colourName} (${f.colourCode})` : (f.colourName ?? f.colourCode)
    add(groupOfFinish(f.kind), f.space.name, {
      id: f.id,
      item: surfaceLabel(f.surface),
      itemNote: f.surfaceNote,
      product: join([f.brand?.name, f.product], " ") ?? finishKindLabel(f.kind),
      store: f.store,
      look: join([colour, f.sheen, f.size], " / "),
      photoKey: null,
      hex: f.hex,
    })
  }

  // rooms in the house's own order; no room and portable last
  const order = new Map(spaces.map((s) => [s.name, s.sortOrder]))
  const rank = (room: string) => (room === PORTABLE ? 1e9 + 1 : room === NO_ROOM ? 1e9 : (order.get(room) ?? 1e8))
  return SCHEDULE_GROUPS.map((group) => {
    const rooms = [...(byGroup.get(group.id) ?? new Map<string, ScheduleRow[]>()).entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]))
      .map(([room, rows]) => ({ room, rows }))
    return { group, rooms, count: rooms.reduce((n, r) => n + r.rows.length, 0) }
  })
}

/** The groups named in ?groups=a,b (in the schedule's own order), or the ones ticked to begin with. */
export function pickGroups(param: string | null | undefined) {
  if (!param) return SCHEDULE_GROUPS.filter((g) => g.on).map((g) => g.id)
  const want = new Set(param.split(","))
  return SCHEDULE_GROUPS.filter((g) => want.has(g.id)).map((g) => g.id)
}
