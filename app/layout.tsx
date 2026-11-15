import type { Metadata, Viewport } from "next"
import "@fontsource/plus-jakarta-sans/400.css"
import "@fontsource/plus-jakarta-sans/500.css"
import "@fontsource/plus-jakarta-sans/600.css"
import "@fontsource/plus-jakarta-sans/700.css"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { APPLY_APPEARANCE_SCRIPT, DEFAULT_THEME } from "@/lib/theme"

export const metadata: Metadata = {
  title: "Docket",
  description: "Your home's rooms, fixtures, manuals, paint and receipts, all in one place.",
  // the favicon comes from app/icon.png (Next's file convention)
  icons: { apple: "/apple-touch-icon.png" },
  appleWebApp: { title: "Docket", statusBarStyle: "default" },
}

export const viewport: Viewport = { width: "device-width", initialScale: 1 }

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // the inline script may change data-theme and the dark class before hydration
    <html lang="en-AU" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPLY_APPEARANCE_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster position="bottom-center" duration={2000} />
      </body>
    </html>
  )
}
