import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Folio-style first-run card: what goes here and one way to start. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode
  title: string
  body: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface px-6 py-12 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-t1 text-ink">{icon}</span>
      <h2>{title}</h2>
      <p className="max-w-sm text-sm font-medium text-muted-foreground">{body}</p>
      {action ? (
        <Button asChild variant="add" className="mt-2 addpulse">
          <Link href={action.href}>
            <Plus />
            {action.label}
          </Link>
        </Button>
      ) : null}
    </div>
  )
}
