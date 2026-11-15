import { Mark } from "@/components/brand/logo"

/** Folio's sign-in card: centred, 28px corners, the mark on top, title and a short line under it. */
export function AuthCard({ title, sub, children }: { title: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-6">
      <div className="flex w-full max-w-[420px] flex-col gap-[18px] rounded-[28px] bg-surface px-7 py-8 shadow-[0_10px_40px_rgba(0,0,0,.06)]">
        <Mark size={56} />
        <div className="flex flex-col gap-1.5">
          <h1>{title}</h1>
          {sub ? <p className="text-sm leading-normal text-muted-foreground">{sub}</p> : null}
        </div>
        {children}
      </div>
    </main>
  )
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-[14px] bg-danger-soft px-3.5 py-3 text-sm font-semibold text-danger">
      {message}
    </div>
  )
}

export function AuthField({ label, ...props }: { label: string } & React.ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold text-muted-foreground">{label}</span>
      <input
        {...props}
        className="h-12 w-full rounded-md border border-outline bg-surface px-3.5 text-base text-ink outline-none focus-visible:border-sel focus-visible:ring-2 focus-visible:ring-sel-soft"
      />
    </label>
  )
}
