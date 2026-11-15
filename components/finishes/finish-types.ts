import type { DocLike } from "@/components/documents/document-row"
import type { FinishInput } from "@/app/(app)/paint/actions"

export type FinishRow = {
  id: string
  spaceId: string
  room: string
  input: FinishInput
  docs: { linkId: string; label: string | null; doc: DocLike }[]
}

export const BLANK_FINISH: FinishInput = {
  surface: "WALLS",
  surfaceNote: "",
  kind: "PAINT",
  brand: "",
  product: "",
  productUrl: "",
  colourName: "",
  colourCode: "",
  hex: "",
  sheen: "",
  appliedAt: null,
  leftoverLocation: "",
  notes: "",
}

/** Copies a finish's colour details for another room (keeps colour, brand, product, sheen; clears the rest). */
export function sameColour(i: FinishInput): FinishInput {
  return { ...BLANK_FINISH, kind: i.kind, brand: i.brand, product: i.product, productUrl: i.productUrl, colourName: i.colourName, colourCode: i.colourCode, hex: i.hex, sheen: i.sheen, surface: i.surface }
}
