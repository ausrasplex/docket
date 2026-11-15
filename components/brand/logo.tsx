import Image from "next/image"
import { cn } from "cn"
import mark from "@/public/brand/mark-96.png"

/**
 * Docket mark: the user's artwork (a "D" in lilac, peach and lime on the dark #2b2849 tile).
 * The tile and its rounded corners are part of the image, so it needs no background here.
 * Source file: brand/docket.png (2133px square).
 */
export function Mark({ size = 32, className }: { size?: number; className?: string }) {
  return <Image src={mark} alt="" aria-hidden="true" width={size} height={size} className={cn("flex-none", className)} priority />
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink", className)}>
      <Mark />
      Docket
    </span>
  )
}
