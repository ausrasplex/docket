import "server-only"
import path from "node:path"
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer"
import type { ScheduleRow, ScheduleSection } from "@/lib/schedule"

// The schedule as a landscape A4 PDF (react-pdf lays it out on the server). Folio's light colours, kept
// sparing with ink: white pages, thin rules, a tinted band only on headings.

const FONT_DIR = path.join(process.cwd(), "node_modules/@fontsource/plus-jakarta-sans/files")
Font.register({
  family: "Jakarta",
  fonts: [400, 500, 600, 700, 800].map((w) => ({ src: path.join(FONT_DIR, `plus-jakarta-sans-latin-${w}-normal.woff`), fontWeight: w })),
})
// long product names and model numbers wrap where they must, not by hyphenating words
Font.registerHyphenationCallback((word) => [word])

const C = { ink: "#1f1c3b", muted: "#6b6985", line: "#e3e2ec", band: "#f4f3f9", accent: "#b8a5fa", hero: "#2b2849" }

const W = { item: 150, image: 50, product: 220, store: 120 } // the colour / finish / size column takes the rest

const s = StyleSheet.create({
  page: { fontFamily: "Jakarta", fontSize: 9, color: C.ink, paddingTop: 56, paddingBottom: 44, paddingHorizontal: 32 },
  header: { position: "absolute", top: 22, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 0.75, borderBottomColor: C.line, paddingBottom: 6 },
  headerTitle: { fontSize: 9, fontWeight: 800, letterSpacing: 0.3 },
  headerMeta: { fontSize: 8, color: C.muted, fontWeight: 500 },
  footer: { position: "absolute", bottom: 20, left: 32, right: 32, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: C.muted, fontWeight: 500 },

  coverTitle: { fontSize: 30, fontWeight: 800, letterSpacing: -0.5, marginTop: 40 },
  coverSub: { fontSize: 13, fontWeight: 600, marginTop: 6 },
  coverMeta: { fontSize: 10, color: C.muted, fontWeight: 500, marginTop: 3 },
  coverRule: { width: 56, height: 5, backgroundColor: C.accent, borderRadius: 3, marginTop: 18, marginBottom: 26 },
  tocHead: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: C.ink, paddingBottom: 4, fontSize: 7.5, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  tocRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 6, alignItems: "center" },

  groupHead: { flexDirection: "row", alignItems: "center", backgroundColor: C.band, borderRadius: 6, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 6 },
  groupBar: { width: 4, height: 22, borderRadius: 2, backgroundColor: C.accent, marginRight: 10 },
  groupTitle: { fontSize: 15, fontWeight: 800 },
  groupHint: { fontSize: 8.5, color: C.muted, fontWeight: 500, marginTop: 1 },
  groupCount: { marginLeft: "auto", fontSize: 9, fontWeight: 700, color: C.muted },

  room: { fontSize: 11, fontWeight: 800, marginTop: 14, marginBottom: 4 },
  th: { flexDirection: "row", borderBottomWidth: 0.75, borderBottomColor: C.ink, paddingBottom: 3, fontSize: 7, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 5, alignItems: "center", minHeight: 46 },
  cell: { paddingRight: 10 },
  strong: { fontWeight: 700, fontSize: 9.5 },
  note: { fontSize: 7.5, color: C.muted, fontWeight: 500, marginTop: 1.5 },
  thumb: { width: 38, height: 38, borderRadius: 5, objectFit: "cover" },
  blank: { width: 38, height: 38, borderRadius: 5, backgroundColor: C.band },
  dash: { color: C.muted },
})

export type PdfPhotos = Map<string, Buffer> // storage key → a small JPEG

/** On every page; a section's pages also name the section, so a page that runs on still says what it is. */
function Header({ property, section }: { property: string; section?: string }) {
  return (
    <View style={s.header} fixed>
      <Text style={s.headerTitle}>
        FIXTURES AND FINISHES
        {section ? <Text style={{ color: C.muted }}> · {section.toUpperCase()}</Text> : null}
      </Text>
      <Text style={s.headerMeta}>{property}</Text>
    </View>
  )
}

function Footer({ made, household }: { made: string; household: string }) {
  return (
    <View style={s.footer} fixed>
      <Text>
        {household ? `${household} · ` : ""}Made with Docket on {made}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  )
}

