"use client"

import { useState, useTransition } from "react"
import { Clock, KeyRound, Link2, MoreHorizontal, UserMinus, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Drawer, FieldLabel, OptionRow } from "@/components/drawer"
import { CopyField } from "@/components/copy-field"
import { Initials } from "@/components/shell/initials"
import { ROLE_DETAILS, ROLE_LABELS } from "@/lib/roles"
import type { Role } from "@/generated/prisma/enums"
import { changeRole, createInvite, createResetLink, removeMember, revokeInvite } from "./actions"

export type MemberRow = { id: string; userId: string; name: string; email: string; role: Role; isMe: boolean }
export type InviteRow = { id: string; role: Role; uses: number; maxUses: number; expires: string | null; by: string }

const EXPIRY = [
  { days: 1, label: "1 day" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: null, label: "Never" },
] as const

export function Members({
  members,
  invites,
  myRole,
  householdName,
}: {
  members: MemberRow[]
  invites: InviteRow[]
  myRole: Role
  householdName: string
}) {
  const canManage = myRole === "OWNER" || myRole === "ADMIN"
  const [inviteOpen, setInviteOpen] = useState(false)
  const [link, setLink] = useState<{ title: string; url: string; note: string } | null>(null)
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done?: string) =>
    start(async () => {
      const r = await fn()
      if (!r.ok) toast.error(r.error)
      else if (done) toast(done)
    })

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <ul className="flex flex-col">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
            <Initials name={m.name} size={40} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[15px] font-bold">
                {m.name}
                {m.isMe ? <span className="font-medium text-muted-foreground"> (you)</span> : null}
              </span>
              <span className="truncate text-xs font-medium text-muted-foreground">{m.email}</span>
            </span>
            <Badge variant={m.role === "OWNER" ? "t1" : m.role === "ADMIN" ? "t2" : "outline"}>{ROLE_LABELS[m.role]}</Badge>
            {canManage && !m.isMe && m.role !== "OWNER" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Options for ${m.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Role</DropdownMenuLabel>
                  {(["ADMIN", "MEMBER", "VIEWER"] as Role[])
                    .filter((r) => r !== "ADMIN" || myRole === "OWNER")
                    .map((r) => (
                      <DropdownMenuItem key={r} disabled={r === m.role} onSelect={() => run(() => changeRole(m.id, r), `${m.name} is now ${ROLE_LABELS[r].toLowerCase()}`)}>
                        {ROLE_LABELS[r]}
                        {r === m.role ? <span className="ml-auto text-xs text-muted-foreground">Current</span> : null}
                      </DropdownMenuItem>
                    ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() =>
                      start(async () => {
                        const r = await createResetLink(m.id)
                        if (!r.ok) return void toast.error(r.error)
                        setLink({ title: `Reset Link for ${m.name}`, url: r.url, note: "Send this to them. It works once, for 24 hours, and signs them out everywhere." })
                      })
                    }
                  >
                    <KeyRound />
                    Make Password Reset Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      if (confirm(`Remove ${m.name} from ${householdName}? Their account stays, but they lose access here.`)) {
                        run(() => removeMember(m.id), `${m.name} removed`)
                      }
                    }}
                  >
                    <UserMinus />
                    Remove from Household
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </li>
        ))}
      </ul>

      {canManage && invites.length ? (
        <div className="flex flex-col gap-2">
          <h3 className="text-[13px] font-bold text-muted-foreground">Open Invite Links</h3>
          {invites.map((i) => (
            <div key={i.id} className="flex items-center gap-3 rounded-[14px] border border-line px-3 py-2.5">
              <span className="flex size-9 flex-none items-center justify-center rounded-full bg-t3">
                <Link2 className="size-[18px]" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-bold">
                  {ROLE_LABELS[i.role]} · {i.uses} of {i.maxUses} used
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  {i.expires ? `Expires ${i.expires}` : "Never expires"} · by {i.by}
                </span>
              </span>
              <Button variant="destructive" size="xs" onClick={() => run(() => revokeInvite(i.id), "Invite link revoked")}>
                Revoke
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {canManage ? (
        <Button variant="outline" className="self-start" onClick={() => setInviteOpen(true)}>
          <UserPlus />
          Invite Someone
        </Button>
      ) : null}

      <InviteDrawer
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        myRole={myRole}
        householdName={householdName}
        onCreated={(url) => {
          setInviteOpen(false)
          setLink({ title: "Invite Link", url, note: "Send this by text or any messaging app. Only a code is stored, so this is the only time it's shown." })
        }}
      />

      <Drawer open={!!link} onOpenChange={(o) => !o && setLink(null)} title={link?.title ?? ""} description={link?.note}>
        {link ? <CopyField value={link.url} shareTitle={`Join ${householdName} on Docket`} /> : null}
      </Drawer>
    </div>
  )
}

function InviteDrawer({
  open,
  onOpenChange,
  myRole,
  householdName,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  myRole: Role
  householdName: string
  onCreated: (url: string) => void
}) {
  const [role, setRole] = useState<Role>("MEMBER")
  const [days, setDays] = useState<number | null>(7)
  const [uses, setUses] = useState(1)
  const [pending, start] = useTransition()
  const roles: Role[] = myRole === "OWNER" ? ["ADMIN", "MEMBER", "VIEWER"] : ["MEMBER", "VIEWER"]
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Invite Someone"
      description={`Make a link that adds a person to ${householdName}.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await createInvite({ role, expiresInDays: days, maxUses: uses })
                if (!r.ok) toast.error(r.error)
                else onCreated(r.url)
              })
            }
          >
            Make Link
          </Button>
        </>
      }
    >
      <div role="radiogroup" aria-label="Role" className="flex flex-col gap-2">
        <span className="text-[13px] font-bold text-muted-foreground">Role</span>
        {roles.map((r) => (
          <OptionRow key={r} selected={role === r} onSelect={() => setRole(r)} title={ROLE_LABELS[r]} detail={ROLE_DETAILS[r]} />
        ))}
      </div>
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
      <FieldLabel label="Number of People" hint="How many people can join with this one link.">
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
  )
}
