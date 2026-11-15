"use client"

import { useActionState } from "react"
import { AuthField, FormError } from "@/components/auth-card"
import { SubmitButton } from "@/components/submit-button"
import { signIn } from "../actions"

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, undefined)
  return (
    <form action={action} className="flex flex-col gap-[18px]">
      <FormError message={state?.error} />
      <input type="hidden" name="next" value={next} />
      <AuthField label="Email" name="email" type="email" autoComplete="username" required autoFocus />
      <AuthField label="Password" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton>Sign In</SubmitButton>
    </form>
  )
}
