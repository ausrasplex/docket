import { Lamp } from "lucide-react"
import { ComingSoon } from "@/components/shell/coming-soon"

export default function Page() {
  return <ComingSoon title="Fixtures" icon={<Lamp className="size-6" />} body="Appliances, tapware, lighting and systems, with manuals, serial numbers and warranties." />
}
