"use client"

import { useState } from "react"
import { Check, Copy, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Shows a link once with Copy (and Share on phones), for invite and reset links. */
export function CopyField({ value, shareTitle }: { value: string; shareTitle: string }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== "undefined" && "share" in navigator
  return (
    <div className="flex flex-col gap-2.5">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="h-12 w-full rounded-md border border-line bg-surface2 px-3.5 font-mono text-sm text-ink"
      />
      <div className="flex gap-2.5 [&>*]:flex-1">
        <Button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy Link"}
        </Button>
        {canShare ? (
          <Button type="button" variant="outline" onClick={() => navigator.share({ title: shareTitle, url: value }).catch(() => {})}>
            <Share2 />
            Share
          </Button>
        ) : null}
      </div>
    </div>
  )
}
