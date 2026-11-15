"use client"

import { useId, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { KeyRound, LogOut, Mail } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Drawer, FieldLabel } from "@/components/drawer"
import { signOut } from "@/app/(auth)/actions"
import { changeEmail, changePassword, renameHousehold, updateProfile } from "./actions"

/** Your name, the email you sign in with, your password, and Sign Out (which lives here on phones). */
export function Profile({ name, email }: { name: string; email: string }) {
  const nameId = useId()
  const [v, setV] = useState(name)
  const [pending, start] = useTransition()
  const [emailOpen, setEmailOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      {/* the label covers only the field, so the Save button isn't read as part of its name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={nameId} className="text-[13px] font-bold text-muted-foreground">
          Name
        </label>
        <div className="flex gap-2.5">
          <Input id={nameId} value={v} onChange={(e) => setV(e.target.value)} autoComplete="name" />
          <Button
            variant="outline"
            disabled={pending || v.trim() === name}
            onClick={() =>
              start(async () => {
                const r = await updateProfile(v)
                if (r.ok) toast("Name saved")
                else toast.error(r.error)
              })
            }
          >
            Save
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-surface2 p-3">
        <div className="flex items-center gap-3">
          <Mail className="size-5 text-muted-foreground" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-xs font-semibold text-muted-foreground">Signs in as</span>
            <span className="truncate text-sm font-bold">{email}</span>
          </span>
          <Button variant="outline" size="sm" className="bg-surface" onClick={() => setEmailOpen(true)}>
            Change Email
          </Button>
        </div>
        <div className="flex items-center gap-3 border-t border-line pt-2">
          <KeyRound className="size-5 text-muted-foreground" />
          <span className="flex-1 text-sm font-bold">Password</span>
          <Button variant="outline" size="sm" className="bg-surface" onClick={() => setPasswordOpen(true)}>
            Change Password
          </Button>
        </div>
      </div>

      <form action={signOut}>
        <Button type="submit" variant="destructive" className="w-full desk:w-auto">
          <LogOut />
          Sign Out
        </Button>
      </form>

      <EmailDrawer open={emailOpen} onOpenChange={setEmailOpen} current={email} />
      <PasswordDrawer open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  )
}

function EmailDrawer({ open, onOpenChange, current }: { open: boolean; onOpenChange: (o: boolean) => void; current: string }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, start] = useTransition()
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setEmail("")
      setPassword("")
    }
  }
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Change Email"
      description={`You sign in with ${current} now. Docket never sends email, so this is only your sign-in name.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || !email.trim() || !password}
            onClick={() =>
              start(async () => {
                const r = await changeEmail(email, password)
                if (!r.ok) return void toast.error(r.error)
                toast("Email changed. Use it next time you sign in.")
                onOpenChange(false)
                router.refresh()
              })
            }
          >
            Change Email
          </Button>
        </>
      }
    >
      <FieldLabel label="New Email">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus />
      </FieldLabel>
      <FieldLabel label="Current Password" hint="To make sure it's you.">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </FieldLabel>
    </Drawer>
  )
}

function PasswordDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [others, setOthers] = useState(true)
  const [pending, start] = useTransition()
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setCurrent("")
      setNext("")
      setConfirm("")
      setOthers(true)
    }
  }
  const mismatch = !!confirm && next !== confirm
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Change Password"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || !current || next.length < 10 || next !== confirm}
            onClick={() =>
              start(async () => {
                const r = await changePassword(current, next, others)
                if (!r.ok) return void toast.error(r.error)
                toast(others ? "Password changed. Your other devices are signed out." : "Password changed")
                onOpenChange(false)
              })
            }
          >
            Change Password
          </Button>
        </>
      }
    >
      <FieldLabel label="Current Password">
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" autoFocus />
      </FieldLabel>
      <FieldLabel label="New Password" hint="10 characters or more.">
        <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={10} />
      </FieldLabel>
      <FieldLabel label="Type It Again" hint={mismatch ? "The two new passwords don't match." : undefined}>
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" aria-invalid={mismatch} />
      </FieldLabel>
      <label className="flex min-h-15 cursor-pointer items-center gap-3 rounded-xl bg-surface2 px-3.5 py-2.5">
        <input type="checkbox" checked={others} onChange={(e) => setOthers(e.target.checked)} className="size-5 accent-[var(--sel)]" />
        <span className="flex flex-col">
          <b className="text-sm">Sign Out Other Devices</b>
          <span className="text-xs text-muted-foreground">Recommended if you think someone else knows your password.</span>
        </span>
      </label>
    </Drawer>
  )
}

export function HouseholdName({ name, canEdit }: { name: string; canEdit: boolean }) {
  const id = useId()
  const [v, setV] = useState(name)
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-bold text-muted-foreground">
        Household Name
      </label>
      <div className="flex gap-2.5">
        <Input id={id} value={v} onChange={(e) => setV(e.target.value)} readOnly={!canEdit} />
        {canEdit ? (
          <Button
            variant="outline"
            disabled={pending || v.trim() === name}
            onClick={() =>
              start(async () => {
                const r = await renameHousehold(v)
                if (r.ok) toast("Household renamed")
                else toast.error(r.error)
              })
            }
          >
            Save
          </Button>
        ) : null}
      </div>
    </div>
  )
}
