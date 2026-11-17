# Docket on Unraid

## Before You Start

1. **PostgreSQL:** create an empty database for Docket on your Postgres container, for example `docket`, owned by a user Docket can sign in as.
2. **The image:** pushing this repo to GitHub runs `.github/workflows/docker.yml`, which publishes `ghcr.io/ausrasplex/docket`. A private repo makes the image private too. Either make the package public (your profile › Packages › docket › Package settings), or sign Unraid in with `docker login ghcr.io`.
3. **The data folder:** create `/mnt/user/appdata/docket`. It should belong to `nobody:users` (99:100), which Unraid's own shares already do.

## Install

1. Copy `docket.xml` to `/boot/config/plugins/dockerMan/templates-user/my-Docket.xml`.
2. Go to **Docker** › **Add Container** and choose **Docket** from the template list.
3. Fill in:
   - **Database URL:** `postgresql://USER:PASSWORD@UNRAID-IP:5432/docket?schema=public`
   - **Secret key:** the output of `openssl rand -base64 32`. Keep a copy; changing it signs everyone out.
   - **Docket address:** the address people open it on, such as `http://192.168.1.10:3000`. If you put it behind a reverse proxy with a domain, use that (`https://docket.example.com`) and list the LAN address under **Other addresses** if you also use it.
4. Apply. On start, Docket waits for the database (up to two minutes), applies any database updates, then starts. Open the Web UI and create the first account.

## Backups

Docket backs itself up every night (from 3 am, or soon after it starts if it was off) into the **Backups** folder, `/mnt/user/backups/docket` by default:

- `database/docket-2026-11-17-030000.json.gz`: every record of every household. The newest 14 are kept (**Backups kept**).
- `uploads/`: a copy of every uploaded manual, receipt and photo. New files are added each night and nothing is removed, so any kept database backup still finds its files.
- `status.json`: how the last run went, also shown in **Settings** › **Backups** (admins and the owner), where **Back Up Now** runs one straight away.

Keep the Backups share on a different disk from `appdata` if you can, and **copy it off the server**: to another computer, a USB drive or cloud storage (an Unraid backup plugin, rclone or Syncthing on the share all work). A backup on the same machine won't survive the machine failing.

### Restoring

1. Create a new, empty database (for example `docket_restore`) and point the container's **Database URL** at it. Start the container once so it creates Docket's tables, using **the same Docket version** the backup was made with.
2. Run the restore inside the container:
   ```
   docker exec -it Docket node scripts/restore.mjs /data/backups/database/docket-2026-11-17-030000.json.gz
   ```
   It refuses to touch a database that already has records in it, loads everything in one go (all or nothing), then copies the backed-up files into the Data folder.
3. Restart the container and sign in as before.

`node scripts/restore.mjs <file> --check` only reads a backup and says what it holds.

## Updating

Pull the new image (**Docker** › **Check for Updates**). Database updates are applied automatically when the container starts.

## Health

The container reports healthy once `/api/health` answers and the database is reachable.
