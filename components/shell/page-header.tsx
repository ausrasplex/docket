import { cn } from "cn"

/**
 * Folio's page heading: sits under the sticky top bar and scrolls with the page. The title row is
 * always 44px tall so titles line up on pages with and without buttons; 20px separates it from the content.
 */
export function PageTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex min-h-11 w-full max-w-[1100px] items-center gap-2.5 pt-3 pb-5 box-content", className)}>{children}</div>
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-1.5 pt-3 pb-5">
      <div className={cn("flex min-h-11 items-center gap-2.5", className)}>
        <h1 className="min-w-0 flex-1 break-words">{title}</h1>
        {actions}
      </div>
      {subtitle ? <p className="text-sm font-medium text-muted-foreground">{subtitle}</p> : null}
    </div>
  )
}

export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mx-auto flex max-w-[1100px] flex-col gap-5", className)}>{children}</div>
}
