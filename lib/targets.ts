import "server-only"
import { db } from "@/lib/db"
import type { TargetOption } from "@/components/documents/target-picker"

/** Everything a document can be filed to in this property: items, their parts, rooms, and paint/finishes. */
export async function fileTargets(householdId: string, propertyId: string): Promise<TargetOption[]> {
  const [items, rooms, finishes] = await Promise.all([
    db.fixture.findMany({
      where: { householdId, propertyId, archivedAt: null, parentId: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        space: { select: { name: true } },
        parts: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } },
      },
    }),
    db.space.findMany({
      where: { householdId, propertyId, archivedAt: null, kind: { not: "FLOOR" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.finish.findMany({
      where: { householdId, archivedAt: null, space: { propertyId, archivedAt: null } },
      orderBy: [{ colourName: "asc" }],
      select: { id: true, colourName: true, colourCode: true, product: true, space: { select: { name: true } } },
    }),
  ])
  return [
    ...items.flatMap((i): TargetOption[] => [
      { type: "fixture", id: i.id, name: i.name, detail: i.space?.name },
      ...i.parts.map((p): TargetOption => ({ type: "fixture", id: p.id, name: `${i.name} › ${p.name}` })),
    ]),
    ...rooms.map((r): TargetOption => ({ type: "space", id: r.id, name: r.name })),
    ...finishes.map((f): TargetOption => ({ type: "finish", id: f.id, name: f.colourName ?? f.colourCode ?? f.product ?? "Finish", detail: f.space.name })),
  ]
}
