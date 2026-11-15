import { Hammer } from "lucide-react"
import { ComingSoon } from "@/components/shell/coming-soon"

export default function Page() {
  return <ComingSoon title="Jobs" icon={<Hammer className="size-6" />} body="Work done on the house, with the tradesperson, costs and receipts." />
}
