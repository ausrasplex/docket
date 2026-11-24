"use client"

import { useRef, useState } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/** navigator.clipboard needs https (or localhost); on a plain-http LAN address fall back to the old copy command. */
async function copy(text: string) {
  if (window.isSecureContext && navigator.clipboard) return navigator.clipboard.writeText(text)
  const t = document.createElement("textarea")
  t.value = text
  t.setAttribute("readonly", "")
  t.style.cssText = "position:fixed;opacity:0;pointer-events:none"
  document.body.appendChild(t)
  t.select()
  const ok = document.execCommand("copy")
  t.remove()
  if (!ok) throw new Error("copy failed")
}

/** A value (a model or serial number) that copies itself when tapped, with a copy icon beside it. */
export function CopyText({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const go = async () => {
    try {
      await copy(value)
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1500)
      toast(`${label} copied`)
    } catch {
      toast.error(`Couldn't copy the ${label.toLowerCase()}`)
    }
  }
  const Icon = copied ? Check : Copy
  return (
    <button
      type="button"
      onClick={go}
      title={`Copy ${label.toLowerCase()}`}
      aria-label={`${value}. Copy ${label.toLowerCase()}`}
      className={cn(
        "group -mx-1.5 -my-0.5 inline-flex max-w-full cursor-copy items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left hover:bg-surface2 focus-visible:bg-surface2 focus-visible:outline-none",
        className,
      )}
    >
      <span className="min-w-0 break-all">{value}</span>
      <Icon
        aria-hidden
        className={cn(
          "size-3.5 flex-none transition-opacity",
          copied ? "text-[var(--sel)] opacity-100" : "text-muted-foreground opacity-50 group-hover:opacity-100 group-focus-visible:opacity-100",
        )}
      />
    </button>
  )
}
