import { connection } from "next/server"
import { db } from "@/lib/db"

/** For Docker's health check: the server answers and the database is reachable. */
export async function GET() {
  await connection() // always run at request time
  try {
    await db.$queryRaw`SELECT 1`
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } })
  } catch {
    return Response.json({ ok: false, error: "database unreachable" }, { status: 503, headers: { "cache-control": "no-store" } })
  }
}