function Row({ r, photos }: { r: ScheduleRow; photos: PdfPhotos }) {
  const photo = r.photoKey ? photos.get(r.photoKey) : undefined
  return (
    <View style={s.tr} wrap={false}>
      <View style={[s.cell, { width: W.item }]}>
        <Text style={s.strong}>{r.item}</Text>
        {r.itemNote ? <Text style={s.note}>{r.itemNote}</Text> : null}
      </View>
      <View style={[s.cell, { width: W.image }]}>
        {photo ? (
          // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's Image, not an HTML img
          <Image src={{ data: photo, format: "jpg" }} style={s.thumb} />
        ) : r.hex ? (
          <View style={[s.blank, { backgroundColor: r.hex, borderWidth: 0.5, borderColor: C.line }]} />
        ) : (
          <View style={s.blank} />
        )}
      </View>
      <Text style={[s.cell, { width: W.product }]}>{r.product || <Text style={s.dash}>—</Text>}</Text>
      <Text style={[s.cell, { width: W.store }]}>{r.store ?? <Text style={s.dash}>—</Text>}</Text>
      <Text style={[s.cell, { flex: 1, paddingRight: 0 }]}>{r.look ?? <Text style={s.dash}>—</Text>}</Text>
    </View>
  )
}

function TableHead() {
  return (
    <View style={s.th}>
      <Text style={[s.cell, { width: W.item }]}>Item</Text>
      <Text style={[s.cell, { width: W.image }]}>Image</Text>
      <Text style={[s.cell, { width: W.product }]}>Product</Text>
      <Text style={[s.cell, { width: W.store }]}>Store</Text>
      <Text style={{ flex: 1 }}>Colour / Finish / Size</Text>
    </View>
  )
}

export type ScheduleDoc = { property: string; address: string | null; household: string; made: string; sections: ScheduleSection[]; photos: PdfPhotos }

function SchedulePdf({ property, address, household, made, sections, photos }: ScheduleDoc) {
  const shown = sections.filter((x) => x.count)
  return (
    <Document title={`Fixtures and Finishes - ${property}`} author={household || "Docket"} creator="Docket" producer="Docket">
      <Page size="A4" orientation="landscape" style={s.page}>
        <Header property={property} />
        <Text style={s.coverTitle}>Fixtures and Finishes</Text>
        <Text style={s.coverSub}>{property}</Text>
        {address ? <Text style={s.coverMeta}>{address}</Text> : null}
        <Text style={s.coverMeta}>Made {made}</Text>
        <View style={s.coverRule} />
        <View style={s.tocHead}>
          <Text style={{ width: 200 }}>Section</Text>
          <Text style={{ flex: 1 }}>Covers</Text>
          <Text style={{ width: 70, textAlign: "right" }}>Rooms</Text>
          <Text style={{ width: 70, textAlign: "right" }}>Entries</Text>
        </View>
        {shown.map((x) => (
          <View key={x.group.id} style={s.tocRow}>
            <Text style={[s.strong, { width: 200 }]}>{x.group.label}</Text>
            <Text style={{ flex: 1, color: C.muted }}>{x.group.hint}</Text>
            <Text style={{ width: 70, textAlign: "right" }}>{x.rooms.length}</Text>
            <Text style={{ width: 70, textAlign: "right", fontWeight: 700 }}>{x.count}</Text>
          </View>
        ))}
        {!shown.length ? <Text style={[s.coverMeta, { marginTop: 12 }]}>Nothing to list yet in the sections chosen.</Text> : null}
        <Footer made={made} household={household} />
      </Page>

      {shown.map((x) => (
        <Page key={x.group.id} size="A4" orientation="landscape" style={s.page}>
          <Header property={property} section={x.group.label} />
          <View style={s.groupHead}>
            <View style={s.groupBar} />
            <View>
              <Text style={s.groupTitle}>{x.group.label}</Text>
              <Text style={s.groupHint}>{x.group.hint}</Text>
            </View>
            <Text style={s.groupCount}>
              {x.count} {x.count === 1 ? "entry" : "entries"} · {x.rooms.length} {x.rooms.length === 1 ? "room" : "rooms"}
            </Text>
          </View>
          {x.rooms.map((room) => (
            <View key={room.room}>
              {/* the room's heading and table head stay with at least its first row */}
              <View wrap={false} minPresenceAhead={50}>
                <Text style={s.room}>{room.room}</Text>
                <TableHead />
              </View>
              {room.rows.map((r) => (
                <Row key={r.id} r={r} photos={photos} />
              ))}
            </View>
          ))}
          <Footer made={made} household={household} />
        </Page>
      ))}
    </Document>
  )
}

export function schedulePdf(doc: ScheduleDoc) {
  return renderToBuffer(<SchedulePdf {...doc} />)
}
