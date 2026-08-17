# Deployment

## Overview

**Three deployment paths currently coexist in this repository.** This is not a single canonical pipeline — they were built at different times and serve different purposes. This document describes all three plainly rather than presenting one as "the" deployment method.

| Path | Status (evidence-based) |
|---|---|
| Docker Compose (backend + Redis + Meilisearch + RustFS) | Actively developed — most recently touched files in the repo (`docker-compose.yml`, `Dockerfile`, `docs/deployment-guide.md` all edited within the same week) |
| GitHub Actions → PM2/SSH | Currently wired and working, but the underlying workflow file is comparatively stale (last touched ~5 months before the Docker Compose work) |
| Vercel (`vercel.json`) | Present since the project's initial scaffolding commit; git history shows no meaningful updates since — legacy/vestigial for this backend. (Distinct from separate, unrelated Vercel deployments of the admin/vendor/fleet-manager *frontend* apps, referenced only via `FRONTEND_URL_*`/`ORIGINS` pointing at `*.vercel.app` domains.) |

No CI step currently deploys via Docker Compose or Vercel — **only the GitHub Actions → PM2 workflow is automated**; the Docker Compose path is deployed manually per the steps below.

## Purpose

Give an operator the exact mechanics of each deployment path, so they know which one is live in a given environment and how to operate it.

## Docker Compose path (target/actively-developed)

### `Dockerfile` — 3-stage multi-stage build
1. **`deps`** (`node:20-alpine`): sets `PUPPETEER_SKIP_DOWNLOAD`/`PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` (a system Chromium is installed later instead); installs `python3 make g++` for native module builds; enables `corepack`/`pnpm@10.15.0`; runs `pnpm install --frozen-lockfile`.
2. **`builder`**: copies `node_modules` from `deps`, copies full source, runs `pnpm run build` (tsc → `dist/`), then `pnpm prune --prod` to drop devDependencies.
3. **`runner`**: installs `chromium`, `nss`, `freetype`, `harfbuzz`, `ca-certificates`, `ttf-freefont`, `dumb-init`; sets `NODE_ENV=production`, `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser`; copies `node_modules`/`dist`/`package.json`/`views`/`openapi.json` from builder with `--chown=node:node`; creates `uploads/agreements` and `uploads/signatures` writable by the non-root `node` user; runs as `USER node`; `EXPOSE 5001`; `HEALTHCHECK` via `wget` spider to `/`; entrypoint `dumb-init -- node dist/server.js` (reaps zombie Chromium children, forwards `SIGTERM` correctly).

