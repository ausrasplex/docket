import { requireHousehold } from "@/lib/dal"
import { atLeast } from "@/lib/roles"

/** Shows its children (a page's add buttons) only to people who can edit. Wrap it in Suspense. */
export async function MemberOnly({ children }: { children: React.ReactNode }) {
  const c = await requireHousehold()
  return atLeast(c.role, "MEMBER") ? <div className="flex flex-none items-center gap-2">{children}</div> : null
}
