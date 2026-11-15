"use server"

import { revalidatePath } from "next/cache"
import { requireHousehold } from "@/lib/dal"
import { saveCrop, setCover, type CoverKind } from "@/lib/cover"
import { validCrop } from "@/lib/crop"

type Result = { ok: true } | { ok: false; error: string }

const KINDS: CoverKind[] = ["space", "fixture"]

function refresh() {
  revalidatePath("/rooms", "layout")
  revalidatePath("/fixtures", "layout")
}

/** Sets the photo shown in place of a room's or item's icon (one of the household's photos), or clears it. */
export async function setCoverPhoto(kind: CoverKind, id: string, documentId: string | null): Promise<Result> {
  if (!KINDS.includes(kind)) return { ok: false, error: "Unknown kind." }
  const c = await requireHousehold("MEMBER")
  const error = await setCover(kind, c.householdId, id, documentId)
  if (error) return { ok: false, error }
  refresh()
  return { ok: true }
}

/** Saves how the photo is cropped (a square, as fractions of the photo). */
export async function saveCoverCrop(kind: CoverKind, id: string, input: unknown): Promise<Result> {
  if (!KINDS.includes(kind)) return { ok: false, error: "Unknown kind." }
  const c = await requireHousehold("MEMBER")
  const crop = validCrop(input)
  if (!crop) return { ok: false, error: "That crop doesn't fit the photo." }
  const error = await saveCrop(kind, c.householdId, id, crop)
  if (error) return { ok: false, error }
  refresh()
  return { ok: true }
}
