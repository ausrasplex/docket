import "server-only"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { nextCookies } from "better-auth/next-js"
import { db } from "@/lib/db"
import { findUsableInvite } from "@/lib/invites"

export const INVITE_HEADER = "x-docket-invite"

// The address in BETTER_AUTH_URL is trusted automatically. List any other addresses people open Docket on
// (e.g. both http://192.168.1.10:3000 and https://docket.example.com), comma-separated.
const extraOrigins = (process.env.DOCKET_TRUSTED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean)

export const auth = betterAuth({
  appName: "Docket",
  trustedOrigins: extraOrigins,
  database: prismaAdapter(db, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // Docket sends no email: nothing to verify, and resets use one-time links made by an admin
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // refreshed daily while in use
  },
  user: {
    additionalFields: {
      theme: { type: "string", defaultValue: "lilac", input: false },
      mode: { type: "string", defaultValue: "light", input: false },
      activeHouseholdId: { type: "string", required: false, input: false },
    },
  },
  hooks: {
    // Sign-up is open only for the very first account (who then sets up a household).
    // After that, a valid invite token must come with the request.
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return
      const anyone = await db.user.count()
      if (anyone === 0) return
      const token = ctx.headers?.get(INVITE_HEADER)
      if (!token || !(await findUsableInvite(token, "JOIN"))) {
        throw new APIError("FORBIDDEN", { message: "You need an invite link to create an account." })
      }
    }),
  },
  plugins: [nextCookies()], // must be last: lets server actions set the session cookie
})

export type Session = typeof auth.$Infer.Session
