import { Suspense } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft, ChevronRight, FileText, Hammer, Lamp, Paintbrush, Plus } from "lucide-react"
import { PageBody, PageTitle } from "@/components/shell/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { DocumentRow } from "@/components/documents/document-row"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { atLeast } from "@/lib/roles"
import { spaceKind } from "@/lib/spaces"
import { date, money, plural } from "@/lib/format"
import { jobStatus } from "@/lib/jobs"
import { RoomActions } from "./room-actions"
import { CategoryTile, itemPhotoSrc } from "@/components/fixtures/category-tile"
import { DocActions } from "@/components/documents/doc-actions"
import { editable } from "@/components/documents/editable"
import { CoverPhotoButton, type CoverTarget } from "@/components/covers/cover-photo"
import { RoomTile, roomPhotoSrc } from "@/components/rooms/room-tile"
import { FinishList } from "@/components/finishes/finish-list"
import { loadFinishes } from "@/lib/finish-rows"
import { bySlugOrId } from "@/lib/slug"


export default function RoomPage({ params }: PageProps<"/rooms/[id]">) {
  return (
    <Suspense
      fallback={
        <PageBody>
          <Skeleton className="mt-6 h-40 rounded-3xl" />
        </PageBody>
      }
    >
      <Room params={params} />
    </Suspense>
  )
}

