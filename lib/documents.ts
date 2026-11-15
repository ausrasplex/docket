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

/** Where a document opens: the stored file, or the web link. */
export function docHref(d: { id: string; url: string | null }) {
  return d.url ?? `/api/files/${d.id}`
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
