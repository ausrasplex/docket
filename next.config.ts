import type { NextConfig } from "next"

// Security headers on every page and file (as in Folio and app-starter).
// The development server also needs eval (hot reload) and a WebSocket.
const dev = process.env.NODE_ENV !== "production"
const csp = [
  "default-src 'self'",
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  // 'unsafe-inline' covers the small script in layout.tsx that applies the theme before the page is drawn
  // 'wasm-unsafe-eval' lets the PDF viewer compile pdf.js's image decoders (scanned pages are often JBIG2/JPEG 2000)
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'" + (dev ? " 'unsafe-eval'" : ""),
  "worker-src 'self'",
  "connect-src 'self'" + (dev ? " ws: wss:" : ""),
  // PDFs open in the browser's own viewer from /api/files
  "object-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // the Docker image builds a standalone server; a plain `npm run build && npm start` doesn't need it
  output: process.env.DOCKET_STANDALONE ? "standalone" : undefined,
  // file tracing copies sharp's native module but not the libvips libraries it loads (on Linux they're a
  // separate @img/sharp-libvips-* package), so uploads would fail in the standalone server without these
  outputFileTracingIncludes: {
    "/api/documents": ["./node_modules/@img/**/*", "./node_modules/sharp/**/*", "./node_modules/pdfjs-dist/legacy/build/**/*"],
    // searching an item's documents reads older PDFs' text the first time
    "/fixtures/[id]": ["./node_modules/pdfjs-dist/legacy/build/**/*"],
  },
  // pdf.js reads PDFs' text on the server; it loads its own worker module, so it isn't bundled
  serverExternalPackages: ["pdfjs-dist"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // the camera is used by Capture (photos of receipts and labels)
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
        ],
      },
    ]
  },
}

export default nextConfig
