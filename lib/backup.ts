import "server-only"
import { createWriteStream } from "node:fs"
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { createGzip } from "node:zlib"
import { db } from "@/lib/db"

// Backups of the whole Docket server: every household's records and every uploaded file.
//
//   BACKUP_DIR/database/docket-2026-11-17-0300.json.gz   one snapshot of the database per run (the newest BACKUP_KEEP kept)
//   BACKUP_DIR/uploads/…                                 a mirror of UPLOAD_DIR: new files are copied in, nothing is removed,
//                                                        so every kept snapshot still finds its files
//   BACKUP_DIR/status.json                               the last run, for Settings
//
// A snapshot is each table's rows as PostgreSQL's own JSON (json_agg), read in one transaction so they agree with
// each other. It needs no pg_dump, and scripts/restore.mjs loads it back into an empty, migrated database.
// Point BACKUP_DIR at a different disk or share (the Unraid template maps it to its own share), and copy it off
// the server too.

const UPLOAD_ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./data/uploads")
export const BACKUP_ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.BACKUP_DIR ?? "./data/backups")
const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP) || 14)
/** The local hour (0–23) the nightly backup runs from. */
const HOUR = Math.min(23, Math.max(0, Number(process.env.BACKUP_HOUR ?? 3) || 0))

export type BackupStatus = {
  at: string // when it finished (ISO)
  ok: boolean
  error?: string
  file?: string // the snapshot's name
  bytes?: number
  rows?: number
  tables?: number
  filesCopied?: number
  filesTotal?: number
  ms?: number
}

const STATUS = () => path.join(/*turbopackIgnore: true*/ BACKUP_ROOT, "status.json")
const DB_DIR = () => path.join(/*turbopackIgnore: true*/ BACKUP_ROOT, "database")

let running: Promise<BackupStatus> | null = null

/** Runs a backup now (or joins the one already running). Never throws: the result says what happened. */
export function runBackup(): Promise<BackupStatus> {
  running ??= backup().finally(() => {
    running = null
  })
  return running
}

export const backupRunning = () => running !== null

async function backup(): Promise<BackupStatus> {
  const started = Date.now()
  let status: BackupStatus
  try {
    await mkdir(/*turbopackIgnore: true*/ DB_DIR(), { recursive: true })
    const snap = await snapshot()
    const files = await mirrorUploads()
    await prune()
    status = { at: new Date().toISOString(), ok: true, ...snap, filesCopied: files.copied, filesTotal: files.total, ms: Date.now() - started }
  } catch (e) {
    status = { at: new Date().toISOString(), ok: false, error: e instanceof Error ? e.message : String(e), ms: Date.now() - started }
    console.error("Docket: backup failed:", status.error)
  }
  try {
    await mkdir(/*turbopackIgnore: true*/ BACKUP_ROOT, { recursive: true })
    await writeFile(/*turbopackIgnore: true*/ STATUS(), JSON.stringify(status, null, 2))
  } catch {
    // the folder itself can't be written; the result still goes back to whoever asked
  }
  return status
}

const stamp = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`

/** Writes one snapshot of every table, read in a single transaction. */
async function snapshot() {
  const parts: string[] = []
  let rows = 0
  let tables = 0
  await db.$transaction(
    async (tx) => {
      const names = (await tx.$queryRawUnsafe<{ name: string }[]>(
        `SELECT tablename AS name FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations' ORDER BY tablename`
      )).map((t) => t.name)
      const migrations = (await tx.$queryRawUnsafe<{ name: string }[]>(
        `SELECT migration_name AS name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`
      )).map((m) => m.name)
      const counts: Record<string, number> = {}
      const body: string[] = []
      for (const name of names) {
        // the rows as PostgreSQL writes them, kept as text, so numbers, dates and JSON come back exactly
        const [r] = await tx.$queryRawUnsafe<{ j: string; n: number }[]>(`SELECT coalesce(json_agg(t), '[]')::text AS j, count(*)::int AS n FROM ${ident(name)} t`)
        counts[name] = r.n
        rows += r.n
        body.push(`${JSON.stringify(name)}:${r.j}`)
      }
      tables = names.length
      parts.push(
        `{"format":"docket-backup","version":1,"createdAt":${JSON.stringify(new Date().toISOString())},` +
          `"migrations":${JSON.stringify(migrations)},"counts":${JSON.stringify(counts)},"tables":{`
      )
      parts.push(body.join(","))
      parts.push("}}")
    },
    { isolationLevel: "RepeatableRead", timeout: 5 * 60_000, maxWait: 30_000 }
  )

  const file = `docket-${stamp(new Date())}.json.gz`
  const final = path.join(/*turbopackIgnore: true*/ DB_DIR(), file)
  const tmp = `${final}.part`
  await pipeline(Readable.from(parts), createGzip(), createWriteStream(/*turbopackIgnore: true*/ tmp))
  await rename(/*turbopackIgnore: true*/ tmp, final)
  const bytes = (await stat(/*turbopackIgnore: true*/ final)).size
  return { file, bytes, rows, tables }
}

