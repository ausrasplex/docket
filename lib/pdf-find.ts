/**
 * Turning a PDF page's text items into one searchable string, the same way on the server (where the text is
 * stored for searching) and in the viewer (where matches are highlighted), so "the 2nd match on page 12"
 * means the same thing in both places.
 */

export type TextItem = { str: string; hasEOL?: boolean }

/** A page's text with runs of whitespace collapsed to one space; `item`/`off` map each character back. */
export type PageText = { text: string; lower: string; item: Int32Array; off: Int32Array }

/** Joins text items (a space after each line end), collapsing whitespace. Items are those with a `str`. */
export function pageText(items: TextItem[]): PageText {
  let text = ""
  let lower = ""
  const item: number[] = []
  const off: number[] = []
  const push = (c: string, i: number, o: number) => {
    text += c
    lower += lowerChar(c)
    item.push(i)
    off.push(o)
  }
  items.forEach((it, i) => {
    for (let o = 0; o < it.str.length; o++) {
      const c = it.str[o]
      if (/\s/.test(c)) {
        if (text && !text.endsWith(" ")) push(" ", i, o)
      } else push(c, i, o)
    }
    if (it.hasEOL && text && !text.endsWith(" ")) push(" ", -1, 0)
  })
  if (text.endsWith(" ")) {
    text = text.slice(0, -1)
    lower = lower.slice(0, -1)
    item.pop()
    off.pop()
  }
  return { text, lower, item: Int32Array.from(item), off: Int32Array.from(off) }
}

/** Lower case without changing length (a few characters lower-case to two; those stay as they are). */
function lowerChar(c: string) {
  const l = c.toLowerCase()
  return l.length === 1 ? l : c
}

export function lowerAligned(s: string) {
  let out = ""
  for (let i = 0; i < s.length; i++) out += lowerChar(s[i])
  return out
}

/** The search as typed, in the same form as `PageText.lower`. */
export function normQuery(q: string) {
  return lowerAligned(q.replace(/\s+/g, " ").trim())
}

/** Where `q` (already normalised) starts in `lower`, without overlaps. */
export function findAll(lower: string, q: string, max = Infinity) {
  const at: number[] = []
  if (!q) return at
  for (let i = lower.indexOf(q); i !== -1 && at.length < max; i = lower.indexOf(q, i + q.length)) at.push(i)
  return at
}

/** A short piece of text around a match, cut at word boundaries. */
export function snippet(text: string, at: number, len: number, radius = 70) {
  let a = Math.max(0, at - radius)
  let b = Math.min(text.length, at + len + radius)
  if (a > 0) {
    const sp = text.indexOf(" ", a)
    if (sp !== -1 && sp < at) a = sp + 1
  }
  if (b < text.length) {
    const sp = text.lastIndexOf(" ", b)
    if (sp > at + len) b = sp
  }
  return { before: (a > 0 ? "…" : "") + text.slice(a, at), match: text.slice(at, at + len), after: text.slice(at + len, b) + (b < text.length ? "…" : "") }
}
