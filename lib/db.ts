import "server-only"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"

// One client per server process, kept across hot reloads in dev so they don't open new connections each time.
// The cached client is only reused if it was made by the current generated PrismaClient: after a schema change
// and `prisma generate`, hot reload loads a new PrismaClient class, and a client from the old one would reject
// the new fields ("Unknown field …") until the dev server restarted.
const globalForPrisma = globalThis as unknown as { prisma?: { client: PrismaClient; ctor: typeof PrismaClient } }

function create() {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
}

const cached = globalForPrisma.prisma
if (cached && cached.ctor !== PrismaClient) void cached.client.$disconnect().catch(() => {})

export const db = cached?.ctor === PrismaClient ? cached.client : create()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = { client: db, ctor: PrismaClient }
