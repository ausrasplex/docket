import sharp from "sharp"
import { requireHousehold } from "@/lib/dal"
import { db } from "@/lib/db"
import { pickGroups, schedule } from "@/lib/schedule"
import { schedulePdf, type PdfPhotos } from "@/lib/schedule-pdf"
import { readStored } from "@/lib/storage"

/**
 * The fixtures and finishes schedule as a landscape PDF: ?groups=electrical,plumbing picks the sections
 * (the house's own ones when left out), and ?download=1 saves it rather than opening it in the browser.
 */
export async function GET(req: Request) {
  const c = await requireHousehold()
  const url = new URL(req.url)
  const groups = new Set(pickGroups(url.searchParams.get("groups")))
  const [all, property] = await Promise.all([
    schedule(c.householdId, c.property.id),
    db.property.findUnique({ where: { id: c.property.id }, select: { name: true, address: true } }),
  ])
  const sections = all.filter((x) => groups.has(x.group.id))

  // each item's photo, small, as a JPEG (the PDF format has no WebP); a missing file prints a blank square
  const keys = [...new Set(sections.flatMap((x) => x.rooms.flatMap((r) => r.rows.map((row) => row.photoKey))).filter((k) => k != null))]
  const photos: PdfPhotos = new Map()
  for (let i = 0; i < keys.length; i += 8) {
    await Promise.all(
      keys.slice(i, i + 8).map(async (k) => {
        try {
          const { data } = await readStored(k)
          photos.set(k, await sharp(data).resize(160, 160, { fit: "cover" }).flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer())
        } catch {
          // left blank
        }
      }),
    )
  }

  const tz = process.env.TZ || undefined
  const pdf = await schedulePdf({
    property: property?.name ?? "Home",
    address: property?.address ?? null,
    household: c.household.name,
    made: new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: tz }),
    sections,
    photos,
  })

  const name = `Fixtures and Finishes - ${property?.name ?? "Home"} - ${new Date().toLocaleDateString("en-CA", { timeZone: tz })}.pdf`
  const ascii = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "")
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${url.searchParams.get("download") ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  })
}
