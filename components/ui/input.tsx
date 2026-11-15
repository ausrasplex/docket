import * as React from "react"
import { cn } from "cn"

// Folio inputs: 48px tall, 12px radius, surface2 fill, 16px text so phones don't zoom on focus.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-md border border-line bg-surface2 px-3.5 text-base text-ink transition-colors outline-none file:mr-3 file:inline-flex file:h-8 file:rounded-full file:border-0 file:bg-surface file:px-3 file:text-sm file:font-semibold file:text-ink placeholder:text-muted-foreground focus-visible:border-sel focus-visible:ring-2 focus-visible:ring-sel-soft disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger-soft",
        className
      )}
      {...props}
    />
  )
}

export { Input }
