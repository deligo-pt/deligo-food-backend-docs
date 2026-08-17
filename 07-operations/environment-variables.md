# Environment Variables

## Overview

Full inventory of environment variables read by the application, sourced from `src/app/config/index.ts` (the central config mapping) and cross-referenced against `.env.example`. **No secret values are included anywhere in this document** — only variable names and purposes.

## Purpose

Let a developer or DevOps engineer understand what each environment variable configures, whether it's required, and where in the codebase it's consumed.

## Notable configuration facts

- **Timezone is force-set at boot**: `src/app/config/index.ts` runs `process.env.TZ = process.env.TZ || 'Europe/Lisbon'` before the exported config object — guarantees all unqualified `Date`/cron/`toLocaleString` calls resolve in Lisbon local time regardless of host machine timezone. Operators do not need to set `TZ` themselves.
- **`PUPPETEER_EXECUTABLE_PATH`** is in `.env.example` but not read through `config/index.ts` — it's consumed directly by the Puppeteer library's own env-var convention. The Dockerfile hardcodes this via an `ENV` directive in the container image, overriding whatever `.env` says once containerized.
- **`FRONTEND_URL_TEST`** is read into `config.frontend_urls.test` but is undocumented in `.env.example` and has no other confirmed consumer — appears to be dead/unused config.

## Core

| Variable | Purpose | Required? |
|---|---|---|
| `NODE_ENV` | Environment mode (development/production) — gates verbose logging and dev-only error detail in responses | Required |
| `PORT` | HTTP listen port | Required (Dockerfile/compose override to 5001 for containers) |
| `DB_URL` | MongoDB connection string | Required |
| `BACKEND_BASE_URL` | Self-referential base URL, used to build the REDUNIQ webhook `notificationUrl` | Required — webhook silently omitted if unset |
| `ORIGINS` | Comma-separated CORS allowlist, shared by Express CORS and Socket.IO CORS | Required |

## JWT / Auth

| Variable | Purpose | Required? |
|---|---|---|
| `JWT_ACCESS_SECRET` / `JWT_ACCESS_EXPIRES_IN` | Access token signing secret + TTL | Required |
| `JWT_REFRESH_SECRET` / `JWT_REFRESH_EXPIRES_IN` | Refresh token signing secret + TTL (separate secret from access) | Required |
| `BCRYPT_SALT_ROUNDS` | bcrypt cost factor for password hashing | Required |

`.env.example` reference values: `JWT_ACCESS_EXPIRES_IN=7d`, `JWT_REFRESH_EXPIRES_IN=1y` — actual deployed values are environment-specific.

## Super admin seed

| Variable | Purpose | Required? |
|---|---|---|
| `SUPER_ADMIN_EMAIL` / `_PASSWORD` / `_PROFILE_PHOTO` / `_CONTACT_NUMBER` | Seeds the initial `SUPER_ADMIN` account on boot | Required |

## Redis

| Variable | Purpose | Required? |
|---|---|---|
| `REDIS_HOST` / `REDIS_PORT` | Connection target | Required |
| `REDIS_PASSWORD` | Auth | Optional |

## Object storage (RustFS)

| Variable | Purpose | Required? |
|---|---|---|
| `RUSTFS_ENDPOINT` | Internal S3 API endpoint | Required — module throws at process load if missing |
| `RUSTFS_PUBLIC_ENDPOINT` | Client-facing host embedded in returned URLs | Optional — falls back to `RUSTFS_ENDPOINT` |
| `RUSTFS_ACCESS_KEY` / `RUSTFS_SECRET_KEY` | S3 credentials | Required |
| `RUSTFS_BUCKET_NAME` | Target bucket — must pre-exist, not auto-created | Required |

## Search (Meilisearch)

| Variable | Purpose | Required? |
|---|---|---|
| `MEILI_HOST` | Meilisearch server URL | Required |
| `MEILI_MASTER_KEY` | Admin API key — must be ≥16 bytes when `MEILI_ENV=production` | Required |
| `MEILI_FOOD_INDEX` | Product index name | Optional — code fallback `food_items` |

## Frontend URLs (per role — reset-password links, payment redirects)

| Variable | Purpose | Required? |
|---|---|---|
| `FRONTEND_URL_VENDOR` / `_ADMIN` / `_FLEET_MANAGER` / `_DELIVERY_PARTNER` | Role-specific frontend base URLs | Required |
| `FRONTEND_PAYMENT_URL` | REDUNIQ `returnUrlOk`/`returnUrlError` base | Required |
| `FRONTEND_URL_TEST` | Present in config, undocumented in `.env.example`, no confirmed consumer | Likely dead config |

