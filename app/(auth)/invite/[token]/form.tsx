"use client"

import { useActionState } from "react"
import { AuthField, FormError } from "@/components/auth-card"
import { NewAccountFields } from "@/components/new-account-fields"
import { SubmitButton } from "@/components/submit-button"
import { acceptHouseholdInvite, acceptInvite } from "../../actions"

export function InviteForm({ token, signedInAs }: { token: string; signedInAs: string | null }) {
  const [state, action] = useActionState(acceptInvite.bind(null, token), undefined)
  return (
    <form action={action} className="flex flex-col gap-[18px]">
      <FormError message={state?.error} />
      {signedInAs ? (
        <p className="text-sm text-muted-foreground">
          Signed in as <b className="text-ink">{signedInAs}</b>.
        </p>
      ) : (
        <NewAccountFields />
      )}
      <SubmitButton>{signedInAs ? "Join Household" : "Create Account and Join"}</SubmitButton>
    </form>
  )
}

/** A new-household link: an account (unless signed in), then their own household and first property. */
export function HouseholdInviteForm({ token, signedInAs }: { token: string; signedInAs: string | null }) {
  const [state, action] = useActionState(acceptHouseholdInvite.bind(null, token), undefined)
  return (
    <form action={action} className="flex flex-col gap-[18px]">
      <FormError message={state?.error} />
      {signedInAs ? (
        <p className="text-sm text-muted-foreground">
          Signed in as <b className="text-ink">{signedInAs}</b>. This adds a new household to your account.
        </p>
      ) : (
        <NewAccountFields />
      )}
      <AuthField label="Household name" name="household" placeholder="The Smith household" required />
      <AuthField label="Property name" name="property" defaultValue="Home" required />
      <AuthField label="Address (optional)" name="address" autoComplete="street-address" />
      <label className="flex min-h-15 cursor-pointer items-center gap-3 rounded-xl bg-surface2 px-3.5 py-2.5">
        <input type="checkbox" name="starter" defaultChecked className="size-5 accent-[var(--sel)]" />
        <span className="flex flex-col">
          <b className="text-sm">Add common rooms</b>
          <span className="text-xs text-muted-foreground">Kitchen, bathroom, laundry, garage and so on. Rename or remove any later.</span>
        </span>
      </label>
      <SubmitButton>{signedInAs ? "Start Household" : "Create Account and Start"}</SubmitButton>
    </form>
  )
}
