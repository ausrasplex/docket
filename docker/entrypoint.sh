#!/bin/sh
# Starts Docket in its container: checks the settings it can't run without, brings the database up to date, then
# starts the web server.
set -e

if [ -z "$DATABASE_URL" ]; then
  echo "Docket: DATABASE_URL is not set. It points Docket at its PostgreSQL database, for example" >&2
  echo "        postgresql://docket:PASSWORD@192.168.1.10:5432/docket?schema=public" >&2
  exit 1
fi
if [ "${#BETTER_AUTH_SECRET}" -lt 32 ]; then
  echo "Docket: BETTER_AUTH_SECRET is missing or shorter than 32 characters. Make one with:" >&2
  echo "        openssl rand -base64 32" >&2
  echo "        Changing it later signs everyone out." >&2
  exit 1
fi
if [ -z "$BETTER_AUTH_URL" ]; then
  echo "Docket: BETTER_AUTH_URL is not set. It's the address people open Docket on, for example" >&2
  echo "        http://192.168.1.10:3000 or https://docket.example.com" >&2
  exit 1
fi

mkdir -p "${UPLOAD_DIR:-/data/uploads}"
if ! [ -w "${UPLOAD_DIR:-/data/uploads}" ]; then
  echo "Docket: can't write to ${UPLOAD_DIR:-/data/uploads}. On Unraid the data folder should belong to nobody:users (99:100)." >&2
  exit 1
fi

mkdir -p "${BACKUP_DIR:-/data/backups}" 2>/dev/null || true
if ! [ -w "${BACKUP_DIR:-/data/backups}" ]; then
  echo "Docket: can't write to the backups folder ${BACKUP_DIR:-/data/backups}, so nightly backups will fail. It should belong to nobody:users (99:100)." >&2
fi

# Apply any database updates in this version. PostgreSQL can still be starting (after a reboot, say), so try for a
# couple of minutes before giving up.
tries=0
until (cd /opt/prisma-cli && node node_modules/prisma/build/index.js migrate deploy --config /opt/prisma-cli/prisma.config.mjs); do
  tries=$((tries + 1))
  if [ "$tries" -ge 24 ]; then
    echo "Docket: couldn't reach the database to update it. Check DATABASE_URL and that PostgreSQL is running." >&2
    exit 1
  fi
  echo "Docket: waiting for the database (try $tries of 24)"
  sleep 5
done

echo "Docket: starting on port ${PORT:-3000}"
exec node /app/server.js
