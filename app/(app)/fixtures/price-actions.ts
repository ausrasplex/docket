"use server"

import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { logActivity, requireHousehold } from "@/lib/dal"
import { normaliseUrl } from "@/lib/documents"
import { checkSource, resyncSource, retryFailing, siteName } from "@/lib/prices"
import { money } from "@/lib/format"

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string }

export type PriceSourceInput = { url: string; label: string; selector: string }

function refresh(fixtureId?: string) {
  if (fixtureId) revalidatePath(`/fixtures/${fixtureId}`)
  revalidatePath("/exports/insurance")
  revalidatePath("/exports/prices")
  revalidatePath("/settings")
}

/** The item a source belongs to (its top-level item's page, for a part), checked against the household. */
async function source(householdId: string, id: string) {
  return db.priceSource.findFirst({ where: { id, householdId }, select: { id: true, url: true, label: true, fixtureId: true, fixture: { select: { name: true, parentId: true } } } })
}
const pageOf = (s: { fixtureId: string; fixture: { parentId: string | null } }) => s.fixture.parentId ?? s.fixtureId

function clean(input: PriceSourceInput) {
  const url = normaliseUrl(input.url)
  if (!url) return { error: "Paste the shop's product page address." }
  const selector = input.selector.trim().slice(0, 300)
  return { url, label: input.label.trim().slice(0, 80) || null, selector: selector || null }
}

const outcomeText = (r: Awaited<ReturnType<typeof checkSource>>) =>
  !r.ok ? null : r.held ? `Read ${money(r.price, true)}, a big change: it'll be checked again tomorrow before it's recorded.` : `${money(r.price, true)}${r.changed ? "" : ", unchanged"}`

export async function addPriceSource(fixtureId: string, input: PriceSourceInput): Promise<Result<{ message: string; error?: string }>> {
  const c = await requireHousehold("MEMBER")
  const f = await db.fixture.findFirst({ where: { id: fixtureId, householdId: c.householdId }, select: { id: true, name: true, parentId: true } })
  if (!f) return { ok: false, error: "That item no longer exists." }
  const v = clean(input)
  if ("error" in v) return { ok: false, error: v.error! }
  if (await db.priceSource.findFirst({ where: { fixtureId, url: v.url } })) return { ok: false, error: "That page is already tracked for this item." }
  const s = await db.priceSource.create({ data: { householdId: c.householdId, fixtureId, ...v, createdById: c.user.id } })
  await logActivity(c, { action: "created", entityType: "fixture", entityId: f.id, summary: `Tracking the price of ${f.name} at ${v.label ?? siteName(v.url)}` })
  // the first check straight away, so a page that can't be read says so now rather than next week
  const r = await checkSource(s.id)
  refresh(f.parentId ?? f.id)
  return r.ok ? { ok: true, message: outcomeText(r)! } : { ok: true, message: "Added, but the price couldn't be read", error: r.error }
}

export async function updatePriceSource(id: string, input: PriceSourceInput): Promise<Result<{ message: string; error?: string }>> {
  const c = await requireHousehold("MEMBER")
  const s = await source(c.householdId, id)
  if (!s) return { ok: false, error: "That shop page no longer exists." }
  const v = clean(input)
  if ("error" in v) return { ok: false, error: v.error! }
  // a different page is a different price: its history starts again
  const moved = v.url !== s.url
  await db.$transaction([
    ...(moved ? [db.priceCheck.deleteMany({ where: { sourceId: id } })] : []),
    db.priceSource.update({
      where: { id },
      data: { ...v, ...(moved ? { lastPrice: null, lastOkAt: null, pendingPrice: null, lastError: null, failingSince: null } : {}) },
    }),
  ])
  const r = await checkSource(id)
  refresh(pageOf(s))
  return r.ok ? { ok: true, message: outcomeText(r)! } : { ok: true, message: "Saved, but the price couldn't be read", error: r.error }
}

export async function deletePriceSource(id: string): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const s = await source(c.householdId, id)
  if (!s) return { ok: true }
  await db.priceSource.delete({ where: { id } })
  await logActivity(c, { action: "updated", entityType: "fixture", entityId: s.fixtureId, summary: `Stopped tracking the price of ${s.fixture.name} at ${s.label ?? siteName(s.url)}` })
  refresh(pageOf(s))
  return { ok: true }
}

export async function checkPriceNow(id: string): Promise<Result<{ message: string }>> {
  const c = await requireHousehold("MEMBER")
  const s = await source(c.householdId, id)
  if (!s) return { ok: false, error: "That shop page no longer exists." }
  const r = await checkSource(id)
  refresh(pageOf(s))
  return r.ok ? { ok: true, message: outcomeText(r)! } : { ok: false, error: r.error }
}

/** Removes a wrong reading (an accessory's price read instead of the item's): the lowest and highest follow. */
export async function deletePriceCheck(checkId: string): Promise<Result> {
  const c = await requireHousehold("MEMBER")
  const p = await db.priceCheck.findFirst({ where: { id: checkId, source: { householdId: c.householdId } }, select: { id: true, sourceId: true, source: { select: { fixtureId: true, fixture: { select: { parentId: true } } } } } })
  if (!p) return { ok: true }
  await db.priceCheck.delete({ where: { id: p.id } })
  await resyncSource(p.sourceId)
  refresh(pageOf(p.source))
  return { ok: true }
}

/** Settings › Price Checks: tries every failing page again. */
export async function retryFailedPrices(): Promise<Result<{ tried: number; fixed: number }>> {
  const c = await requireHousehold("ADMIN")
  const r = await retryFailing(c.householdId)
  refresh()
  revalidatePath("/fixtures", "layout")
  return { ok: true, ...r }
}
