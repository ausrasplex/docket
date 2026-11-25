"use client"

import { useId } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DOC_KINDS } from "@/lib/documents"
import type { DocumentKind } from "@/generated/prisma/enums"

/** "What Is It?" as a dropdown: the document kinds with their icons. `only` limits the choices. */
export function KindSelect({ value, onChange, only }: { value: DocumentKind; onChange: (k: DocumentKind) => void; only?: (k: DocumentKind) => boolean }) {
  const id = useId()
  const kinds = only ? DOC_KINDS.filter((k) => only(k.id)) : DOC_KINDS
  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-[13px] font-bold text-muted-foreground">
        What Is It?
      </span>
      <Select value={value} onValueChange={(v) => onChange(v as DocumentKind)}>
        <SelectTrigger aria-labelledby={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          {kinds.map((k) => (
            <SelectItem key={k.id} value={k.id}>
              <k.icon className="text-muted-foreground" />
              {k.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
