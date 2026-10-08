# Deploy with Docker

Run these commands from the repository root. Requires Docker Engine or Docker Desktop (Linux containers) and Docker Compose v2.20+. The existing dependency lockfile targets Linux x64, so the app image uses `linux/amd64`; ARM hosts need x64 emulation enabled in Docker. Native ARM builds are not currently supported by that lockfile.

## 1. Create private configuration

```sh
cp -n .env.docker.example .env.docker
chmod 600 .env.docker
```

Edit `.env.docker`. Set **two different** random secrets for `POSTGRES_PASSWORD` and `EMAIL_SETTINGS_KEY`. Generate each with `openssl rand -hex 32`, or with Docker if OpenSSL is unavailable:

```sh
docker run --rm node:24.14.1-trixie-slim node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))'
```

Keep this file private and keep a secure copy separately from database backups. The email key must stay the same across rebuilds/restores. Changing the PostgreSQL password in this file does not change a password already stored in an existing database volume; coordinate database password rotation separately.

The default entry point is `http://localhost:8080`. If changing `APP_PORT`, also change the port in `PUBLIC_APP_URL`. `RESEND_API_KEY` and `EMAIL_FROM` are optional; Google mail can be connected later in HRMO Email settings. Real Google credentials and university signatories are never built into the image.

## 2. Build and start

```sh
docker compose --env-file .env.docker up -d --build --wait
```

Open **http://localhost:8080**. The app container serves both the UI and API. Python 3.13/PyMuPDF and contract templates are included. Database tables initialize automatically. PostgreSQL has no published host port; the app port binds only to the host's loopback interface.

```sh
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs --tail=100 app
```

This starts a new database. Existing records from another installation are **not automatically migrated**. To move them, first download its portal SQL backup, provision HRMO below, and restore using HRMO Database backups. Use the same email encryption key as the old installation if you want its Google credentials to remain usable. After restore, sign in with an HRMO account/password from the restored backup. For larger/full PostgreSQL dumps, follow the administrator restore procedure in the root README against a separate database first.

## 3. Create the first HRMO account

After `up --wait` succeeds, use a Bash shell to read credentials without putting the password in shell history:

```sh
read -r -p 'HRMO email: ' HRMO_EMAIL
read -r -p 'HRMO display name: ' HRMO_NAME
read -r -s -p 'HRMO password (12–128 characters): ' HRMO_PASSWORD
printf '\n'
export HRMO_EMAIL HRMO_NAME HRMO_PASSWORD
docker compose --env-file .env.docker run --rm --no-deps \
  -e HRMO_EMAIL -e HRMO_NAME -e HRMO_PASSWORD \
  app node /app/api/create-hrmo.mjs
unset HRMO_EMAIL HRMO_NAME HRMO_PASSWORD
```

Existing accounts are not overwritten or promoted. Applicants register through the portal. Set official contract signatories in HRMO Contract settings, then configure Google email and send a test message if account recovery by email is needed.

## 4. Publish on a server with HTTPS

Point a domain's DNS to the server, allow inbound TCP 80/443 (and optionally UDP 443 for HTTP/3), and set `DOMAIN` in `.env.docker`, for example `renewals.example.edu.ph` — just a hostname, without a scheme or path.

```sh
docker compose --env-file .env.docker -f compose.yaml -f compose.https.yaml \
  up -d --build --wait
```

Caddy obtains and renews HTTPS certificates and forwards requests to the app. The public URL becomes `https://YOUR_DOMAIN`; the overlay sets `PUBLIC_APP_URL` automatically. In Google Console, register the callback `https://YOUR_DOMAIN/api/admin/email/google/callback`. Certificate issuance requires real DNS and public reachability; localhost validation cannot verify it.

Use the **same two `-f` options** for subsequent `up`, `down`, `ps`, `logs` and `run` commands on this HTTPS deployment. The overlay trusts exactly one proxy hop, so authentication limits use the requesting client's address. Keep the direct app port private; do not expose it to the public internet when proxy trust is enabled. If using your existing reverse proxy instead, terminate HTTPS there, set `PUBLIC_APP_URL`, allow at least 50 MB request bodies for SQL restore, and enable `TRUST_PROXY_HOPS=1` only when every request passes through that single trusted proxy.

Production cookies are marked Secure. The local HTTP entry point works with browsers that allow Secure cookies on localhost (including Chrome); remote HTTP/IP-address access is not a supported production setup. Use HTTPS for users outside the Docker host.

## Records, backups and updates

Compose retains named volumes for:

- `database`: users, applications, uploads, generated PDFs and review history.
- `recovery`: automatic SQL copies made before portal restores.
- `certificates` and `caddy_config`: HTTPS state when the overlay is used.

The app runs as an unprivileged user with a read-only root filesystem. Its recovery volume and temporary directory are writable. Private env files and backups are excluded from the Docker build context.

Before updates, download a SQL backup and store it outside the Docker host. Ordinary stop/rebuild commands preserve volumes:

```sh
docker compose --env-file .env.docker down
docker compose --env-file .env.docker up -d --build --wait
```

**Do not add `--volumes` / `-v` to `down` unless intentionally deleting the database and recovery copies.** Keep the Compose project name stable so deployments reuse the same volumes. Do not change PostgreSQL major versions by editing the image tag without planning a database upgrade.

For an additional full SQL dump:

```sh
umask 077
docker compose --env-file .env.docker exec -T db \
  pg_dump -U ustp -d ustp --format=plain --no-owner --no-privileges > "$HOME/ustp-full-backup.sql"
```

Keep dumps in private storage outside the repository/server and check the command succeeded. A named volume alone does not protect against losing the Docker host. Backups are manual; no automatic off-server schedule is configured.
