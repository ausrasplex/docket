import { ChevronRight, ExternalLink } from "lucide-react"
import { docHref, docKind, LINK_ICON, opensInApp } from "@/lib/documents"
import { bytes, date } from "@/lib/format"
import type { DocumentKind } from "@/generated/prisma/enums"

export type DocLike = {
  id: string
  title: string
  kind: DocumentKind
  url: string | null
  thumbnailKey: string | null
  mimeType: string | null
  sizeBytes: number | null
  documentDate: Date | null
  createdAt: Date
}

/** A document in a list: preview or icon, title, kind · date · size, opening the file or link. */
export function DocumentRow({ doc, label, trailing }: { doc: DocLike; label?: string | null; trailing?: React.ReactNode }) {
  const k = docKind(doc.kind)
  const Icon = doc.url ? LINK_ICON : k.icon
  const meta = [label, k.label, date(doc.documentDate ?? doc.createdAt), doc.url ? new URL(doc.url).hostname.replace(/^www\./, "") : bytes(doc.sizeBytes)]
    .filter(Boolean)
    .join(" · ")
  return (
    <div className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
      <a href={docHref(doc)} {...(opensInApp(doc) ? {} : { target: "_blank", rel: "noopener noreferrer" })} className="lift group flex min-w-0 flex-1 items-center gap-3">
        {doc.thumbnailKey ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file; not for next/image
          <img src={`/api/files/${doc.id}?v=thumb`} alt="" className="size-11 flex-none rounded-xl object-cover" loading="lazy" />
        ) : (
          <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-surface2">
            <Icon className="size-5" />
          </span>
        )}
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-bold">{doc.title}</span>
          <span className="truncate text-xs font-medium text-muted-foreground">{meta}</span>
        </span>
        {opensInApp(doc) ? (
          <ChevronRight className="cardarrow ml-auto size-4 flex-none text-muted-foreground" />
        ) : (
          <ExternalLink className="cardarrow ml-auto size-4 flex-none text-muted-foreground" />
        )}
      </a>
      {trailing}
    </div>
  )
}
