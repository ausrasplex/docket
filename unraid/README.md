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

Back up both:

- the **database** (your usual Postgres backup), and
- the **Data** folder (`/mnt/user/appdata/docket`), which holds every uploaded manual, receipt and photo.

## Updating

Pull the new image (**Docker** › **Check for Updates**). Database updates are applied automatically when the container starts.

## Health

The container reports healthy once `/api/health` answers and the database is reachable.
