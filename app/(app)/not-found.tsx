import Link from "next/link"
import { SearchX } from "lucide-react"
import { PageBody, PageHeader } from "@/components/shell/page-header"
import { Button } from "@/components/ui/button"

/** Shown inside the app when a room, item, job or page doesn't exist (or was renamed, so its address changed). */
export default function NotFound() {
  return (
    <>
      <PageHeader title="Not Found" />
      <PageBody>
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-surface px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-t1 text-ink">
            <SearchX className="size-6" />
          </span>
          <h2>Nothing Here</h2>
          <p className="max-w-sm text-sm font-medium text-muted-foreground">
            This page doesn&apos;t exist. If it was a room, item or job, it may have been renamed, which changes its address.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2.5">
            <Button asChild variant="outline">
              <Link href="/rooms">Rooms</Link>
            </Button>
            <Button asChild>
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>
      </PageBody>
    </>
  )
}
