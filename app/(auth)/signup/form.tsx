"use client"

import { useActionState } from "react"
import { FormError } from "@/components/auth-card"
import { NewAccountFields } from "@/components/new-account-fields"
import { SubmitButton } from "@/components/submit-button"
import { signUpFirst } from "../actions"

export function SignUpForm() {
  const [state, action] = useActionState(signUpFirst, undefined)
  return (
    <form action={action} className="flex flex-col gap-[18px]">
      <FormError message={state?.error} />
      <NewAccountFields />
      <SubmitButton>Create Account</SubmitButton>
    </form>
  )
}
