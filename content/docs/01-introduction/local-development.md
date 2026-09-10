---
title: Local Development
description: Prerequisites, environment, infrastructure, and the commands to run the Deligo backend locally.
order: 3
---

# Local Development

All commands below are taken from the backend repository's `package.json`,
`Dockerfile`, and `docker-compose.yml`. The package manager is
**pnpm 10.15.0** (pinned via `packageManager`); enable it with
`corepack enable`.

## Prerequisites

| Tool | Version / note |
| --- | --- |
| Node.js | 20.x (the Docker image is `node:20-alpine`) |
| pnpm | 10.15.0 (`corepack prepare pnpm@10.15.0 --activate`) |
| MongoDB | A **replica set** (or Atlas). The code uses multi-document transactions (`session.startTransaction()` in seeding, auth, orders, payouts), which MongoDB only allows on a replica set / sharded cluster. |
| Redis | 7.x — required for the rate-limit store, cache, OTP storage, and BullMQ. |
| Meilisearch | v1.10 — food search. Boot tolerates it being down (index setup is non-fatal), but `/search` won't work without it. |
| RustFS (or S3-compatible) | Image and PDF storage. `src/app/utils/storage.ts` **throws at startup** if its config is missing. |
| Chromium | Needed for PDF features (agreements, invoices) via Puppeteer. Installed in the Docker runner image; downloaded by Puppeteer on a normal local `pnpm install`. |

