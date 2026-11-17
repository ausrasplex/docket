// Runs once when the server starts: sets up the nightly backup (lib/backup.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { scheduleBackups } = await import("@/lib/backup")
  scheduleBackups()
}
