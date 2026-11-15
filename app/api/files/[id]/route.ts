import { db } from "@/lib/db"
import { getSession } from "@/lib/dal"
import { readStored } from "@/lib/storage"

/**
 * Serves a stored file to members of its household only. ?v=thumb for the preview, ?download=1 to save.
 */
export async function GET(req: Request, { params }: RouteContext<"/api/files/[id]">) {
  const session = await getSession()
  if (!session) return new Response("Sign in first", { status: 401 })
  const { id } = await params
  const doc = await db.document.findFirst({
    where: { id, household: { memberships: { some: { userId: session.user.id } } } },
    select: { storageKey: true, thumbnailKey: true, mimeType: true, fileName: true },
  })
  if (!doc?.storageKey) return new Response("Not found", { status: 404 })

  const url = new URL(req.url)
  const thumb = url.searchParams.get("v") === "thumb" && doc.thumbnailKey
  const key = thumb ? doc.thumbnailKey! : doc.storageKey
  let file
  try {
    file = await readStored(key)
  } catch {
    return new Response("The file is missing from storage", { status: 404 })
  }
  const name = (doc.fileName ?? "file").replace(/["\\\r\n]/g, "")
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": thumb ? "image/webp" : (doc.mimeType ?? "application/octet-stream"),
      "Content-Length": String(file.data.length),
      "Content-Disposition": `${url.searchParams.get("download") ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      // images are locked down fully; PDFs need the browser's viewer, which a sandbox would block
      ...(thumb || doc.mimeType?.startsWith("image/") ? { "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox" } : {}),
    },
  })
}
