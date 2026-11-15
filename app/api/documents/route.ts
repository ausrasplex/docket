import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getSession } from "@/lib/dal"
import { acceptedType, storeFile } from "@/lib/storage"
import { atLeast } from "@/lib/roles"
import type { DocumentKind } from "@/generated/prisma/enums"

/**
 * Upload one or more photos or PDFs (multipart field "files").
 * Optional "spaceId" files them straight to a room; otherwise they land in the capture inbox.
 */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  const membership = await db.membership.findFirst({
    where: { userId: session.user.id, ...(session.user.activeHouseholdId ? { householdId: session.user.activeHouseholdId as string } : {}) },
    orderBy: { createdAt: "asc" },
  })
  if (!membership || !atLeast(membership.role, "MEMBER")) return NextResponse.json({ error: "You can't add files here." }, { status: 403 })
  const householdId = membership.householdId

  const form = await req.formData()
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0)
  if (!files.length) return NextResponse.json({ error: "Choose a photo or PDF." }, { status: 400 })

  const spaceId = String(form.get("spaceId") ?? "") || null
  if (spaceId && !(await db.space.findFirst({ where: { id: spaceId, householdId } }))) {
    return NextResponse.json({ error: "That room no longer exists." }, { status: 400 })
  }

  const created: string[] = []
  const errors: string[] = []
  for (const file of files) {
    const mime = file.type || "application/octet-stream"
    if (!acceptedType(mime)) {
      errors.push(`${file.name}: only photos and PDFs can be uploaded.`)
      continue
    }
    try {
      const stored = await storeFile(householdId, Buffer.from(await file.arrayBuffer()), mime)
      const kind: DocumentKind = mime === "application/pdf" ? "OTHER" : "PHOTO"
      const doc = await db.document.create({
        data: {
          householdId,
          kind,
          title: titleFrom(file.name, mime),
          fileName: file.name.slice(0, 200),
          ...stored,
          createdById: session.user.id,
          ...(spaceId ? { links: { create: { spaceId } } } : {}),
        },
      })
      created.push(doc.id)
    } catch (e) {
      errors.push(`${file.name}: ${e instanceof Error ? e.message : "couldn't be saved."}`)
    }
  }
  if (created.length) {
    await db.activity.create({
      data: {
        householdId,
        userId: session.user.id,
        action: "created",
        entityType: "Document",
        entityId: created[0],
        summary: `${session.user.name} captured ${created.length === 1 ? "a file" : `${created.length} files`}`,
      },
    })
  }
  return NextResponse.json({ created, errors }, { status: created.length ? 200 : 400 })
}

/** Phone cameras name files "IMG_1234.jpg"; a dated title is more useful until it's renamed. */
function titleFrom(name: string, mime: string) {
  const base = name.replace(/\.[a-z0-9]+$/i, "").trim()
  if (!base || /^(img|image|photo|pxl|dsc|scan)[-_ ]?\d+/i.test(base)) {
    const when = new Date().toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    return `${mime === "application/pdf" ? "Scan" : "Photo"} ${when}`
  }
  return base.slice(0, 200)
}
