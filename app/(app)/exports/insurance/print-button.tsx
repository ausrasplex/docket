"use client"

import { Printer } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Prints the report, or saves it as a PDF from the print dialog. */
export function PrintButton() {
  return (
    <Button type="button" variant="outline" size="sm" className="max-desk:size-11 max-desk:px-0" onClick={() => window.print()} title="Print, or save as PDF">
      <Printer />
      <span className="max-desk:sr-only">Print or Save PDF</span>
    </Button>
  )
}
