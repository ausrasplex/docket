"use client"

import { useState, useTransition } from "react"
import { LogOut } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { signOut } from "@/app/(auth)/actions"
import { renameHousehold, updateProfile } from "./actions"

/** Your name and Sign Out (Sign Out lives here on phones, where there's no sidebar). */
export function Profile({ name, email }: { name: string; email: string }) {
  const [v, setV] = useState(name)
  const [pending, start] = useTransition()
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-bold text-muted-foreground">Name</span>
        <div className="flex gap-2.5">
          <Input value={v} onChange={(e) => setV(e.target.value)} autoComplete="name" />
          <Button
            variant="outline"
            disabled={pending || v.trim() === name}
            onClick={() => start(async () => {
              const r = await updateProfile(v)
              if (r.ok) toast("Name saved")
              else toast.error(r.error)
            })}
          >
            Save
          </Button>
        </div>
      </label>
      <p className="text-sm text-muted-foreground">
        Signs in as <b className="text-ink">{email}</b>
      </p>
      <form action={signOut}>
        <Button type="submit" variant="destructive" className="w-full desk:w-auto">
          <LogOut />
          Sign Out
        </Button>
      </form>
    </div>
  )
}

export function HouseholdName({ name, canEdit }: { name: string; canEdit: boolean }) {
  const [v, setV] = useState(name)
  const [pending, start] = useTransition()
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-muted-foreground">Household Name</span>
      <div className="flex gap-2.5">
        <Input value={v} onChange={(e) => setV(e.target.value)} readOnly={!canEdit} />
        {canEdit ? (
          <Button
            variant="outline"
            disabled={pending || v.trim() === name}
            onClick={() => start(async () => {
              const r = await renameHousehold(v)
              if (r.ok) toast("Household renamed")
              else toast.error(r.error)
            })}
          >
            Save
          </Button>
        ) : null}
      </div>
    </label>
  )
}
