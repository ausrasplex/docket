import { cn } from "cn"

/**
 * Folio's sticky top bar: page background at 72% with a backdrop blur and a 1px underline.
 * The title row is always 44px tall so titles don't shift between pages with and without an action.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 mb-2 border-b border-line bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] px-4 py-2.5 backdrop-blur-[16px] backdrop-saturate-[1.4] desk:-mx-8 desk:px-8 desk:py-3.5">
        <div className={cn("mx-auto flex min-h-11 max-w-[1100px] items-center gap-2.5", className)}>
          <h1 className="min-w-0 flex-1 truncate">{title}</h1>
          {actions}
        </div>
      </div>
      {subtitle ? <p className="mx-auto mb-5 max-w-[1100px] text-sm font-medium text-muted-foreground">{subtitle}</p> : null}
    </>
  )
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex max-w-[1100px] flex-col gap-5 pt-3", className)}>{children}</div>
}
