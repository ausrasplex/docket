import "dotenv/config"
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // a placeholder lets `prisma generate` and `prisma validate` run before a database exists
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://placeholder@localhost:5432/docket" },
})
