// Restores a Docket backup (made by lib/backup.ts) into an EMPTY database, and copies the backed-up files back.
//
//   node scripts/restore.mjs <snapshot.json.gz> [--uploads <backup uploads folder>] [--check]
//
// DATABASE_URL is the database to fill and UPLOAD_DIR where the files go (./data/uploads by default). The
// database must already have Docket's tables at the same version as the backup (start Docket once against it, or
// run `npx prisma migrate deploy`), and must be empty: this never overwrites or deletes anything.
// --uploads defaults to the uploads folder beside the snapshot's database folder. --check only reads the
// snapshot and says what it holds.
//
// In the Docker container:  docker exec -it Docket node scripts/restore.mjs /data/backups/database/docket-….json.gz

import { createReadStream } from "node:fs"
import { copyFile, mkdir, readdir, rename, stat } from "node:fs/promises"
import path from "node:path"
import { createGunzip } from "node:zlib"
import pg from "pg"

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  if (i < 0) return undefined
  const v = args[i + 1]
  args.splice(i, 2)
  return v
}
const check = args.includes("--check")
if (check) args.splice(args.indexOf("--check"), 1)
const uploadsArg = flag("--uploads")
const file = args[0]
if (!file) fail("Give the snapshot to restore: node scripts/restore.mjs <backups>/database/docket-….json.gz")

function fail(msg) {
  console.error(`Restore: ${msg}`)
  process.exit(1)
}
const ident = (n) => `"${n.replace(/"/g, '""')}"`

// ── read the snapshot ──
let text = ""
try {
  // decoded in one go: a character can be split across two chunks
  const chunks = []
  for await (const chunk of createReadStream(file).pipe(createGunzip())) chunks.push(chunk)
  text = Buffer.concat(chunks).toString("utf8")
} catch (e) {
  fail(`couldn't read ${file}: ${e.message}`)
}
const snap = JSON.parse(text)
if (snap.format !== "docket-backup" || snap.version !== 1) fail(`${file} isn't a Docket backup.`)
const names = Object.keys(snap.tables)
const total = names.reduce((n, t) => n + snap.tables[t].length, 0)
console.log(`Backup from ${snap.createdAt}: ${total} rows in ${names.length} tables, database version ${snap.migrations.at(-1)}.`)
if (check) process.exit(0)

if (!process.env.DATABASE_URL) fail("DATABASE_URL is not set.")
const db = new pg.Client({ connectionString: process.env.DATABASE_URL })
await db.connect()
const q = async (sql, params) => (await db.query(sql, params)).rows

// ── the target must be the same version, and empty ──
const have = (await q(`SELECT migration_name AS name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name`).catch(() =>
  fail("that database has no Docket tables yet. Start Docket against it once (or run `npx prisma migrate deploy`), then restore.")
)).map((r) => r.name)
if (JSON.stringify(have) !== JSON.stringify(snap.migrations)) {
  fail(
    `the database is at version ${have.at(-1) ?? "(none)"} but the backup is from ${snap.migrations.at(-1)}. ` +
      "Restore with the Docket version the backup was made with, then upgrade."
  )
}
const tables = (await q(`SELECT tablename AS name FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`)).map((r) => r.name)
for (const t of names) if (!tables.includes(t)) fail(`the backup has a table "${t}" this database doesn't.`)
for (const t of tables) {
  const [{ n }] = await q(`SELECT count(*)::int AS n FROM ${ident(t)}`)
  if (n) fail(`the database isn't empty ("${t}" has ${n} rows). Restore into a new, empty database.`)
}

// ── order the tables so each row's required links exist first ──
const fks = await q(`
  SELECT c.conrelid::regclass::text AS t, c.confrelid::regclass::text AS r,
         array_agg(a.attname::text) AS cols, bool_and(a.attnotnull) AS required
  FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
  WHERE c.contype = 'f' AND c.connamespace = current_schema()::regnamespace
  GROUP BY c.oid, c.conrelid, c.confrelid`)