async function Room({ params }: { params: PageProps<"/rooms/[id]">["params"] }) {
  const { id: param } = await params // the room's slug (or its id, from old links)
  const c = await requireHousehold()
  const room = await db.space.findFirst({
    where: bySlugOrId(c.householdId, param),
    include: {
      parent: { select: { id: true, name: true, slug: true } },
      cover: { select: { id: true, archivedAt: true } },
      children: { where: { archivedAt: null }, select: { id: true, slug: true, name: true, kind: true }, orderBy: { sortOrder: "asc" } },
      fixtures: {
        where: { archivedAt: null, parentId: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true, category: true, coverCropKey: true, cover: { select: { id: true, archivedAt: true } }, model: true, brand: { select: { name: true } }, _count: { select: { parts: true, links: true } } },
      },
      links: {
        where: { document: { archivedAt: null } },
        orderBy: { createdAt: "desc" },
        include: { document: true },
      },
    },
  })
  if (!room) notFound()
  if (param !== room.slug) redirect(`/rooms/${room.slug}`)
  const k = spaceKind(room.kind)
  const [floors, finishes, rooms, brands, jobs] = await Promise.all([
    db.space.findMany({
      where: { householdId: c.householdId, propertyId: room.propertyId, kind: "FLOOR", archivedAt: null },
      select: { id: true, name: true },
    }),
    loadFinishes({ householdId: c.householdId, spaceId: room.id }),
    db.space.findMany({
      where: { householdId: c.householdId, propertyId: room.propertyId, archivedAt: null, kind: { not: "FLOOR" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.brand.findMany({ where: { householdId: c.householdId, archivedAt: null }, orderBy: { name: "asc" }, select: { name: true } }),
    db.job.findMany({
      where: { householdId: c.householdId, archivedAt: null, spaces: { some: { spaceId: room.id } } },
      orderBy: [{ finishedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
      select: { id: true, title: true, status: true, finishedAt: true, expenses: { where: { archivedAt: null }, select: { amount: true } } },
    }),
  ])
  const canEdit = atLeast(c.role, "MEMBER")
  // an archived photo no longer counts as the room's photo
  const coverId = room.cover && !room.cover.archivedAt ? room.cover.id : null
  const photos = room.links.filter((l) => l.document.thumbnailKey).map((l) => ({ id: l.document.id, title: l.document.title }))
  const photoRoom: CoverTarget = {
    kind: "space",
    id: room.id,
    name: room.name,
    noun: "Room",
    coverId,
    src: roomPhotoSrc(room),
    icon: { type: "space", kind: room.kind },
    cropHref: `/rooms/${room.slug}/photo`,
  }

  return (
    <>
      <PageTitle>
        <Link href="/rooms" aria-label="Back to rooms" className="flex size-11 flex-none items-center justify-center rounded-full bg-surface hover:bg-surface2">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate">{room.name}</h1>
        {canEdit ? (
          <RoomActions
            room={{ id: room.id, slug: room.slug, name: room.name, kind: room.kind, parentId: room.parentId, notes: room.notes ?? "" }}
            archived={!!room.archivedAt}
            floors={floors}
            photoRoom={photoRoom}
            photos={photos}
          />
        ) : null}
      </PageTitle>
      <PageBody>
        {room.archivedAt ? (
          <p className="rounded-[14px] bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">This room is archived. Restore it from the ⋯ menu.</p>
        ) : null}

        <div className="flex items-center gap-3">
          {canEdit ? <CoverPhotoButton target={photoRoom} photos={photos} /> : <RoomTile kind={room.kind} src={photoRoom.src} className="size-16" />}
          <div className="flex flex-col">
            <span className="text-sm font-bold">{k.label}</span>
            <span className="text-xs font-medium text-muted-foreground">
              {room.parent ? (
                <>
                  On <Link href={`/rooms/${room.parent.slug}`} className="font-semibold text-ink hover:underline">{room.parent.name}</Link>
                </>
              ) : (
                c.property.name
              )}
            </span>
          </div>
        </div>
        {room.notes ? <p className="max-w-prose text-sm whitespace-pre-line">{room.notes}</p> : null}

        {room.kind === "FLOOR" ? (
          <Card>
            <CardHeader>
              <CardTitle>Rooms on This Floor</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col">
              {room.children.length ? (
                room.children.map((ch) => (
                  <Link key={ch.id} href={`/rooms/${ch.slug}`} className="border-t border-line py-3 text-[15px] font-bold first:border-t-0 hover:underline">
                    {ch.name}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">Edit a room and choose this floor to list it here.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 items-start gap-5 desk:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Fixtures</CardTitle>
                <CardDescription>Appliances, taps, lights and systems in this room.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col">
                {room.fixtures.length ? (
                  room.fixtures.map((f) => (
                    <Link key={f.id} href={`/fixtures/${f.id}`} className="lift group flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                      <CategoryTile value={f.category} src={itemPhotoSrc(f)} className="size-11" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[15px] font-bold">{f.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {[[f.brand?.name, f.model].filter(Boolean).join(" ") || "No model yet", f._count.parts ? plural(f._count.parts, "part") : null].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <ChevronRight className="cardarrow ml-auto size-5 text-muted-foreground" />
                    </Link>
                  ))
                ) : (
                  <Empty icon={<Lamp className="size-5" />} text="No fixtures in this room yet." />
                )}
                {canEdit ? (
                  <Link
                    href={`/fixtures?add=1&room=${room.id}`}
                    className="mt-3 flex min-h-11 items-center gap-2 self-start rounded-full border border-outline px-4 text-sm font-semibold hover:bg-surface2"
                  >
                    <Plus className="size-[18px]" />
                    Add Item Here
                  </Link>
                ) : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Paint and Finishes</CardTitle>
                <CardDescription>Colours and surfaces, with where the leftover tin is.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col">
                {finishes.length ? null : <Empty icon={<Paintbrush className="size-5" />} text="No paint or finishes yet." />}
                <FinishList rows={finishes} rooms={rooms} brands={brands.map((b) => b.name)} canEdit={canEdit} presetRoom={room.id} />
              </CardContent>
            </Card>
          </div>
        )}

        {room.kind !== "FLOOR" ? (
          <Card>
            <CardHeader>
              <CardTitle>Jobs</CardTitle>
              <CardDescription>Work done in this room, and what it cost.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col">
              {jobs.length ? (
                jobs.map((j) => (
                  <Link key={j.id} href={`/jobs/${j.id}`} className="lift group flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                    <span className="flex size-11 flex-none items-center justify-center rounded-full bg-t2">
                      <Hammer className="size-5" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-bold">{j.title}</span>
                      <span className="truncate text-xs text-muted-foreground">{[jobStatus(j.status).label, j.finishedAt ? date(j.finishedAt) : null].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="text-[15px] font-bold tabular-nums">{money(j.expenses.reduce((a, e) => a + Number(e.amount), 0))}</span>
                    <ChevronRight className="cardarrow size-5 text-muted-foreground" />
                  </Link>
                ))
              ) : (
                <Empty icon={<Hammer className="size-5" />} text="No jobs recorded for this room." />
              )}
              {canEdit ? (
                <Link href="/jobs?add=job" className="mt-3 flex min-h-11 items-center gap-2 self-start rounded-full border border-outline px-4 text-sm font-semibold hover:bg-surface2">
                  <Plus className="size-[18px]" />
                  Add Job
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Documents and Photos</CardTitle>
            <CardDescription>Filed to this room from Capture or Documents.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col">
            {room.links.length ? (
              room.links.map((l) => (
                <DocumentRow
                  key={l.id}
                  doc={l.document}
                  label={l.label}
                  trailing={canEdit ? <DocActions doc={editable(l.document)} /> : null}
                />
              ))
            ) : (
              <Empty icon={<FileText className="size-5" />} text="Nothing filed here yet. Use Capture to photograph something and file it to this room." />
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  )
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface2 px-4 py-3.5 text-sm text-muted-foreground">
      {icon}
      {text}
    </div>
  )
}
