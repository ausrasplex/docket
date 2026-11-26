import { db } from "@/lib/db"

/** The upload limits a server admin can pick, in MB. 50 MB is the most: files are read into memory to store them. */
export const UPLOAD_LIMITS = [10, 25, 50] as const
export const DEFAULT_UPLOAD_MB = 25

/** The largest file that can be uploaded right now, in MB. */
export async function maxUploadMb() {
  const row = await db.serverConfig.findUnique({ where: { id: 1 }, select: { maxUploadMb: true } })
  const mb = row?.maxUploadMb ?? DEFAULT_UPLOAD_MB
  return (UPLOAD_LIMITS as readonly number[]).includes(mb) ? mb : DEFAULT_UPLOAD_MB
}
