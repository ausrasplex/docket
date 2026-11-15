import { AuthField } from "@/components/auth-card"

/** Name, email and password for a new account (first run and invite links). */
export function NewAccountFields() {
  return (
    <>
      <AuthField label="Your name" name="name" autoComplete="name" required autoFocus />
      <AuthField label="Email (to sign in with)" name="email" type="email" autoComplete="username" required />
      <AuthField label="Password (10 characters or more)" name="password" type="password" autoComplete="new-password" minLength={10} required />
    </>
  )
}
