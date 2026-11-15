"use client"

import { useActionState } from "react"
import { AuthField, FormError } from "@/components/auth-card"
import { SubmitButton } from "@/components/submit-button"
import { resetPassword } from "../../actions"

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword.bind(null, token), undefined)
  return (
    <form action={action} className="flex flex-col gap-[18px]">
      <FormError message={state?.error} />
      <AuthField label="New password (10 characters or more)" name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus />
      <AuthField label="Type it again" name="confirm" type="password" autoComplete="new-password" minLength={10} required />
      <SubmitButton>Save Password</SubmitButton>
    </form>
  )
}
