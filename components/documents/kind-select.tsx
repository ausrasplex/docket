"use client"

import { SelectItem } from "@/components/ui/select"
import { Dropdown } from "@/components/dropdown"
import { DOC_KINDS } from "@/lib/documents"
import type { DocumentKind } from "@/generated/prisma/enums"

/** "What Is It?" as a dropdown: the document kinds with their icons. `only` limits the choices. */
export function KindSelect({ value, onChange, only }: { value: DocumentKind; onChange: (k: DocumentKind) => void; only?: (k: DocumentKind) => boolean }) {
  const kinds = only ? DOC_KINDS.filter((k) => only(k.id)) : DOC_KINDS
  return (
    <Dropdown label="What Is It?" value={value} onChange={(v) => onChange(v as DocumentKind)}>
      {kinds.map((k) => (
        <SelectItem key={k.id} value={k.id}>
          <k.icon className="text-muted-foreground" />
          {k.label}
        </SelectItem>
      ))}
    </Dropdown>
  )
}