/** Copies uploads the backup doesn't have yet. Uploads are never changed once written, so a name and size match is enough. */
async function mirrorUploads() {
  const dest = path.join(/*turbopackIgnore: true*/ BACKUP_ROOT, "uploads")
  let entries
  try {
    entries = await readdir(/*turbopackIgnore: true*/ UPLOAD_ROOT, { recursive: true, withFileTypes: true })
  } catch {
    return { copied: 0, total: 0 } // nothing uploaded yet
  }
  let copied = 0
  let total = 0
  for (const e of entries) {
    if (!e.isFile()) continue
    total++
    const from = path.join(e.parentPath, e.name)
    const to = path.join(/*turbopackIgnore: true*/ dest, path.relative(UPLOAD_ROOT, from))
    const [a, b] = await Promise.all([stat(/*turbopackIgnore: true*/ from), stat(/*turbopackIgnore: true*/ to).catch(() => null)])
    if (b && b.size === a.size) continue
    await mkdir(/*turbopackIgnore: true*/ path.dirname(to), { recursive: true })
    await copyFile(/*turbopackIgnore: true*/ from, `${to}.part`)
    await rename(/*turbopackIgnore: true*/ `${to}.part`, to)
    copied++
  }
  return { copied, total }
}

/** The kept snapshots, newest first. */
export async function listSnapshots() {
  let names: string[]
  try {
    names = await readdir(/*turbopackIgnore: true*/ DB_DIR())
  } catch {
    return []
  }
  const snaps = names.filter((n) => /^docket-.*\.json\.gz$/.test(n)).sort().reverse()
  return Promise.all(
    snaps.map(async (name) => {
      const s = await stat(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ DB_DIR(), name))
      return { name, bytes: s.size, at: s.mtime }
    })
  )
}

/** Removes snapshots past the newest BACKUP_KEEP, and any half-written ones. */
async function prune() {
  const names = await readdir(/*turbopackIgnore: true*/ DB_DIR())
  const old = names.filter((n) => /^docket-.*\.json\.gz$/.test(n)).sort().reverse().slice(KEEP)
  const partial = names.filter((n) => n.endsWith(".part"))
  await Promise.all([...old, ...partial].map((n) => rm(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ DB_DIR(), n), { force: true })))
}

/** The last run, or null when there hasn't been one. */
export async function backupStatus(): Promise<BackupStatus | null> {
  try {
    return JSON.parse(await readFile(/*turbopackIgnore: true*/ STATUS(), "utf8")) as BackupStatus
  } catch {
    return null
  }
}

export const backupSettings = () => ({ dir: BACKUP_ROOT, keep: KEEP, hour: HOUR, enabled: process.env.BACKUP_DISABLED !== "1" })

/**
 * The nightly schedule: checks every 15 minutes and backs up once a day after BACKUP_HOUR, or straight away when
 * the newest snapshot is over a day old (the server was off overnight). Started once from instrumentation.ts.
 */
export function scheduleBackups() {
  if (process.env.BACKUP_DISABLED === "1") return
  const g = globalThis as unknown as { docketBackupTimer?: NodeJS.Timeout }
  if (g.docketBackupTimer) return
  const check = async () => {
    try {
      const [latest] = await listSnapshots()
      const now = new Date()
      const age = latest ? now.getTime() - latest.at.getTime() : Infinity
      const todayRun = new Date(now)
      todayRun.setHours(HOUR, 0, 0, 0)
      const due = age > 26 * 3_600_000 || (now >= todayRun && (!latest || latest.at < todayRun))
      if (due) await runBackup()
    } catch (e) {
      console.error("Docket: backup check failed:", e)
    }
  }
  setTimeout(check, 60_000).unref()
  g.docketBackupTimer = setInterval(check, 15 * 60_000)
  g.docketBackupTimer.unref()
}