The quickest way to get Redis, Meilisearch, and RustFS locally is the bundled
Compose file (see [below](#local-infrastructure-with-docker-compose)).

## Environment configuration

Configuration is read once in `src/app/config/index.ts` from a **`.env` file at
the project root** (the process working directory). There is no committed
`.env.example` in the backend repo — the keys below are the ones
`config/index.ts` and `docker-compose.yml` actually read.

| Group | Keys |
| --- | --- |
| Core | `NODE_ENV`, `PORT` |
| Database | `DB_URL` |
| Auth | `JWT_ACCESS_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS` |
| Super admin seed | `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `SUPER_ADMIN_CONTACT_NUMBER`, `SUPER_ADMIN_PROFILE_PHOTO` |
| Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| Search | `MEILI_HOST`, `MEILI_MASTER_KEY`, `MEILI_FOOD_INDEX` |
| Storage | `RUSTFS_ENDPOINT`, `RUSTFS_PUBLIC_ENDPOINT`, `RUSTFS_ACCESS_KEY`, `RUSTFS_SECRET_KEY`, `RUSTFS_BUCKET_NAME` |
| CORS | `ORIGINS` (comma-separated allowlist) |
| Frontend URLs | `FRONTEND_URL_VENDOR`, `FRONTEND_URL_ADMIN`, `FRONTEND_URL_FLEET_MANAGER`, `FRONTEND_URL_DELIVERY_PARTNER`, `FRONTEND_PAYMENT_URL`, `FRONTEND_URL_CUSTOMER_POINTS`, `BACKEND_BASE_URL` |
| Payments | `REDUNIQ_API_URL`, `REDUNIQ_USERNAME`, `REDUNIQ_PASSWORD` |
| Fiscal | `PD_API_URL`, `PD_EMAIL`, `PD_PASSWORD` |
| Email | `SENDER_EMAIL`, `SENDER_APP_PASS` |
| SMS | `BULKGATE_SEND_API_URL`, `BULKGATE_API_KEY`, `BULKGATE_APP_ID` |
| Push | `FIREBASE_SERVICE_ACCOUNT` (the service-account JSON as a string) |
| Social login | `GOOGLE_OAUTH_CLIENT_IDS` (comma-separated), `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` |
| Maps | `GOOGLE_MAPS_API_KEY` |
| AI | `OPENAI_API_KEY` |
| Test bypass | `TEST_CUSTOMER_EMAIL`, `TEST_CUSTOMER_CONTACT_NUMBER`, `TEST_CUSTOMER_OTP`, `TEST_CUSTOMER_CONTACT_OTP` |

Notes derived from the code:

- **`FIREBASE_SERVICE_ACCOUNT` is effectively required.**
  `src/app/config/firebase.ts` calls `process.exit(1)` if it is missing or not
  valid JSON.
- `REDUNIQ_*`, `PD_*`, and `BULKGATE_*` are only checked when their feature is
  called — the server boots without them, but the related endpoints throw a
  `*_CONFIGURATION_MISSING` error.
- The `docker-compose.yml` comments indicate `.env` sets `PORT=5000` for
  bare-metal runs; the container overrides it to `5001` so both can run at once.

## Dependency installation

```bash
corepack enable
pnpm install
```

## Local infrastructure with Docker Compose

`docker-compose.yml` defines the whole stack — `backend`, `redis`,
`meilisearch`, `rustfs` (plus a one-shot `rustfs-permission-helper`). Every
dependency port is bound to `127.0.0.1` only.

```bash
docker compose up -d          # start everything (builds the backend image)
docker compose up -d redis meilisearch rustfs   # infra only, run the app on the host
docker compose logs -f backend
docker compose down           # stop; add -v to also drop the data volumes
```

Inside the Compose network the backend reaches services by name — the file
overrides `REDIS_HOST=redis`, `MEILI_HOST=http://meilisearch:7700`,
`RUSTFS_ENDPOINT=http://rustfs:9000`, and `PORT=5001`. When you instead run the
app on the host against Compose infra, point `.env` at `localhost` with these
ports:

| Service | Host port |
| --- | --- |
| Redis | `6379` |
| Meilisearch | `7700` |
| RustFS S3 API | `9000` |
| RustFS console | `9001` |
| Backend (container) | `5001` |

## Database setup and seeding

There is no manual migration step. On every boot `bootstrap()` calls `seed()`
(`src/app/utils/seeding.ts`), which, inside a transaction:

- creates the `SUPER_ADMIN` (`Admin` + `AuthUser`) from the `SUPER_ADMIN_*` env
  values if none exists — and updates its email / phone / password to match env
  on later boots;
- creates one default `GlobalSettings` document if none exists.

Optional data scripts (from `package.json`):

| Command | Purpose |
| --- | --- |
| `pnpm meili:migrate` | Bulk-index existing catalog data into Meilisearch (`src/app/scripts/meiliBulkMigration.ts`). |
| `pnpm backfill:vendor-timezone` | One-off backfill of `businessDetails.timezone` on vendors. |
| `pnpm verify:activity-log-retention` | Check the activity-log retention job's effect. |

Each has a `:prod` variant that runs the compiled JS from `dist/`.

## Running the backend

| Command | What it does |
| --- | --- |
| `pnpm dev` | `tsx watch src/server.ts` — development server with reload. |
| `pnpm build` | `tsc` — compiles `src/` to `dist/`. |
| `pnpm start` | `node dist/server.js` — runs the compiled build (needs `pnpm build` first). |

Health check: `GET /` returns
`{ "success": true, "message": "Welcome to the DeliGo Food Delivery Server PT test" }`.
The API itself is under `/api/v1`.

## Useful scripts

| Command | Purpose |
| --- | --- |
| `pnpm lint` | `eslint .` |
| `pnpm lint:fix` | `eslint . --fix` |
| `pnpm type-check` | `tsc --noEmit` |

## Common development notes

- **Transactions require a replica set.** A standalone `mongod` will fail on the
  first `startTransaction()` (which happens during `seed()` on boot).
- **Boot order** (`src/server.ts`): Mongo connect → `seed()` → Socket.IO →
  Redis keyspace notifications → Meilisearch index setup (non-fatal) → cron →
  `listen()`. BullMQ workers start via an import side effect.
- **Platform timezone is fixed** to `Europe/Lisbon`; the daily payout and
  activity-log-retention crons are pinned to it.
- **CORS is an allowlist.** A browser client's origin must be listed in
  `ORIGINS` or the request is rejected. Socket.IO uses the same list.
- **Language** comes from the `Accept-Language` header (`en` or `pt`, default
  `en`); responses and many errors are localized from it.
- `NODE_ENV=development` unlocks console logging and includes `err` / `stack`
  in error responses (`globalErrorHandler`).