const bare = (regclass) => regclass.replace(/^"(.*)"$/, "$1").replace(/""/g, '"')
const order = []
const placed = new Set()
// a table goes in once everything it links to is in; only when links go round in a circle does one go in with
// its optional links empty, filled in at the end (a check like "exactly one target" could reject them empty)
const ready = (t, optionalToo) =>
  fks.every((f) => bare(f.t) !== t || bare(f.r) === t || placed.has(bare(f.r)) || !names.includes(bare(f.r)) || (!optionalToo && !f.required))
while (order.length < names.length) {
  const next = names.find((t) => !placed.has(t) && ready(t, true)) ?? names.find((t) => !placed.has(t) && ready(t, false))
  if (!next) fail("the tables' links go round in a circle; this restore can't order them.")
  order.push(next)
  placed.add(next)
}
// optional links to a table not loaded yet (or to the same table) are filled in afterwards
const later = (t, pos) =>
  fks.filter((f) => bare(f.t) === t && !f.required && (bare(f.r) === t || order.indexOf(bare(f.r)) > pos)).flatMap((f) => f.cols)

// ── load ──
await db.query("BEGIN")
try {
  const fillIns = [] // optional links, set once every table is in
  for (const [pos, t] of order.entries()) {
    const rows = snap.tables[t]
    if (!rows.length) continue
    const cols = (await q(`SELECT attname::text AS name FROM pg_attribute WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped ORDER BY attnum`, [ident(t)])).map((r) => r.name)
    const defer = new Set(later(t, pos))
    const json = JSON.stringify(rows)
    const select = cols.map((c) => (defer.has(c) ? `NULL AS ${ident(c)}` : `j.${ident(c)}`)).join(", ")
    await db.query(`INSERT INTO ${ident(t)} (${cols.map(ident).join(", ")}) SELECT ${select} FROM json_populate_recordset(NULL::${ident(t)}, $1::json) j`, [json])
    if (defer.size) {
      const key = (await q(`SELECT a.attname::text AS name FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey) WHERE i.indrelid = $1::regclass AND i.indisprimary`, [ident(t)])).map((r) => r.name)
      if (!key.length) throw new Error(`"${t}" has no primary key to fill its links in by`)
      const sets = [...defer].map((c) => `${ident(c)} = j.${ident(c)}`).join(", ")
      const match = key.map((k) => `x.${ident(k)} = j.${ident(k)}`).join(" AND ")
      fillIns.push([`UPDATE ${ident(t)} x SET ${sets} FROM json_populate_recordset(NULL::${ident(t)}, $1::json) j WHERE ${match}`, [json]])
    }
    console.log(`  ${t}: ${rows.length}`)
  }
  for (const [sql, params] of fillIns) await db.query(sql, params)
  await db.query("COMMIT")
} catch (e) {
  await db.query("ROLLBACK")
  fail(`nothing was changed: ${e.message}`)
}
await db.end()
console.log(`Database restored: ${total} rows.`)

// ── files ──
const from = path.resolve(uploadsArg ?? path.join(path.dirname(path.dirname(path.resolve(file))), "uploads"))
const to = path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads")
let entries = []
try {
  entries = await readdir(from, { recursive: true, withFileTypes: true })
} catch {
  console.log(`No backed-up files at ${from}; copy the uploads folder back by hand if you have it.`)
  process.exit(0)
}
let copied = 0
for (const e of entries) {
  if (!e.isFile() || e.name.endsWith(".part")) continue
  const src = path.join(e.parentPath, e.name)
  const dest = path.join(to, path.relative(from, src))
  if (await stat(dest).catch(() => null)) continue
  await mkdir(path.dirname(dest), { recursive: true })
  await copyFile(src, `${dest}.part`)
  await rename(`${dest}.part`, dest)
  copied++
}
console.log(`Files restored: ${copied} copied to ${to}.`)
