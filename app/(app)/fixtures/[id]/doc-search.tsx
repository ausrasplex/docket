"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronRight, FileText, Search, X } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { normQuery } from "@/lib/pdf-find"
import { searchFixtureDocs, type DocSearch } from "../doc-search-actions"

/**
 * Search inside this item's documents. While there's a search, its matches replace the list below: one row
 * per match (document, page, the words around it), each opening the viewer at that match. The search is kept
 * in the address (?docq=) so coming back from the viewer shows the same results.
 */
export function DocSearchBox({ fixtureId, children }: { fixtureId: string; children: React.ReactNode }) {
  const params = useSearchParams()
  const [q, setQ] = useState(() => params.get("docq") ?? "")
  const [res, setRes] = useState<DocSearch | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const seq = useRef(0)
  const needle = normQuery(q)
  const active = needle.length >= 2

  useEffect(() => {
    // keep the search in the address without a navigation
    const url = new URL(window.location.href)
    if (q.trim()) url.searchParams.set("docq", q.trim())
    else url.searchParams.delete("docq")
    if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url)

    if (!active) return
    const n = ++seq.current
    const t = setTimeout(async () => {
      setBusy(true)
      try {
        const r = await searchFixtureDocs(fixtureId, q)
        if (n === seq.current) {
          setRes(r)
          setFailed(false)
        }
      } catch {
        if (n === seq.current) setFailed(true)
      } finally {
        if (n === seq.current) setBusy(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [q, active, fixtureId])

  // back from the viewer: bring the results into view
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.location.hash === "#documents" && params.get("docq")) box.current?.scrollIntoView({ block: "start" })
  }, [params])

  const shown = active && res ? res : null
  return (
    <div ref={box} className="flex scroll-mt-24 flex-col gap-3">
      <div role="search" className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setQ("")
          }}
          placeholder="Search inside these documents"
          aria-label="Search inside these documents"
          className="h-12 w-full rounded-md border border-line bg-surface2 pr-11 pl-10 text-base text-ink outline-none placeholder:text-muted-foreground focus-visible:border-sel focus-visible:ring-2 focus-visible:ring-sel-soft [&::-webkit-search-cancel-button]:hidden"
        />
        {q ? (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-1.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-surface"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {!active ? (
        children
      ) : failed ? (
        <p className="text-sm font-medium text-danger">The search didn&apos;t work. Try again.</p>
      ) : !shown ? (
        <div className="flex flex-col gap-2" aria-label="Searching">
          <p className="text-[13px] font-medium text-muted-foreground">Searching… (the first search reads each PDF, which can take a moment)</p>
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : (
        <div className="flex flex-col" aria-busy={busy}>
          <p className="pb-1 text-[13px] font-medium text-muted-foreground" aria-live="polite">
            {shown.hits.length
              ? `${shown.more ? "The first " : ""}${shown.hits.length === 1 ? "1 match" : `${shown.hits.length} matches`}`
              : "No matches in these documents."}
            {shown.unreadable
              ? ` ${shown.unreadable === 1 ? "1 PDF has" : `${shown.unreadable} PDFs have`} no searchable text (scanned pages), so ${shown.unreadable === 1 ? "it isn't" : "they aren't"} included.`
              : null}
          </p>
          <ul className="flex flex-col">
            {shown.hits.map((h) => (
              <li key={h.key} className="border-t border-line first:border-t-0">
                <Link
                  href={h.href}
                  {...(h.href.startsWith("/") ? {} : { target: "_blank", rel: "noopener noreferrer" })}
                  className="lift group flex items-center gap-3 py-3"
                >
                  <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-surface2">
                    <FileText className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-xs font-semibold text-muted-foreground">
                      {h.title}
                      {h.page ? ` · Page ${h.page}` : " · Title"}
                    </span>
                    <span className="line-clamp-2 text-sm font-medium text-ink">
                      {h.before}
                      <mark className="rounded-[3px] bg-[color-mix(in_srgb,#ffd84d_55%,transparent)] px-0.5 font-bold text-ink">{h.match}</mark>
                      {h.after}
                    </span>
                  </span>
                  <ChevronRight className="cardarrow size-4 flex-none text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
