import type { ExpenseClass, JobStatus } from "@/generated/prisma/enums"

export const JOB_STATUSES: { id: JobStatus; label: string; tone: string }[] = [
  { id: "PLANNED", label: "Planned", tone: "bg-surface2" },
  { id: "QUOTED", label: "Quoted", tone: "bg-t1" },
  { id: "IN_PROGRESS", label: "In Progress", tone: "bg-t2" },
  { id: "DONE", label: "Done", tone: "bg-t3" },
  { id: "CANCELLED", label: "Cancelled", tone: "bg-surface2 text-muted-foreground" },
]
export const jobStatus = (s: JobStatus) => JOB_STATUSES.find((x) => x.id === s) ?? JOB_STATUSES[0]

/** How a cost is treated for tax. Plain-English hints; people should check with their accountant. */
export const EXPENSE_CLASSES: { id: ExpenseClass; label: string; detail: string }[] = [
  { id: "CAPITAL_IMPROVEMENT", label: "Improvement", detail: "Adds or upgrades: a renovation, new deck, new hot water system" },
  { id: "REPAIR_MAINTENANCE", label: "Repair", detail: "Fixes or maintains what's there: a leak, a service, repainting" },
  { id: "FURNISHING", label: "Furnishing", detail: "Things that aren't part of the house: furniture, rugs" },
  { id: "OTHER", label: "Other", detail: "Anything else" },
]
export const expenseClass = (c: ExpenseClass) => EXPENSE_CLASSES.find((x) => x.id === c) ?? EXPENSE_CLASSES[3]

export const EXPENSE_CATEGORIES = ["Materials", "Labour", "Appliance", "Permits & Fees", "Hire", "Delivery", "Other"]
export const PAYMENT_METHODS = ["Card", "Bank Transfer", "Cash", "BNPL", "Other"]

export const TRADES = ["Builder", "Electrician", "Plumber", "Carpenter", "Painter", "Tiler", "Landscaper", "Roofer", "Handyman", "Air Conditioning", "Other"]
