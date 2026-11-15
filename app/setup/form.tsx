"use client"

import { useActionState } from "react"
import { AuthField, FormError } from "@/components/auth-card"
import { SubmitButton } from "@/components/submit-button"
import { createHousehold } from "./actions"

export function SetupForm({ householdName, hasHousehold }: { householdName: string; hasHousehold: boolean }) {
  const [state, action] = useActionState(createHousehold, undefined)
  return (
    <form action={action} className="flex flex-col gap-[18px]">
      <FormError message={state?.error} />
      <AuthField label="Household" name="household" defaultValue={householdName} readOnly={hasHousehold} required />
      <AuthField label="Property name" name="property" defaultValue="Home" required />
      <AuthField label="Address (optional)" name="address" autoComplete="street-address" />
      <label className="flex min-h-15 cursor-pointer items-center gap-3 rounded-xl bg-surface2 px-3.5 py-2.5">
        <input type="checkbox" name="starter" defaultChecked className="size-5 accent-[var(--sel)]" />
        <span className="flex flex-col">
          <b className="text-sm">Add common rooms</b>
          <span className="text-xs text-muted-foreground">Kitchen, bathroom, laundry, garage and so on. Rename or remove any later.</span>
        </span>
      </label>
      <SubmitButton>Start Using Docket</SubmitButton>
    </form>
  )
}
