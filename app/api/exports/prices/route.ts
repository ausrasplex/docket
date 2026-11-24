import { requireHousehold } from "@/lib/dal"
import { priceReport } from "@/lib/prices"
import { priceHistoryCsv, priceSummaryCsv } from "@/lib/price-csv"
import { zipStream } from "@/lib/zip"

/** The Price History pack as a ZIP: a summary (one row per item) and every recorded price. Anyone in the household can download it. */
export async function GET() {
  const c = await requireHousehold()
  const report = await priceReport(c.householdId, c.property.id)
  const today = new Date().toLocaleDateString("en-CA", { timeZone: process.env.TZ || undefined })
  const root = `Price History - ${c.property.name || "Home"} - ${today}`.replace(/[\\/:*?"<>|\x00-\x1f]/g, "-").replace(/[. ]+$/, "").slice(0, 100)
  async function* files() {
    yield { name: `${root}/Price summary.csv`, data: Buffer.from(priceSummaryCsv(report), "utf8") }
    yield { name: `${root}/Price history.csv`, data: Buffer.from(priceHistoryCsv(report), "utf8") }
  }
  return new Response(zipStream(files()), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${root.replace(/[^\x20-\x7e]/g, "_")}.zip"; filename*=UTF-8''${encodeURIComponent(root)}.zip`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
