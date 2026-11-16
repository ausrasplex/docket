"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ChevronDown, ChevronUp, Download, Minus, Plus, Search, X } from "lucide-react"
import type { PDFDocumentProxy, PDFPageProxy, TextLayer as TextLayerT } from "pdfjs-dist/legacy/build/pdf.mjs"
import { cn } from "cn"
import { Skeleton } from "@/components/ui/skeleton"
import { findAll, normQuery, pageText, type PageText, type TextItem } from "@/lib/pdf-find"

/**
 * Docket's PDF viewer (pdf.js): every page in one scrolling column, fitted to the width, with zoom, a page
 * counter, and Find (matches highlighted on the page; arrows or Enter step through them). Opened from a search
 * result it starts at that match: the `hit`-th match of `query` on `page`.
 */

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs")
type Size = { w: number; h: number }
type Match = { page: number; n: number }

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]
const ASSETS = "/pdfjs/"

let lib: Promise<PdfJs> | null = null
function pdfjs() {
  lib ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((m) => {
    m.GlobalWorkerOptions.workerSrc = `${ASSETS}pdf.worker.min.mjs`
    return m
  })
  return lib
}

const strItems = (items: unknown[]) => items.filter((x): x is TextItem => typeof x === "object" && x !== null && "str" in x)

