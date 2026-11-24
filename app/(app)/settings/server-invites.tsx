"use client"

import { useState, useTransition } from "react"
import { Clock, House, HousePlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Drawer, FieldLabel } from "@/components/drawer"
import { CopyField } from "@/components/copy-field"
import { createHouseholdInvite, revokeHouseholdInvite } from "./actions"

type Row = { id: string; uses: number; maxUses: number; expires: string | null; by: string }

const EXPIRY = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: null, label: "Never" },
] as const

/** New Household links: make one, see the open ones, revoke them. */
export function HouseholdInvites({ invites }: { invites: Row[] }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState<string | null>(null)
  const [days, setDays] = useState<number | null>(7)
  const [uses, setUses] = useState(1)
  const [pending, start] = useTransition()

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-[13px] font-bold text-muted-foreground">New Household Invites</h3>
      <p className="-mt-1 text-xs font-medium text-muted-foreground">
        A link for someone outside your household. They make an account and set up a household of their own; you won&apos;t be a member of it.
      </p>
      {invites.map((i) => (
        <div key={i.id} className="flex items-center gap-3 rounded-[14px] border border-line px-3 py-2.5">
          <span className="flex size-9 flex-none items-center justify-center rounded-full bg-a2 text-on-a">
            <House className="size-[18px]" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-bold">
              New household · {i.uses} of {i.maxUses} used
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {i.expires ? `Expires ${i.expires}` : "Never expires"} · by {i.by}
            </span>
          </span>
          <Button
            variant="destructive"
            size="xs"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await revokeHouseholdInvite(i.id)
                if (!r.ok) toast.error(r.error)
                else toast("Invite link revoked")
              })
            }
          >
            Revoke
          </Button>
        </div>
      ))}
      <Button variant="outline" className="self-start" onClick={() => setOpen(true)}>
        <HousePlus />
        Invite a New Household
      </Button>

      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Invite a New Household"
        description="Make a link that lets someone create an account and start their own household on this server."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await createHouseholdInvite({ expiresInDays: days, maxUses: uses })
                  if (!r.ok) return void toast.error(r.error)
                  setOpen(false)
                  setUrl(r.url)
                })
              }
            >
              Make Link
            </Button>
          </>
        }
      >
        <div role="radiogroup" aria-label="Link expires" className="flex flex-col gap-2">
          <span className="text-[13px] font-bold text-muted-foreground">Link Expires</span>
          <div className="flex flex-wrap gap-2">
            {EXPIRY.map((e) => (
              <button
                key={e.label}
                type="button"
                role="radio"
                aria-checked={days === e.days}
                onClick={() => setDays(e.days)}
                className={
                  "min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold " +
                  (days === e.days ? "bg-primary text-primary-foreground" : "border border-outline bg-surface hover:bg-surface2")
                }
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>
        <FieldLabel label="Number of Households" hint="How many people can each start a household with this one link.">
          <input
            type="number"
            min={1}
            max={50}
            value={uses}
            onChange={(e) => setUses(Number(e.target.value) || 1)}
            className="h-12 w-28 rounded-md border border-line bg-surface2 px-3.5 text-base text-ink"
          />
        </FieldLabel>
      </Drawer>

      <Drawer
        open={!!url}
        onOpenChange={(o) => !o && setUrl(null)}
        title="New Household Link"
        description="Send this by text or any messaging app. Only a code is stored, so this is the only time it's shown."
      >
        {url ? <CopyField value={url} shareTitle="Start your household on Docket" /> : null}
      </Drawer>
    </div>
  )
}
