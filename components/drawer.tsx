"use client"

import { useSyncExternalStore } from "react"
import { X } from "lucide-react"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"

const DESK = "(min-width: 861px)"
function subscribe(cb: () => void) {
  const mq = window.matchMedia(DESK)
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}
const useDesktop = () => useSyncExternalStore(subscribe, () => window.matchMedia(DESK).matches, () => true)

/**
 * Folio's drawer, used for everything that adds or edits: a 380px panel from the right on desktop,
 * a bottom sheet on phones. Heading with a round X; the footer (main action) is pinned to the bottom.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const desktop = useDesktop()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={desktop ? "right" : "bottom"} showCloseButton={false} className="gap-0 p-0">
        {desktop ? null : <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 flex-none rounded-full bg-outline" />}
        <div className="flex items-center gap-2 px-5 pt-4 pb-2 desk:px-6 desk:pt-6">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <SheetTitle className="text-lg font-bold text-ink">{title}</SheetTitle>
            {description ? <SheetDescription className="text-[13px] text-muted-foreground">{description}</SheetDescription> : null}
          </div>
          <SheetClose className="flex size-10 flex-none cursor-pointer items-center justify-center self-start rounded-full border border-line bg-surface2 text-muted-foreground hover:bg-[color-mix(in_srgb,var(--ink)_10%,var(--surface2))] hover:text-ink">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </SheetClose>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-3 desk:px-6">{children}</div>
        {footer ? (
          <div className="sticky bottom-0 flex gap-2.5 border-t border-line bg-surface px-5 pt-3 pb-5 desk:px-6 desk:pb-6 [&>*]:flex-1">{footer}</div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

/** A labelled form field in Folio's style (13px bold muted label over a 48px input). */
export function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  // the hint sits outside the <label>, so the field's accessible name is just the label
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-muted-foreground">{label}</span>
        {children}
      </label>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  )
}

/** One choice in a list of options (Folio's "sheetopt"): selected gets the sel-coloured outline. */
export function OptionRow({
  selected,
  onSelect,
  title,
  detail,
  icon,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  detail?: string
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={
        "flex min-h-15 w-full cursor-pointer items-center gap-3 rounded-xl border-2 bg-surface2 px-3.5 py-2.5 text-left hover:bg-t1 " +
        (selected ? "border-sel" : "border-transparent")
      }
    >
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-sm font-bold">{title}</b>
        {detail ? <span className="text-xs font-medium text-muted-foreground">{detail}</span> : null}
      </span>
    </button>
  )
}
