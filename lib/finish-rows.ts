import "server-only"
import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"
import type { FinishRow } from "@/components/finishes/finish-types"

/** Finishes with their room, brand and filed photos, shaped for the client lists. */
export async function loadFinishes(where: Prisma.FinishWhereInput): Promise<FinishRow[]> {
  const rows = await db.finish.findMany({
    where: { archivedAt: null, ...where },
    orderBy: [{ space: { sortOrder: "asc" } }, { surface: "asc" }],
    include: {
      brand: { select: { name: true } },
      space: { select: { id: true, name: true } },
      links: { where: { document: { archivedAt: null } }, orderBy: { createdAt: "asc" }, include: { document: true } },
    },
  })
  return rows.map((f) => ({
    id: f.id,
    spaceId: f.space.id,
    room: f.space.name,
    input: {
      surface: f.surface,
      surfaceNote: f.surfaceNote ?? "",
      kind: f.kind,
      brand: f.brand?.name ?? "",
      product: f.product ?? "",
      productUrl: f.productUrl ?? "",
      colourName: f.colourName ?? "",
      colourCode: f.colourCode ?? "",
      hex: f.hex ?? "",
      sheen: f.sheen ?? "",
      appliedAt: f.appliedAt ? f.appliedAt.toISOString().slice(0, 10) : null,
      leftoverLocation: f.leftoverLocation ?? "",
      notes: f.notes ?? "",
    },
    docs: f.links.map((l) => ({ linkId: l.id, label: l.label, doc: l.document })),
  }))
}
