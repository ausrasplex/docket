"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { cn } from "cn"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ADD } from "./nav"

const TONE = { a1: "bg-a1", a2: "bg-a2", a3: "bg-a3" } as const

/** Folio's Add button: a full-width pill in the sidebar, the raised round + in the middle of the phone tab bar. */
export function AddMenu({ variant }: { variant: "side" | "tab" }) {
  return (
    <DropdownMenu modal>
      <DropdownMenuTrigger
        aria-label="Add"
        className={cn(
          "group flex cursor-pointer items-center justify-center gap-2.5 rounded-full bg-primary font-bold text-primary-foreground shadow-raised outline-none hover:shadow-[0_6px_16px_rgba(0,0,0,.22),inset_0_0_0_999px_color-mix(in_srgb,var(--primaryInk)_14%,transparent)]",
          variant === "side" ? "min-h-11 w-full text-sm" : "-mt-[18px] size-14"
        )}
      >
        <Plus className="size-5 transition-transform duration-150 group-data-[state=open]:rotate-45" />
        {variant === "side" ? <span>Add</span> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={variant === "side" ? "right" : "top"}
        align={variant === "side" ? "start" : "center"}
        sideOffset={variant === "side" ? 24 : 16}
        className="w-[min(320px,calc(100vw-32px))] rounded-3xl p-2.5 shadow-dialog"
      >
        {ADD.map((a) => (
          <DropdownMenuItem key={a.href} asChild className="min-h-14 gap-3.5 rounded-xl px-3 py-2">
            <Link href={a.href}>
              <span className={cn("flex size-10 flex-none items-center justify-center rounded-[14px] text-on-a", TONE[a.tone])}>
                <a.icon className="size-5" />
              </span>
              <span className="flex flex-col">
                <b className="text-sm font-bold">{a.label}</b>
                <span className="text-xs font-medium text-muted-foreground">{a.detail}</span>
              </span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
