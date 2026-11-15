// The address of a room's or item's photo, or null when it has none. The ?v= changes with the photo and each
// crop, so browsers never show an old cached one.
type WithCover = { id: string; cover: { id: string; archivedAt: Date | null } | null; coverCropKey: string | null }

function version(r: WithCover) {
  return (r.coverCropKey ?? r.cover!.id).replace(/[^a-zA-Z0-9]/g, "").slice(-16)
}

export function coverSrc(kind: "space" | "fixture", r: WithCover) {
  if (!r.cover || r.cover.archivedAt) return null
  return `/api/${kind === "space" ? "rooms" : "fixtures"}/${r.id}/photo?v=${version(r)}`
}

/** The id of the photo document in use, or null (an archived photo doesn't count). */
export const activeCoverId = (r: { cover: { id: string; archivedAt: Date | null } | null }) => (r.cover && !r.cover.archivedAt ? r.cover.id : null)
