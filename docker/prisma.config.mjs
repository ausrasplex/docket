// Prisma settings inside the container, used only to apply database updates at start-up
// (the app's own prisma.config.ts needs dotenv and the source tree, which the image doesn't carry).
import { defineConfig } from "prisma/config"

export default defineConfig({
  schema: "/app/prisma/schema.prisma",
  migrations: { path: "/app/prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
})
