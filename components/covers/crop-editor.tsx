"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Move, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import type { Crop } from "@/lib/crop"
import { saveCoverCrop } from "@/app/(app)/covers/actions"

const MAX_ZOOM = 4
/** How far past the photo the crop can reach when zoomed out: its longer side times this, padded with white. */
const ROOM = 1.25

/** The smallest zoom: the whole photo fits with a white margin around it. */
const minZoom = (n: { w: number; h: number }) => Math.min(n.w, n.h) / (Math.max(n.w, n.h) * ROOM)

/**
 * Where the square crop sits, in the photo's own pixels: its centre and its zoom (1 = the largest square inside
 * the photo; below 1 the square reaches past the photo's edges and the gap is filled with white).
 */
type View = { cx: number; cy: number; z: number }

/**
 * The crop screen for a room's or item's photo: a square frame the photo is dragged and zoomed inside (mouse, touch,
 * pinch, wheel or keyboard), with previews of the room's tile at its real sizes. Saving sends the crop as
 * fractions of the photo; the server cuts a sharp copy from the full-size original.
 */
export function CropEditor({
  kind,
  id,
  name,
  backHref,
  imageUrl,
  initial,
}: {
  kind: "space" | "fixture"
  id: string
  name: string
  /** where Save and Cancel go: the room's or item's page */
  backHref: string
  imageUrl: string
  initial: Crop | null
}) {
  const router = useRouter()
  const frame = useRef<HTMLDivElement>(null)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [size, setSize] = useState(320) // the frame's width in CSS pixels
  const [view, setView] = useState<View | null>(null)
  const [active, setActive] = useState(false)
  const [pending, start] = useTransition()
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; z: number } | null>(null)

  // the frame follows the page width (square, up to 440px)
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const side = (v: View, n: { w: number; h: number }) => Math.min(n.w, n.h) / v.z

  /**
   * Keeps the zoom within range and the crop where it shows the most photo: inside the photo along a side the
   * square is shorter than, and around the photo (never cutting it off) along a side it's longer than.
   */
  const clamp = useCallback((v: View, n: { w: number; h: number }): View => {
    const z = Math.min(MAX_ZOOM, Math.max(minZoom(n), v.z))
    const s = Math.min(n.w, n.h) / z
    const fit = (c: number, len: number) => {
      const [a, b] = [s / 2, len - s / 2]
      return Math.min(Math.max(a, b), Math.max(Math.min(a, b), c))
    }
    return { z, cx: fit(v.cx, n.w), cy: fit(v.cy, n.h) }
  }, [])

  const centred = (n: { w: number; h: number }): View => ({ cx: n.w / 2, cy: n.h / 2, z: 1 })

  const img = useRef<HTMLImageElement>(null)
  const loaded = useRef(false)

  function ready(el: HTMLImageElement) {
    if (loaded.current || !el.naturalWidth) return
    loaded.current = true
    const n = { w: el.naturalWidth, h: el.naturalHeight }
    setNat(n)
    if (initial) {
      const s = initial.width * n.w
      setView(clamp({ cx: initial.left * n.w + s / 2, cy: initial.top * n.h + (initial.height * n.h) / 2, z: Math.min(n.w, n.h) / s }, n))
    } else setView(centred(n))
  }

  // a cached photo can finish loading before React attaches onLoad (server-rendered <img>), so check once mounted
  useEffect(() => {
    if (img.current?.complete) ready(img.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  /** Zooms to `z`, keeping the photo point under (px, py) (frame pixels) where it is. */
  const zoomAt = useCallback(
    (z: number, px = size / 2, py = size / 2) => {
      if (!nat) return
      setView((v) => {
        if (!v) return v
        const k = size / side(v, nat)
        const ix = v.cx + (px - size / 2) / k
        const iy = v.cy + (py - size / 2) / k
        const nv = { ...v, z }
        const k2 = size / side(clamp(nv, nat), nat)
        return clamp({ z, cx: ix - (px - size / 2) / k2, cy: iy - (py - size / 2) / k2 }, nat)
      })
    },
    [nat, size, clamp]
  )

  const pan = (dx: number, dy: number) => {
    if (!nat) return
    setView((v) => {
      if (!v) return v
      const k = size / side(v, nat)
      return clamp({ ...v, cx: v.cx - dx / k, cy: v.cy - dy / k }, nat)
    })
  }

  // ── pointer: one finger or the mouse drags; two fingers pinch ──
  const local = (e: React.PointerEvent) => {
    const r = frame.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, local(e))
    setActive(true)
    if (pointers.current.size === 2 && view) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), z: view.z }
    }
  }
  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const now = local(e)
    pointers.current.set(e.pointerId, now)
    if (pointers.current.size === 1) pan(now.x - prev.x, now.y - prev.y)
    else if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      zoomAt(pinch.current.z * (dist / pinch.current.dist), (a.x + b.x) / 2, (a.y + b.y) / 2)
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (!pointers.current.size) setActive(false)
  }

  // wheel zoom (needs a non-passive listener to stop the page scrolling)
  useEffect(() => {
    const el = frame.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt((view?.z ?? 1) * Math.exp(-e.deltaY / 400), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [zoomAt, view?.z])

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 40 : 10
    const keys: Record<string, () => void> = {
      ArrowLeft: () => pan(step, 0),
      ArrowRight: () => pan(-step, 0),
      ArrowUp: () => pan(0, step),
      ArrowDown: () => pan(0, -step),
      "+": () => zoomAt((view?.z ?? 1) * 1.1),
      "=": () => zoomAt((view?.z ?? 1) * 1.1),
      "-": () => zoomAt((view?.z ?? 1) / 1.1),
    }
    if (keys[e.key]) {
      e.preventDefault()
      keys[e.key]()
    }
  }

  // the photo's size and position inside the frame
  const k = nat && view ? size / side(view, nat) : 1
  const imgStyle: React.CSSProperties | undefined =
    nat && view
      ? { width: nat.w * k, height: nat.h * k, transform: `translate(${size / 2 - view.cx * k}px, ${size / 2 - view.cy * k}px)` }
      : undefined

  const crop = (): Crop | null => {
    if (!nat || !view) return null
    const s = side(view, nat)
    return { left: (view.cx - s / 2) / nat.w, top: (view.cy - s / 2) / nat.h, width: s / nat.w, height: s / nat.h }
  }

  const save = () =>
    start(async () => {
      const c = crop()
      if (!c) return
      const r = await saveCoverCrop(kind, id, c)
      if (!r.ok) return void toast.error(r.error)
      toast("Photo cropped")
      router.push(backHref)
    })

  return (
    <div className="grid grid-cols-1 items-start gap-5 desk:grid-cols-[minmax(0,440px)_1fr]">
      <div className="flex flex-col gap-4">
        <div
          ref={frame}
          role="application"
          tabIndex={0}
          aria-label={`Crop for ${name}. Drag to move the photo, pinch or scroll to zoom. Arrow keys move it, plus and minus zoom.`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          className={cn(
            "relative aspect-square w-full touch-none overflow-hidden rounded-3xl select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sel",
            active ? "cursor-grabbing" : "cursor-grab",
            view ? "bg-white" : "bg-hero"
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file */}
          <img ref={img} src={imageUrl} alt="" draggable={false} onLoad={(e) => ready(e.currentTarget)} className="absolute top-0 left-0 max-w-none" style={imgStyle ?? { opacity: 0 }} />
          {!view ? (
            <span className="absolute inset-0 flex items-center justify-center text-hero-muted">
              <Loader2 className="size-8 animate-spin" />
            </span>
          ) : null}
          {/* rule-of-thirds guides while moving */}
          <span
            aria-hidden="true"
            className={cn("pointer-events-none absolute inset-0 transition-opacity duration-150", active ? "opacity-100" : "opacity-0")}
            style={{
              backgroundImage:
                "linear-gradient(to right, transparent calc(33.333% - 0.5px), rgba(255,255,255,.55) calc(33.333% - 0.5px), rgba(255,255,255,.55) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), rgba(255,255,255,.55) calc(66.666% - 0.5px), rgba(255,255,255,.55) calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px)), linear-gradient(to bottom, transparent calc(33.333% - 0.5px), rgba(255,255,255,.55) calc(33.333% - 0.5px), rgba(255,255,255,.55) calc(33.333% + 0.5px), transparent calc(33.333% + 0.5px), transparent calc(66.666% - 0.5px), rgba(255,255,255,.55) calc(66.666% - 0.5px), rgba(255,255,255,.55) calc(66.666% + 0.5px), transparent calc(66.666% + 0.5px))",
            }}
          />
          {!active && view ? (
            <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white">
              <Move className="size-3.5" />
              Drag to move
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom out" disabled={!view || !nat || view.z <= minZoom(nat) + 0.001} onClick={() => zoomAt((view?.z ?? 1) / 1.25)}>
            <ZoomOut />
          </Button>
          <input
            type="range"
            aria-label="Zoom"
            min={nat ? minZoom(nat) : 1}
            max={MAX_ZOOM}
            step={0.01}
            value={view?.z ?? 1}
            disabled={!view}
            onChange={(e) => zoomAt(Number(e.target.value))}
            className="h-11 flex-1 cursor-pointer accent-[var(--sel)]"
          />
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Zoom in" disabled={!view || view.z >= MAX_ZOOM} onClick={() => zoomAt((view?.z ?? 1) * 1.25)}>
            <ZoomIn />
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!nat} onClick={() => nat && setView(centred(nat))}>
            <RotateCcw />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
          <h2>How It Looks</h2>
          <p className="-mt-2 text-sm text-muted-foreground">The room&apos;s tile, at the sizes Docket shows it.</p>
          <div className="flex items-center gap-3.5 rounded-3xl bg-bg p-4">
            <Preview px={48} src={imageUrl} nat={nat} view={view} />
            <span className="flex flex-col">
              <span className="text-[15px] font-bold">{name}</span>
              <span className="text-xs text-muted-foreground">On the Rooms list</span>
            </span>
          </div>
          <div className="flex items-end gap-4">
            <Preview px={64} src={imageUrl} nat={nat} view={view} />
            <Preview px={96} src={imageUrl} nat={nat} view={view} className="rounded-3xl" />
          </div>
        </section>
        <div className="flex gap-2.5 [&>*]:flex-1 desk:[&>*]:flex-none">
          <Button type="button" variant="outline" onClick={() => router.push(backHref)}>
            Cancel
          </Button>
          <Button type="button" disabled={pending || !view} onClick={save}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Save Crop
          </Button>
        </div>
      </div>
    </div>
  )
}

/** A small live copy of the crop for the previews (the same maths at a different frame size). */
function Preview({ px, src, nat, view, className }: { px: number; src: string; nat: { w: number; h: number } | null; view: View | null; className?: string }) {
  const k = nat && view ? px / (Math.min(nat.w, nat.h) / view.z) : 1
  return (
    <span className={cn("relative block flex-none overflow-hidden rounded-2xl", nat && view ? "bg-white" : "bg-surface2", className)} style={{ width: px, height: px }}>
      {nat && view ? (
        // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked file
        <img
          src={src}
          alt=""
          draggable={false}
          className="absolute top-0 left-0 max-w-none"
          style={{ width: nat.w * k, height: nat.h * k, transform: `translate(${px / 2 - view.cx * k}px, ${px / 2 - view.cy * k}px)` }}
        />
      ) : null}
    </span>
  )
}