## Email (Nodemailer/Gmail)

| Variable | Purpose | Required? |
|---|---|---|
| `SENDER_EMAIL` | Gmail account used as the `from` address | Required |
| `SENDER_APP_PASS` | Gmail app password (SMTP auth) | Required |

## PDF generation (Puppeteer — not routed through `config/index.ts`)

| Variable | Purpose | Required? |
|---|---|---|
| `PUPPETEER_EXECUTABLE_PATH` | Path to system Chromium, read directly by Puppeteer | Required bare-metal; hardcoded via Dockerfile `ENV` in containers |

## Social auth

| Variable | Purpose | Required? |
|---|---|---|
| `GOOGLE_OAUTH_CLIENT_IDS` | Comma-separated list of accepted Google OAuth client/audience IDs | Functionally required — throws `GOOGLE_CONFIGURATION_MISSING` at call time if empty |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook Graph API app credentials | Required — throws `FACEBOOK_CONFIGURATION_MISSING` if either missing |

See [`../02-authentication/login-flows.md`](../02-authentication/login-flows.md) for how to obtain these.

## SMS (BulkGate)

| Variable | Purpose | Required? |
|---|---|---|
| `BULKGATE_SEND_API_URL` / `BULKGATE_API_KEY` / `BULKGATE_APP_ID` | SMS OTP gateway credentials | Required — throws `BULKGATE_CONFIGURATION_MISSING` if absent |

## AI

| Variable | Purpose | Required? |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI SDK auth | Required |

## Maps

| Variable | Purpose | Required? |
|---|---|---|
| `GOOGLE_MAPS_API_KEY` | Google Distance Matrix API key | Required — but failures are swallowed at the call site (fails open to zero-distance), not gated here |

## Push (Firebase)

| Variable | Purpose | Required? |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Full service-account JSON as a single string | Required — missing/invalid causes `process.exit(1)` at boot |

## Payments (REDUNIQ)

| Variable | Purpose | Required? |
|---|---|---|
| `REDUNIQ_API_URL` / `_USERNAME` / `_PASSWORD` | Gateway endpoint + credentials, embedded in each request payload | Required — service checks and throws `PAYMENT_GATEWAY_CONFIG_MISSING` before each call if absent |

## Fiscal (Pasta Digital)

| Variable | Purpose | Required? |
|---|---|---|
| `PD_API_URL` / `PD_EMAIL` / `PD_PASSWORD` | Pasta Digital login credentials | Required |

## API docs auth

| Variable | Purpose | Required? |
|---|---|---|
| `API_DOCS_USER` / `API_DOCS_PASSWORD` | HTTP Basic Auth gate for `/api-docs` and `/openapi.json` | Required |

## QA / test bypass

| Variable | Purpose | Required? |
|---|---|---|
| `TEST_CUSTOMER_EMAIL` / `_CONTACT_NUMBER` / `_OTP` / `_CONTACT_OTP` | App-Store/QA reviewer bypass account with fixed OTPs | Optional — blank by default |

**Security note**: this bypass has no `NODE_ENV==='production'` hard-disable in code — its safety currently depends entirely on these variables staying unset/unguessable in production. See [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).

## Edge Cases

- Several integrations throw at **process boot** rather than at request time if misconfigured (RustFS, Firebase) — see [`../06-integrations/external-services.md`](../06-integrations/external-services.md) for which ones.
- `GOOGLE_MAPS_API_KEY` being unset does not produce a startup or request error — checkout will silently compute a zero-distance delivery charge instead. This is easy to miss in testing.

## Related Modules

[`../06-integrations/external-services.md`](../06-integrations/external-services.md) for what each variable's service is used for and how failures behave; [`deployment.md`](deployment.md) for environment-specific override behavior (e.g. Docker Compose overriding `REDIS_HOST`/`MEILI_HOST`/`RUSTFS_ENDPOINT`).

## Source References

- `src/app/config/index.ts`
- `.env.example` (variable names only — never read `.env` itself)
- `Dockerfile` (`PUPPETEER_EXECUTABLE_PATH`, `PORT` override)
- `docker-compose.yml` (service-name overrides for `REDIS_HOST`/`MEILI_HOST`/`RUSTFS_ENDPOINT`)
