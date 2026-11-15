# Docket

A self-hosted home organiser: rooms, fixtures with their parts, manuals and warranties, paint colours, jobs, receipts and tradespeople. Several people per household, joined by invite link, with no email needed. It has Folio's look, with the same five themes in light and dark.

## Run It Locally

1. Create an empty PostgreSQL database.
2. Copy `.env.example` to `.env` and fill it in.
3. Install, set up the database and start:
   ```
   npm install
   npm run db:deploy
   npm run dev
   ```
4. Open http://localhost:3000 and create the first account. After that, people join by invite link (Settings › Invite Someone).

Uploaded files go to `UPLOAD_DIR` (`./data/uploads` by default).

## Checks

```
npm run typecheck
npm run lint
npm run build
```

## Database Changes

Edit `prisma/schema.prisma`, then `npm run db:migrate` to create a migration. The Docker image applies migrations when it starts.

## Docker and Unraid

- **The image:** `docker build -t docket .`, or push to GitHub and `.github/workflows/docker.yml` publishes `ghcr.io/ausrasplex/docket`.
- **The container:**
  - It runs as Unraid's `nobody:users` (99:100).
  - It keeps uploads in `/data`.
  - It checks its settings, waits for PostgreSQL and applies migrations on start.
  - It reports its health at `/api/health`.
- **Settings:**
  - `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ characters) and `BETTER_AUTH_URL` (the address people open it on) are required.
  - `DOCKET_TRUSTED_ORIGINS` is optional, for extra addresses.
- **Unraid:** see [unraid/README.md](unraid/README.md).

## Where Things Are

| Path | What it holds |
| --- | --- |
| `app/(app)` | The signed-in pages: Home, Rooms, Fixtures, Paint, Jobs, Documents, Capture, Settings |
| `app/(auth)` | Sign in, first account, invite and reset links |
| `app/api` | Auth, uploads, file serving, health |
| `components` | Shared UI (shadcn on Radix, styled like Folio) |
| `lib/dal.ts` | The signed-in user and household, with role checks |
| `lib/storage.ts` | Where uploads are kept and checked |
| `prisma/schema.prisma` | The data model |
