import {
  Award,
  Camera,
  ClipboardList,
  Download,
  File,
  FileBadge,
  FileSpreadsheet,
  FileText,
  Globe,
  LifeBuoy,
  Map,
  Receipt,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"
import type { DocumentKind } from "@/generated/prisma/enums"

export const DOC_KINDS: { id: DocumentKind; label: string; icon: LucideIcon }[] = [
  { id: "MANUAL", label: "Manual", icon: FileText },
  { id: "QUICK_START", label: "Quick Start", icon: ClipboardList },
  { id: "SPEC_SHEET", label: "Spec Sheet", icon: FileSpreadsheet },
  { id: "WARRANTY", label: "Warranty", icon: ShieldCheck },
  { id: "RECEIPT", label: "Receipt", icon: Receipt },
  { id: "INVOICE", label: "Invoice", icon: Receipt },
  { id: "QUOTE", label: "Quote", icon: FileBadge },
  { id: "CERTIFICATE", label: "Certificate", icon: Award },
  { id: "PLAN", label: "Plan", icon: Map },
  { id: "PHOTO", label: "Photo", icon: Camera },
  { id: "SUPPORT", label: "Support Page", icon: LifeBuoy },
  { id: "SOFTWARE", label: "Software", icon: Download },
  { id: "OTHER", label: "Other", icon: File },
]

export const docKind = (k: DocumentKind) => DOC_KINDS.find((d) => d.id === k) ?? DOC_KINDS.at(-1)!
export const LINK_ICON = Globe

/** Where a document opens: the web link, Docket's PDF viewer, or the stored file (photos). */
export function docHref(d: { id: string; url: string | null; mimeType?: string | null }) {
  return d.url ?? (d.mimeType === "application/pdf" ? viewHref(d.id) : `/api/files/${d.id}`)
}

/** True when the document opens inside Docket (the PDF viewer) rather than in a new tab. */
export const opensInApp = (d: { url: string | null; mimeType?: string | null }) => !d.url && d.mimeType === "application/pdf"

/**
 * The PDF viewer, optionally at a search match: the n-th (`hit`, from 0) match of `q` on `page`.
 * `back` is where its back button goes when there's no history to go back through.
 */
export function viewHref(id: string, at: { back?: string; page?: number; q?: string; hit?: number } = {}) {
  const sp = new URLSearchParams()
  if (at.page) sp.set("page", String(at.page))
  if (at.q?.trim()) sp.set("q", at.q.trim())
  if (at.hit) sp.set("hit", String(at.hit))
  if (at.back) sp.set("back", at.back)
  const s = sp.toString()
  return `/documents/${id}/view${s ? `?${s}` : ""}`
}

/** Accepts "daikin.com.au/support" as well as full addresses; only http(s) links are allowed. */
export function normaliseUrl(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`)
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null
  } catch {
    return null
  }
}