### `docker-compose.yml` — full stack orchestration
Services: `backend` (built from the Dockerfile above, `restart: unless-stopped`, loads `.env` then overrides `REDIS_HOST=redis`, `MEILI_HOST=http://meilisearch:7700`, `RUSTFS_ENDPOINT=http://rustfs:9000`, `PORT=5001` — internal Docker DNS names replace the bare-metal `127.0.0.1` values), `redis` (redis:7-alpine, `--appendonly yes`, password-gated), `meilisearch` (getmeili/meilisearch:v1.10, `MEILI_ENV=production` by default — enforces the ≥16-byte master key requirement), `rustfs-permission-helper` (one-shot container that `chown -R 10001:10001` the `rustfs-data` volume before `rustfs` starts, since RustFS's image runs as uid 10001 and named volumes start root-owned — sequenced via `depends_on: condition: service_completed_successfully`), `rustfs`. All published ports (`backend:5001`, `meilisearch:7700`, `rustfs:9000`/`9001`) are bound to `127.0.0.1` only; `redis` isn't published to the host at all. A dedicated bridge network `deligo-net` connects all services; named volumes `redis-data`/`meili-data`/`rustfs-data`/`uploads-data` persist state.

### Local development

**Option A — `pnpm dev` on bare metal, dependencies in Docker** (most common):
```bash
docker compose up -d redis meilisearch rustfs
pnpm dev
```
**Option B — everything in Docker**:
```bash
docker build -t deligo-food-delivery-server:latest .
docker compose up -d --build
docker compose ps
curl http://localhost:5000/
```

**Pre-flight gotchas** (from `docs/deployment-guide.md`):
- Escape any literal `$` in `.env` secrets as `$$` — Compose scans `.env` for `$VAR` patterns and silently substitutes/empties otherwise, with no error, just a corrupted credential.
- `MEILI_MASTER_KEY` must be ≥16 bytes — Meilisearch runs `MEILI_ENV=production` by default, which refuses to boot with a short/missing key.
- `.env`'s `REDIS_HOST`/`MEILI_HOST`/`RUSTFS_ENDPOINT` set to `127.0.0.1`/`localhost` is correct only for bare-metal (`pnpm dev`) — `docker-compose.yml` already overrides all three to internal service names for the containerized backend.

**One-time RustFS bucket setup** — `PutObjectCommand` does not create buckets; the target bucket must be created with a public-read policy first (script provided in the original guide, run via `node -e "..."` locally, or `docker compose exec backend node -e "..."` once containerized). Lost on `docker compose down -v`.

**One-time Meilisearch index bootstrap** — `pnpm run meili:migrate` locally, or `npm run meili:migrate:prod` / `docker compose exec backend node dist/app/scripts/meiliBulkMigration.js` against a containerized/production backend (the production image ships only `dist/`, not `src/`/`tsx`).

### AWS EC2 production deployment (Docker Compose target)

Serial setup, condensed:
1. **Launch EC2**: Ubuntu 22.04/24.04 LTS, `t3.medium` minimum (one box runs API + Puppeteer/Chromium + Redis + Meilisearch + RustFS), gp3 30GB+. Security group: only 22 (your IP), 80, 443 inbound — never open 5000/6379/7700/9000/9001, since `docker-compose.yml` already binds all of those to `127.0.0.1` only (a second, independent layer of protection beyond the security group). Allocate an Elastic IP.
2. **Install Docker** via the official apt repo; add the deploy user to the `docker` group; `systemctl enable --now docker`.
3. **Clone the repo** to the instance, checkout the deploy branch/tag.
4. **Create production `.env`** directly on the instance (gitignored, not committed) — generate fresh `REDIS_PASSWORD`, `MEILI_MASTER_KEY` (≥16 bytes), `RUSTFS_ACCESS_KEY`/`RUSTFS_SECRET_KEY` (never reuse the local dev defaults).
5. Nothing beyond 80/443/22 needs a security-group rule — reach the RustFS console or Meilisearch via SSH tunnel (`ssh -L 9001:127.0.0.1:9001 -L 7700:127.0.0.1:7700 ...`) if needed.
6. `docker compose up -d --build`; `docker compose ps` should show all services healthy within ~60s.
7. One-time RustFS bucket setup (same script, run via `docker compose exec backend`).
8. One-time Meilisearch bootstrap (`docker compose exec backend node dist/app/scripts/meiliBulkMigration.js`).
9. **Reverse proxy + TLS**: nginx + certbot, proxying `443`/`80` to `127.0.0.1:5000` (the app is intentionally unreachable from the internet on its own port). Update `.env`'s `BACKEND_BASE_URL`/`ORIGINS` to the real domain afterward, then `docker compose restart backend`.
10. Confirm reboot survival — `restart: unless-stopped` on every service + `docker` itself enabled at boot means no extra systemd unit is needed.
11. **Ongoing ops**: deploy an update via `git pull && docker compose up -d --build`; logs via `docker compose logs -f backend`; backups are Docker named volumes on the instance's root EBS volume (snapshot via AWS Backup or a cron'd `aws ec2 create-snapshot`) — nothing is replicated elsewhere the way a managed MongoDB Atlas cluster would be. The Meilisearch index is fully rebuildable from MongoDB via the migration script, so its own backups are a recovery-speed optimization rather than a hard requirement. Add Docker's `json-file` log-driver rotation (`max-size`/`max-file` in `/etc/docker/daemon.json`) if disk usage creeps up over months.

### Troubleshooting (from `docs/deployment-guide.md`, preserved)

