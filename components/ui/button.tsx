import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

// Folio buttons: fully rounded, flat (no shadow), 14px/600, icon before the label.
// Hover on filled buttons darkens with an inset wash of the ink colour; outlined ones fill with surface2.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border border-transparent text-sm font-semibold whitespace-nowrap outline-none select-none disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:shadow-[inset_0_0_0_999px_color-mix(in_srgb,var(--primaryInk)_14%,transparent)]",
        outline:
          "border-outline bg-transparent text-ink hover:bg-surface2 aria-expanded:bg-surface2",
        secondary: "bg-surface2 text-ink hover:bg-[color-mix(in_srgb,var(--ink)_7%,var(--surface2))]",
        ghost: "text-ink hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] aria-expanded:bg-surface2",
        destructive: "border-danger bg-transparent text-danger hover:bg-danger-soft",
        "destructive-solid":
          "bg-danger text-white hover:shadow-[inset_0_0_0_999px_rgba(0,0,0,.12)] dark:text-[#1a1a1a]",
        add: "bg-add text-add-ink hover:shadow-[inset_0_0_0_999px_color-mix(in_srgb,var(--hero)_10%,transparent)]",
        link: "rounded-md px-1 text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-12 px-6",
        sm: "min-h-11 px-4",
        xs: "min-h-9 px-3 text-xs [&_svg:not([class*='size-'])]:size-4",
        lg: "min-h-12 px-7",
        icon: "size-11 p-0",
        "icon-sm": "size-10 p-0",
        "icon-xs": "size-8 p-0 [&_svg:not([class*='size-'])]:size-4",
        "icon-lg": "size-14 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
