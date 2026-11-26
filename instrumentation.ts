// Runs once when the server starts: sets up the nightly backup (lib/backup.ts), the weekly price checks (lib/prices.ts)
// and the daily phone reminders (lib/push.ts).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { scheduleBackups } = await import("@/lib/backup")
  scheduleBackups()
  const { schedulePriceChecks } = await import("@/lib/prices")
  schedulePriceChecks()
  const { scheduleReminders } = await import("@/lib/push")
  scheduleReminders()
}
