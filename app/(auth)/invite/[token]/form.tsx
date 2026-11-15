"use client"

import { useActionState } from "react"
import { FormError } from "@/components/auth-card"
import { NewAccountFields } from "@/components/new-account-fields"
import { SubmitButton } from "@/components/submit-button"
import { acceptInvite } from "../../actions"

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
