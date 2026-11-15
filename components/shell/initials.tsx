import { cn } from "cn"

const TONES = ["bg-a1", "bg-a2", "bg-a3"]

/** Folio avatars: a circle in an accent colour with the person's initials. */
export function Initials({ name, size = 36, className }: { name: string; size?: number; className?: string }) {
  const parts = name.trim().split(/\s+/)
  const ini = ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase() || "?"
  const tone = TONES[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % TONES.length]
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex flex-none items-center justify-center rounded-full font-bold text-on-a", tone, className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {ini}
    </span>
  )
}
