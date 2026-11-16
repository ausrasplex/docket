import { Suspense } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { PageBody, PageTitle } from "@/components/shell/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { PdfViewer } from "@/components/pdf/pdf-viewer"
import { db } from "@/lib/db"
import { requireHousehold } from "@/lib/dal"
import { docHref } from "@/lib/documents"

export const metadata = { title: "Document · Docket" }

/**
 * A PDF in Docket's own viewer. ?page, ?q and ?hit open it at a search match; ?back is where the back button
 * goes (otherwise the record it's filed to).
 */
export default function ViewDocumentPage({ params, searchParams }: PageProps<"/documents/[id]/view">) {
  return (
    <Suspense
      fallback={
        <PageBody>
          <Skeleton className="mt-6 aspect-[1/1.414] w-full max-w-[860px] self-center rounded-md" />
        </PageBody>
      }
    >
      <Body params={params} searchParams={searchParams} />
    </Suspense>
  )
}

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

async function Body({ params, searchParams }: Pick<PageProps<"/documents/[id]/view">, "params" | "searchParams">) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  const c = await requireHousehold()
  const d = await db.document.findFirst({
    where: { id, householdId: c.householdId },
    select: {
      id: true,
      title: true,
      url: true,
      mimeType: true,
      storageKey: true,
      links: {
        take: 1,
        orderBy: { createdAt: "asc" },
        select: { fixtureId: true, jobId: true, space: { select: { slug: true } }, expense: { select: { jobId: true } } },
      },
    },
  })
  if (!d) notFound()
  // links and photos aren't for this viewer
  if (d.mimeType !== "application/pdf" || !d.storageKey) redirect(docHref(d))

  const l = d.links[0]
  const fallback = l?.fixtureId
    ? `/fixtures/${l.fixtureId}`
    : l?.space
      ? `/rooms/${l.space.slug}`
      : l?.jobId
        ? `/jobs/${l.jobId}`
        : l?.expense?.jobId
          ? `/jobs/${l.expense.jobId}`
          : "/documents"
  const want = one(sp.back)
  const back = want.startsWith("/") && !want.startsWith("//") && !want.startsWith("/\\") ? want : fallback
  const page = Math.max(1, Math.floor(Number(one(sp.page))) || 1)
  const hit = Math.max(0, Math.floor(Number(one(sp.hit))) || 0)
  const q = one(sp.q).slice(0, 200)

  return (
    <>
      <PageTitle className="pb-3">
        <Link href={back} aria-label="Back" className="flex size-11 flex-none items-center justify-center rounded-full bg-surface hover:bg-surface2">
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate">{d.title}</h1>
      </PageTitle>
      <PageBody className="max-w-[1100px] gap-0">
        <PdfViewer key={`${d.id}:${page}:${hit}:${q}`} src={`/api/files/${d.id}`} downloadHref={`/api/files/${d.id}?download=1`} initialPage={page} initialQuery={q} initialHit={hit} />
      </PageBody>
    </>
  )
}
