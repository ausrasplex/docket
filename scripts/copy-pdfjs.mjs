// Copies pdf.js's worker and the files it fetches at run time (wasm image decoders, character maps, colour profiles,
// standard fonts) into public/pdfjs, so the viewer loads them from Docket itself. Runs before dev and build.
import { cp, mkdir, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"

const root = path.dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"))
const out = path.resolve("public/pdfjs")
await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
await cp(path.join(root, "legacy/build/pdf.worker.min.mjs"), path.join(out, "pdf.worker.min.mjs"))
for (const dir of ["wasm", "cmaps", "standard_fonts", "iccs"]) await cp(path.join(root, dir), path.join(out, dir), { recursive: true })