| Symptom | Cause / fix |
|---|---|
| `pnpm install --frozen-lockfile` fails `ERR_PNPM_OUTDATED_LOCKFILE` | `pnpm-lock.yaml` out of sync with `package.json` — regenerate locally with plain `pnpm install`, commit it. Don't relax `--frozen-lockfile` in the Dockerfile; it's intentional. |
| Container connects to Redis then exits with `MongooseServerSelectionError` | Deploy host's outbound IP isn't whitelisted on MongoDB Atlas — unrelated to Docker, fails identically bare-metal. |
| Meilisearch fails healthcheck / master-key error | `MEILI_MASTER_KEY` unset or &lt;16 bytes while `MEILI_ENV=production`. |
| `The "xyz" variable is not set` warning | The `$`-in-secret substitution issue — fix `.env`, don't ignore. |
| `RustFS Upload Error: ECONNREFUSED 127.0.0.1:9000` | Nothing listening on 9000 — bring up RustFS, or (inside Compose) confirm the `RUSTFS_ENDPOINT` override to `http://rustfs:9000` actually took (i.e. running via `docker compose up`, not a bare `docker run`). |
| `rustfs` restart-loops with `Permission denied (os error 13)` | `rustfs-data` volume root-owned vs. RustFS's uid 10001 — should self-heal via `rustfs-permission-helper`; check its logs if not. A later `Up (healthy)` alongside old `FATAL` lines in the log buffer means it already recovered — confirm via `docker compose ps`, not the last log line. |
| Upload succeeds but the returned URL 403s / "bucket does not exist" | Bucket doesn't exist or has no public-read policy — RustFS doesn't auto-create buckets. Run the one-time bucket setup script. |
| `sharp`: "Input buffer contains unsupported image format" | File isn't something Sharp can decode as a raster image (PDFs bypass Sharp entirely) — suspect a truncated upload or an unsupported format like HEIC/AVIF. |
| Puppeteer "Failed to launch the browser process" | Missing Chromium runtime lib in the container — check `docker compose logs backend`. |
| App unreachable from the internet | Check in order: Elastic IP associated; security group allows 443/80; `nginx -t` passes; `docker compose ps` shows `backend` healthy; `curl http://127.0.0.1:5000/` succeeds from a shell on the instance itself. |

## GitHub Actions → PM2/SSH path (currently wired, aging)

`.github/workflows/deploy.yml` — triggers on push to `main` only.
- **`build` job**: checkout → `actions/setup-node@v4` (`node-version: 23.11.0`) → `npm install --frozen-lockfile` → `npm run build`. **Note**: `--frozen-lockfile` is pnpm/yarn syntax, not an npm flag — npm silently ignores it, so despite appearances this step does not actually enforce lockfile integrity, even though the repo standardizes on pnpm elsewhere (`packageManager` field, `pnpm-lock.yaml`).
- **`deploy` job** (needs `build`): SSHes via `appleboy/ssh-action` to `${{ secrets.SERVER_IP }}` as `ubuntu`; script: sources nvm, `cd /deligoFoodPT/www/deligo-food-server`, `git pull origin main`, `npm install`, `npm run build`, `pm2 delete deligo-food-server || true`, `pm2 start dist/server.js --name deligo-food-server`, `pm2 save`.
- **No test step** anywhere in this workflow.
- This path installs Redis/Meilisearch/RustFS **separately on the target box** (outside Docker) — it does not use `docker-compose.yml` at all.

## Vercel path (legacy/vestigial for this backend)

`vercel.json`:
```json
{
  "version": 2,
  "builds": [{ "src": "dist/server.js", "use": "@vercel/node", "config": { "includeFiles": ["views/**"] } }],
  "routes": [{ "src": "/(.*)", "dest": "dist/server.js" }]
}
```
Routes all paths to the compiled `dist/server.js` as a `@vercel/node` serverless function. No CI step, script, or documentation reference was found anywhere in the repo invoking an actual `vercel deploy` for this backend — this file appears to date from the project's initial scaffolding and has not been meaningfully maintained since.

## Database Impact

None of these deployment paths run migrations automatically — schema changes ship as part of the application code (Mongoose schemas), and the one operational migration script in the repo (`meiliBulkMigration.ts`) is for the Meilisearch search index, not MongoDB itself.

## Edge Cases

- A Puppeteer-dependent feature (PDF generation for invoices/agreements) requires a working system Chromium — this is baked into the Docker image but must be provisioned manually for any bare-metal (PM2) deployment.
- The PM2 path's `npm install` (not `npm ci`) on every deploy means dependency versions can drift between deploys in ways the Docker path's `--frozen-lockfile` build explicitly prevents.

## Related Modules

[`../06-integrations/external-services.md`](../06-integrations/external-services.md), [`environment-variables.md`](environment-variables.md), [`cron-and-background-jobs.md`](cron-and-background-jobs.md).

## Source References

- `Dockerfile`, `docker-compose.yml`, `.github/workflows/deploy.yml`, `vercel.json`
- `docs/deployment-guide.md` (original guide; this document summarizes and reorganizes its content)
