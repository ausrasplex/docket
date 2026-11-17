import "server-only"
import { crc32 } from "node:zlib"

// A small ZIP writer for the export packs: files are stored as they are (photos and PDFs are already
// compressed), one at a time, so only one file is in memory at once. UTF-8 names; no ZIP64, so a pack must stay
// under 4 GB.

type Entry = { name: Buffer; crc: number; size: number; offset: number; time: number; date: number }

function dosTime(d: Date) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

/**
 * A ZIP as a stream. `files` yields { name, data } one at a time; a file that yields null data is skipped
 * (a missing upload shouldn't stop the rest of the pack).
 */
export function zipStream(files: AsyncIterable<{ name: string; data: Buffer | null; modified?: Date }>): ReadableStream<Uint8Array> {
  const entries: Entry[] = []
  let offset = 0
  const it = files[Symbol.asyncIterator]()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      // skip files with no data here: pull isn't called again unless something was enqueued
      let next = await it.next()
      while (!next.done && !next.value.data) next = await it.next()
      if (!next.done) {
        const { name, modified } = next.value
        const data = next.value.data!
        if (offset + data.length > 0xffffffff) throw new Error("The pack is too big for a ZIP file (over 4 GB).")
        const n = Buffer.from(name, "utf8")
        const { time, date } = dosTime(modified ?? new Date())
        const crc = crc32(data)
        const head = Buffer.alloc(30)
        head.writeUInt32LE(0x04034b50, 0)
        head.writeUInt16LE(20, 4) // version needed
        head.writeUInt16LE(0x0800, 6) // UTF-8 names
        head.writeUInt16LE(0, 8) // stored
        head.writeUInt16LE(time, 10)
        head.writeUInt16LE(date, 12)
        head.writeUInt32LE(crc, 14)
        head.writeUInt32LE(data.length, 18)
        head.writeUInt32LE(data.length, 22)
        head.writeUInt16LE(n.length, 26)
        head.writeUInt16LE(0, 28)
        entries.push({ name: n, crc, size: data.length, offset, time, date })
        offset += head.length + n.length + data.length
        controller.enqueue(new Uint8Array(Buffer.concat([head, n])))
        controller.enqueue(new Uint8Array(data))
        return
      }
      // the central directory, then its end record
      const start = offset
      const parts: Buffer[] = []
      for (const e of entries) {
        const c = Buffer.alloc(46)
        c.writeUInt32LE(0x02014b50, 0)
        c.writeUInt16LE(20, 4) // made by
        c.writeUInt16LE(20, 6) // needed
        c.writeUInt16LE(0x0800, 8)
        c.writeUInt16LE(0, 10)
        c.writeUInt16LE(e.time, 12)
        c.writeUInt16LE(e.date, 14)
        c.writeUInt32LE(e.crc, 16)
        c.writeUInt32LE(e.size, 20)
        c.writeUInt32LE(e.size, 24)
        c.writeUInt16LE(e.name.length, 28)
        c.writeUInt32LE(e.offset, 42)
        parts.push(c, e.name)
      }
      const dir = Buffer.concat(parts)
      const end = Buffer.alloc(22)
      end.writeUInt32LE(0x06054b50, 0)
      end.writeUInt16LE(entries.length, 8)
      end.writeUInt16LE(entries.length, 10)
      end.writeUInt32LE(dir.length, 12)
      end.writeUInt32LE(start, 16)
      controller.enqueue(new Uint8Array(Buffer.concat([dir, end])))
      controller.close()
    },
  })
}
