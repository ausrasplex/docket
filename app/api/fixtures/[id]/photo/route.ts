import { getSession } from "@/lib/dal"
import { coverResponse } from "@/lib/cover"

/** An item's (or part's) photo for its tile (members of its household only). See lib/cover.ts. */
export async function GET(_req: Request, { params }: RouteContext<"/api/fixtures/[id]/photo">) {
  const session = await getSession()
  if (!session) return new Response("Sign in first", { status: 401 })
  const { id } = await params
  return coverResponse("fixture", session.user.id, session.user.activeHouseholdId as string | null, id)
}