export function PdfViewer({
  src,
  downloadHref,
  initialPage = 1,
  initialQuery = "",
  initialHit = 0,
}: {
  src: string
  downloadHref: string
  initialPage?: number
  initialQuery?: string
  initialHit?: number
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sizes, setSizes] = useState<Size[]>([])
  const [width, setWidth] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [current, setCurrent] = useState(1)
  const [pageEdit, setPageEdit] = useState<string | null>(null) // the page box while you type in it
  const [query, setQuery] = useState(initialQuery)
  const [texts, setTexts] = useState<(PageText | null)[]>([])
  const [active, setActive] = useState(-1)
  const [seek, setSeek] = useState(0) // bumped to scroll the active match into view
  const [findOpen, setFindOpen] = useState(!!initialQuery)

  const columnRef = useRef<HTMLDivElement>(null)
  const pageEls = useRef<(HTMLDivElement | null)[]>([])
  const [pendingHit, setPendingHit] = useState<Match | null>(initialQuery ? { page: initialPage, n: initialHit } : null)
  const findRef = useRef<HTMLInputElement>(null)

  // open the document, then every page's size (so the column doesn't jump as pages render)
  useEffect(() => {
    let cancelled = false
    let task: { destroy: () => Promise<void> } | null = null
    ;(async () => {
      try {
        const { getDocument } = await pdfjs()
        const t = getDocument({
          url: src,
          wasmUrl: `${ASSETS}wasm/`,
          cMapUrl: `${ASSETS}cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${ASSETS}standard_fonts/`,
          iccUrl: `${ASSETS}iccs/`,
        })
        task = t
        const loaded = await t.promise
        if (cancelled) return
        const first = (await loaded.getPage(1)).getViewport({ scale: 1 })
        setSizes(Array.from({ length: loaded.numPages }, () => ({ w: first.width, h: first.height })))
        setDoc(loaded)
        for (let i = 2; i <= loaded.numPages && !cancelled; i++) {
          const v = (await loaded.getPage(i)).getViewport({ scale: 1 })
          if (v.width !== first.width || v.height !== first.height) setSizes((s) => s.map((x, j) => (j === i - 1 ? { w: v.width, h: v.height } : x)))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error && e.name === "PasswordException" ? "This PDF is password protected." : "This PDF couldn't be opened.")
      }
    })()
    return () => {
      cancelled = true
      task?.destroy()
    }
  }, [src])

  // fit to the column's width
  useEffect(() => {
    const el = columnRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const widest = sizes.reduce((m, s) => Math.max(m, s.w), 0)
  const fit = widest && width ? Math.min(width / widest, 1.75) : 0
  const scale = fit * zoom

  // the page in the middle of the screen
  useEffect(() => {
    if (!doc) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const mid = window.innerHeight / 2
        let p = 1
        pageEls.current.forEach((el, i) => {
          if (el && el.getBoundingClientRect().top <= mid) p = i + 1
        })
        setCurrent(p)
      })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [doc, scale])

  const goToPage = useCallback((p: number, smooth = true) => {
    const el = pageEls.current[p - 1]
    if (!el) return
    const bar = document.querySelector<HTMLElement>("[data-pdf-toolbar]")
    const top = el.getBoundingClientRect().top + window.scrollY - (bar ? bar.getBoundingClientRect().bottom + 12 : 0)
    window.scrollTo({ top, behavior: smooth ? "smooth" : "instant" })
  }, [])

  // opened at a search result: go to its page straight away, before the matches are counted
  const jumped = useRef(false)
  useEffect(() => {
    if (!doc || !scale || jumped.current) return
    jumped.current = true
    if (initialPage > 1) requestAnimationFrame(() => goToPage(Math.min(initialPage, doc.numPages), false))
  }, [doc, scale, initialPage, goToPage])

  // Find: read every page's text once (only when something is searched)
  const needle = normQuery(query)
  const wantText = needle.length >= 2
  useEffect(() => {
    if (!doc || !wantText || texts.length) return
    let cancelled = false
    ;(async () => {
      const out: (PageText | null)[] = Array.from({ length: doc.numPages }, () => null)
      for (let i = 1; i <= doc.numPages && !cancelled; i++) {
        try {
          const page = await doc.getPage(i)
          out[i - 1] = pageText(strItems((await page.getTextContent()).items))
        } catch {
          out[i - 1] = null
        }
      }
      if (!cancelled) setTexts(out)
    })()
    return () => {
      cancelled = true
    }
  }, [doc, wantText, texts.length])

  const matches = useMemo<Match[]>(() => {
    if (!wantText) return []
    return texts.flatMap((t, i) => (t ? findAll(t.lower, needle).map((_, n) => ({ page: i + 1, n })) : []))
  }, [texts, needle, wantText])

  // a new search starts at the first match from the page you're on (or the search result's match)
  const [seen, setSeen] = useState(matches)
  if (seen !== matches) {
    setSeen(matches)
    if (!matches.length) setActive(-1)
    else {
      const want = pendingHit
      if (want) setPendingHit(null)
      let i = want ? matches.findIndex((m) => m.page === want.page && m.n === want.n) : -1
      if (i === -1 && want) i = matches.findIndex((m) => m.page >= want.page)
      if (i === -1) i = matches.findIndex((m) => m.page >= current)
      setActive(i === -1 ? 0 : i)
      setSeek((s) => s + 1)
    }
  }

  const step = (d: number) => {
    if (!matches.length) return
    setActive((a) => (a + d + matches.length) % matches.length)
    setSeek((s) => s + 1)
  }
  const activeMatch = active >= 0 ? matches[active] : null
  useEffect(() => {
    if (activeMatch && seek) goToPage(activeMatch.page)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a new seek only
  }, [seek])

  // Ctrl/Cmd+F opens Find instead of the browser's (which can't see unrendered pages)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault()
        setFindOpen(true)
        requestAnimationFrame(() => findRef.current?.select())
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const zoomBy = (d: number) => {
    const i = ZOOMS.findIndex((z) => z >= zoom - 1e-6)
    setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i === -1 ? ZOOMS.length - 1 : i) + d))])
  }

  return (
    <div className="flex flex-col gap-3">
      {/* toolbar: sticks under the top bar */}
      <div
        data-pdf-toolbar
        className="sticky top-[65px] z-10 -mx-4 flex flex-wrap items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] px-4 py-2 backdrop-blur-[16px] desk:top-[73px] desk:-mx-8 desk:px-8"
      >
        <form
          className="flex items-center gap-1.5 text-sm font-semibold"
          onSubmit={(e) => {
            e.preventDefault()
            const p = Number(pageEdit)
            if (doc && p >= 1 && p <= doc.numPages) goToPage(p)
            setPageEdit(null)
            ;(document.activeElement as HTMLElement | null)?.blur()
          }}
        >
          <input
            value={pageEdit ?? String(current)}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setPageEdit(e.target.value.replace(/\D/g, ""))}
            onBlur={() => setPageEdit(null)}
            inputMode="numeric"
            aria-label="Page"
            className="h-9 w-12 rounded-md border border-line bg-surface2 text-center text-base tabular-nums outline-none focus-visible:border-sel"
          />
          <span className="text-muted-foreground tabular-nums">of {doc?.numPages ?? "…"}</span>
        </form>

        <div className="flex items-center gap-1">
          <ToolButton label="Zoom out" onClick={() => zoomBy(-1)} disabled={zoom <= ZOOMS[0]}>
            <Minus className="size-4" />
          </ToolButton>
          <button type="button" onClick={() => setZoom(1)} className="h-9 min-w-14 rounded-full px-2 text-sm font-semibold tabular-nums hover:bg-surface2" aria-label="Fit to width">
            {Math.round(zoom * 100)}%
          </button>
          <ToolButton label="Zoom in" onClick={() => zoomBy(1)} disabled={zoom >= ZOOMS.at(-1)!}>
            <Plus className="size-4" />
          </ToolButton>
        </div>

        <div className="ml-auto flex items-center gap-1">
          {findOpen ? null : (
            <ToolButton
              label="Find in document"
              onClick={() => {
                setFindOpen(true)
                requestAnimationFrame(() => findRef.current?.focus())
              }}
            >
              <Search className="size-4" />
            </ToolButton>
          )}
          <a href={downloadHref} className="flex size-9 items-center justify-center rounded-full hover:bg-surface2" aria-label="Download" title="Download">
            <Download className="size-4" />
          </a>
        </div>

        {findOpen ? (
          <div className="flex w-full items-center gap-1.5 desk:order-none">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={findRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    step(e.shiftKey ? -1 : 1)
                  } else if (e.key === "Escape") {
                    setQuery("")
                    setFindOpen(false)
                  }
                }}
                placeholder="Find in document"
                aria-label="Find in document"
                className="h-10 w-full rounded-md border border-line bg-surface2 pr-3 pl-9 text-base outline-none focus-visible:border-sel focus-visible:ring-2 focus-visible:ring-sel-soft"
              />
            </div>
            <span className="min-w-16 text-center text-xs font-semibold text-muted-foreground tabular-nums" aria-live="polite">
              {!wantText ? "" : !texts.length ? "Finding…" : matches.length ? `${active + 1} of ${matches.length}` : "No matches"}
            </span>
            <ToolButton label="Previous match" onClick={() => step(-1)} disabled={!matches.length}>
              <ChevronUp className="size-4" />
            </ToolButton>
            <ToolButton label="Next match" onClick={() => step(1)} disabled={!matches.length}>
              <ChevronDown className="size-4" />
            </ToolButton>
            <ToolButton
              label="Close find"
              onClick={() => {
                setQuery("")
                setFindOpen(false)
              }}
            >
              <X className="size-4" />
            </ToolButton>
          </div>
        ) : null}
      </div>

      <div ref={columnRef} className="flex w-full flex-col items-center gap-3">
        {error ? (
          <p className="w-full rounded-[14px] bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
            {error}{" "}
            <a href={downloadHref} className="underline">
              Download it
            </a>{" "}
            to open it on your device.
          </p>
        ) : !doc || !scale ? (
          <Skeleton className="aspect-[1/1.414] w-full max-w-[860px] rounded-md" />
        ) : (
          sizes.map((s, i) => (
            <PdfPage
              key={i}
              ref={(el) => {
                pageEls.current[i] = el
              }}
              doc={doc}
              num={i + 1}
              size={s}
              scale={scale}
              needle={wantText ? needle : ""}
              text={texts[i] ?? null}
              activeN={activeMatch?.page === i + 1 ? activeMatch.n : -1}
              seek={activeMatch?.page === i + 1 ? seek : 0}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-9 flex-none items-center justify-center rounded-full hover:bg-surface2 disabled:pointer-events-none disabled:opacity-40"
    >
      {children}
    </button>
  )
}

/**
 * One page: drawn only while near the screen (and let go when far away, so long manuals don't use up a
 * phone's memory). A text layer on top makes the words selectable and places the Find highlights.
 */
const PdfPage = memo(function PdfPage({
  ref,
  doc,
  num,
  size,
  scale,
  needle,
  text,
  activeN,
  seek,
}: {
  ref: (el: HTMLDivElement | null) => void
  doc: PDFDocumentProxy
  num: number
  size: Size
  scale: number
  needle: string
  text: PageText | null
  activeN: number
  seek: number
}) {
  const box = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const layerRef = useRef<HTMLDivElement>(null)
  const textLayer = useRef<TextLayerT | null>(null)
  const [near, setNear] = useState(false)
  const [drawn, setDrawn] = useState(0) // counts text layer layouts, so highlights are placed again after each
  const [marks, setMarks] = useState<{ n: number; x: number; y: number; w: number; h: number }[]>([])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "1200px 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // draw the page and lay out its text
  useEffect(() => {
    const canvas = canvasRef.current
    const layer = layerRef.current
    if (!near || !canvas || !layer) return
    let cancelled = false
    let page: PDFPageProxy | null = null
    let task: { cancel: () => void; promise: Promise<void> } | null = null
    ;(async () => {
      try {
        page = await doc.getPage(num)
        if (cancelled) return
        const viewport = page.getViewport({ scale })
        const dpr = Math.min(window.devicePixelRatio || 1, 3)
        // keep very large zooms within what phones allow for one canvas
        const ratio = Math.min(dpr, Math.sqrt(16_000_000 / (viewport.width * viewport.height)))
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        task = page.render({ canvas, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined })
        await task.promise

        if (cancelled) return
        const { TextLayer } = await pdfjs()
        textLayer.current?.cancel()
        layer.replaceChildren()
        const tl = new TextLayer({ textContentSource: await page.getTextContent(), container: layer, viewport })
        textLayer.current = tl
        await tl.render()
        if (!cancelled) setDrawn((n) => n + 1)
      } catch {
        // cancelled (scrolled away or zoomed); a newer draw takes over
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
      textLayer.current?.cancel()
    }
  }, [near, doc, num, scale])

  // let go of pages far from the screen
  useEffect(() => {
    if (near) return
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = 0
      canvas.height = 0
    }
    layerRef.current?.replaceChildren()
    textLayer.current = null
  }, [near])

  // place the highlights over the words that match
  useEffect(() => {
    const layer = layerRef.current
    const el = box.current
    const tl = textLayer.current
    if (!near || !layer || !el || !tl || !drawn || !needle || !text) return setMarks([])
    const divs = tl.textDivs
    const origin = el.getBoundingClientRect()
    const out: typeof marks = []
    findAll(text.lower, needle).forEach((at, n) => {
      // the matched characters, item by item (a match can run across several)
      const spans = new Map<number, [number, number]>()
      for (let i = at; i < at + needle.length; i++) {
        const it = text.item[i]
        if (it < 0) continue
        const o = text.off[i]
        const r = spans.get(it)
        spans.set(it, r ? [Math.min(r[0], o), Math.max(r[1], o + 1)] : [o, o + 1])
      }
      for (const [it, [a, b]] of spans) {
        const node = divs[it]?.firstChild
        if (!node || node.nodeType !== Node.TEXT_NODE) continue
        const range = document.createRange()
        range.setStart(node, Math.min(a, node.textContent!.length))
        range.setEnd(node, Math.min(b, node.textContent!.length))
        for (const r of range.getClientRects()) out.push({ n, x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height })
      }
    })
    setMarks(out)
  }, [needle, text, drawn, near])

  // bring the current match into view
  const activeEl = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    if (!seek || activeN < 0) return
    const t = setTimeout(() => activeEl.current?.scrollIntoView({ block: "center", behavior: "smooth" }), 350)
    return () => clearTimeout(t)
  }, [seek, activeN, marks])

  const w = Math.floor(size.w * scale)
  const h = Math.floor(size.h * scale)
  const firstActive = marks.findIndex((m) => m.n === activeN)
  return (
    <div
      ref={(el) => {
        box.current = el
        ref(el)
      }}
      data-page={num}
      className="relative flex-none overflow-hidden rounded-[4px] bg-white shadow-[0_1px_3px_rgb(0_0_0/0.12),0_4px_16px_rgb(0_0_0/0.06)]"
      style={{ width: w, height: h, "--scale-factor": scale, "--total-scale-factor": scale, "--scale-round-x": "1px", "--scale-round-y": "1px" } as React.CSSProperties}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" aria-label={`Page ${num}`} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-[1]">
        {marks.map((m, i) => {
          const on = m.n === activeN
          return (
            <span
              key={i}
              ref={i === firstActive ? activeEl : undefined}
              className={cn("absolute rounded-[2px] mix-blend-multiply", on ? "bg-[#ff9f1a]/70 ring-2 ring-[#ff9f1a]" : "bg-[#ffd84d]/60")}
              style={{ left: m.x - 1, top: m.y - 1, width: m.w + 2, height: m.h + 2 }}
            />
          )
        })}
      </div>
      <div ref={layerRef} className="pdf-text" />
      <span className="sr-only">Page {num}</span>
    </div>
  )
})
