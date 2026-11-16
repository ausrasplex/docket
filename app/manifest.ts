import type { MetadataRoute } from "next"

// Installable on phones ("Add to Home Screen"); camera capture builds on this in phase 1.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Docket",
    short_name: "Docket",
    description: "Your home's rooms, fixtures, manuals, paint and receipts, all in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f1f4",
    theme_color: "#f1f1f4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
