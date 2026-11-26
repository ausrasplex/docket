"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { SelectItem } from "@/components/ui/select"
import { Dropdown } from "@/components/dropdown"
import { setUploadLimit } from "./actions"

/** Settings › Server: the largest file anyone can upload. */
export function UploadLimit({ value, options }: { value: number; options: readonly number[] }) {
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-col gap-1.5">
      <Dropdown
        label="Largest Upload"
        value={String(value)}
        onChange={(v) =>
          !pending &&
          start(async () => {
            const r = await setUploadLimit(Number(v))
            if (!r.ok) return void toast.error(r.error)
            toast(`Files can now be up to ${v} MB`)
          })
        }
      >
        {options.map((mb) => (
          <SelectItem key={mb} value={String(mb)}>
            {mb} MB per file
          </SelectItem>
        ))}
      </Dropdown>
      <span className="text-xs text-muted-foreground">For every household on this server. Large scanned manuals can need 50 MB.</span>
    </div>
  )
}
