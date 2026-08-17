# External Services & Integrations

## Overview

Deligo integrates with 12 external services/systems. This document covers purpose, usage location, configuration, and — importantly — what happens when each one fails, since failure modes vary widely (some crash the process at boot, some throw structured errors, some fail silently).

## Purpose

Let a developer understand what each integration is for, where it's wired in, and what breaks (loudly or silently) if it's misconfigured or unavailable.

## RustFS (S3-compatible object storage)

**Purpose**: Self-hosted, S3-API-compatible object store for uploaded images and generated PDFs. Replaced a prior Cloudinary integration (one hardcoded Cloudinary logo URL remains in the invoice PDF template as a leftover).
**Where used**: `src/app/utils/storage.ts` — `uploadAndOptimizeImage` (resizes to 800×600 WebP via `sharp`, uploads PDFs raw), `deleteSingleImageFromRustFS`, `deleteMultipleImagesFromRustFS`, `uploadLocalFileToRustFS`. Called from any module accepting file uploads (`Product`, `Vendor`, `Agreement`, `Profile`, `Upload`, etc.).
**Config**: `RUSTFS_ENDPOINT`, `RUSTFS_PUBLIC_ENDPOINT` (falls back to `RUSTFS_ENDPOINT`), `RUSTFS_ACCESS_KEY`, `RUSTFS_SECRET_KEY`, `RUSTFS_BUCKET_NAME`.
**Failure behavior**: the client construction throws synchronously at module load if any required env var is missing — **this crashes the app at boot**, not at request time. Per-call failures are caught, logged, and re-thrown as a generic `Error` (not `AppError`), so they surface as opaque 500s. The bucket is not auto-created — it must be provisioned with a public-read policy before first use (see [`../07-operations/deployment.md`](../07-operations/deployment.md)).

## REDUNIQ (payment gateway)

**Purpose**: Custom HTTP payment gateway (card, MB WAY, Apple Pay, Google Pay, PayPal) for Portuguese merchants.
**Where used**: `src/app/modules/Payment/payment.service.ts` — single endpoint, `method` field switches behavior (`initPayment`, `doPaymentToken`, `doRefund`, `doVoid`, `getResult`). Also used by the separate `Ingredient-Order` vendor-restocking payment flow.
**Config**: `REDUNIQ_API_URL`, `REDUNIQ_USERNAME`, `REDUNIQ_PASSWORD`.
**Failure behavior**: axios errors are caught and mapped to specific `AppError`s (`PAYMENT_GATEWAY_TEMP_UNAVAILABLE_502`, `GATEWAY_ERROR`, `PAYMENT_PROCESSING_FAILED`). Webhook notifications (`POST /payment/reduniq/notification`) are never trusted directly — the handler re-verifies status via a server-side `getResult` call before finalizing an order. A known gateway-side quirk: `doPaymentToken` (saved-card payment) returns an empty 500 for this merchant account specifically, surfaced as `SAVED_TOKEN_PAYMENT_TEMPORARILY_UNAVAILABLE`.
**Note**: `stripe` remains in `package.json` as an unused dependency — REDUNIQ is the only payment gateway actually wired in.

## Pasta Digital (Portuguese fiscal e-invoicing / ATCUD)

**Purpose**: Portuguese fiscal compliance — obtaining ATCUD codes and certified invoice PDFs for tax law.
**Where used**: `src/app/modules/Invoice/getPdAccessToken.ts` (auth), `orderPd.service.ts` (`syncOrderWithPd`, called from the `order-queue` worker's post-order-creation processing), `invoice.service.ts` (PDF download).
**Config**: `PD_API_URL`, `PD_EMAIL`, `PD_PASSWORD`.
**Auth mechanism**: access token cached in Redis (`pd_access_token`, 100-minute TTL) to avoid re-authenticating on every call.
**Failure behavior**: throws a generic `Error` (not `AppError`) on auth failure. `Order.invoiceSync.isSynced` is set `false` with a `syncError` on sync failure — **there is no retry mechanism or cron sweep for failed syncs**; a failed sync requires manual/external intervention, and the customer-facing invoice-download endpoint hard-requires `isSynced: true` to work.

## Firebase Cloud Messaging (push notifications)

**Purpose**: Push notifications to customer/vendor/delivery-partner/fleet-manager devices.
**Where used**: `src/app/config/firebase.ts` (init), `src/app/utils/sendPushNotification.ts` (send), called throughout `Notification`, `Order`, `Cart`, `Sos`, `Support` flows.
**Config**: `FIREBASE_SERVICE_ACCOUNT` (full service-account JSON as a single env var string).
**Failure behavior**: **missing or invalid `FIREBASE_SERVICE_ACCOUNT` calls `process.exit(1)` at boot** — the entire process crashes, not just push functionality. Per-send failures distinguish invalid/expired-token errors (logged as warnings, and the stale FCM token is proactively cleared from `AuthUser.loginDevices[]`) from other errors (logged and re-thrown). Sends throughout the app are fire-and-forget (`setImmediate`), detached from the request/response lifecycle.

## Nodemailer (Gmail SMTP)

**Purpose**: Transactional email — OTP, order confirmation + invoice PDF attachment, refund notices, password reset, broadcast admin announcements.
**Where used**: `src/app/utils/emailSender.ts`, called from Auth, Order/Invoice, Payment, Notification, and most modules that notify users by email.
**Config**: `SENDER_EMAIL`, `SENDER_APP_PASS`.
**Behavior**: Handlebars templates (`views/*.template.hbs`) are cached in Redis (`email_template:<type>`, 24h TTL) to avoid repeated disk reads. Every send attempt (success or failure) is logged to the `EmailLog` collection; if that logging itself fails, falls back to an `ErrorLog` entry (best-effort).
**Failure behavior**: throws `AppError(500, 'FAILED_TO_SEND_EMAIL')`. Many callers treat email as non-critical and catch-and-swallow the failure (e.g. refund success emails are fire-and-forget).

## BulkGate (SMS OTP delivery)

**Purpose**: SMS OTP delivery via BulkGate's "Simple SMS" transactional API. WhatsApp OTP was previously used and has been removed from the codebase.
**Where used**: `src/app/utils/sendMobileOtp.ts`, used by Auth's contact-number OTP flows (registration, OTP-first customer login).
**Config**: `BULKGATE_SEND_API_URL`, `BULKGATE_API_KEY`, `BULKGATE_APP_ID`.
**Failure behavior**: throws `AppError(500, 'BULKGATE_CONFIGURATION_MISSING')` if config is absent; gateway errors surface as `AppError(400, ...)`.

## Google Distance Matrix API

**Purpose**: Road distance/duration between two points, used for delivery-fee calculation.
**Where used**: `src/app/utils/calculateGoggleRoadDistance.ts` (filename has a genuine typo — "Goggle" — confirmed exact spelling), consumed by `Checkout` (`checkout.service.ts`) for `delivery.charge = baseCharge + distanceKm × chargePerKm`.
**Config**: `GOOGLE_MAPS_API_KEY`.
**Failure behavior**: **notably different from every other integration** — it does not throw to the caller. All errors (including a non-`OK` Google API status) are caught internally and a silent fallback `{km: 0, meters: 0, durationMinutes: 0, text: 'Error'}` is returned. This means a Google Maps outage or misconfiguration silently produces a **zero-distance, zero-charge delivery fee** rather than blocking checkout — an operational risk worth monitoring for, since it fails open rather than closed.

## Google OAuth / Facebook Graph API (social login)

**Purpose**: Server-side verification of Google/Facebook tokens obtained client-side, for customer social login.
**Where used**: `src/app/utils/verifySocialToken.ts`, consumed by `Auth`'s `POST /auth/social-login`. Full flow documented in [`../02-authentication/login-flows.md`](../02-authentication/login-flows.md).
**Config**: `GOOGLE_OAUTH_CLIENT_IDS` (comma-separated, accepts a token matching any listed client/audience ID — supports multiple platforms/apps), `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`.
**Mechanics**: Google verification only trusts the returned email if Google's own `email_verified` flag is true. Facebook verification is two-step (`/debug_token` to confirm the token belongs to the configured app, then `/me` for profile fields) — Facebook simply omits `email` from the response if the account has no confirmed email on file (not a bug, a real account state — see the customer social login guide content folded into [`../02-authentication/login-flows.md`](../02-authentication/login-flows.md)).
**Failure behavior**: both throw `AppError(401, 'INVALID_SOCIAL_TOKEN')` on verification failure, or `AppError(500, '<PROVIDER>_CONFIGURATION_MISSING')` if server config is absent.

## Meilisearch (self-hosted search)

**Purpose**: Product/restaurant search indexing and querying.
**Where used**: `src/app/lib/meiliClient.ts` (singleton client), `src/app/modules/Meilisearch/*` (init, real-time sync, search/key management), `src/app/scripts/meiliBulkMigration.ts` (one-off bulk reindex, run via `pnpm meili:migrate` / `npm run meili:migrate:prod`). Real-time sync fires on `Product`/`Vendor` save via Mongoose post-hooks.
**Config**: `MEILI_HOST`, `MEILI_MASTER_KEY` (must be ≥16 bytes when `MEILI_ENV=production`), `MEILI_FOOD_INDEX` (falls back to `food_items` if unset).
**Failure behavior**: sync functions catch all errors and only `console.error` them — silent/non-blocking. A Meilisearch outage does not block product create/update/delete in MongoDB, but leaves the search index stale until it recovers or a manual reindex runs.

## Redis

**Purpose**: Sessions/refresh-token rotation, OTP storage, distributed locks, rate limiting (`rate-limit-redis`), email-template caching, Pasta Digital token caching, and keyspace-notification-driven expiry events.
**Where used**: `src/app/config/redis.ts` — two client instances (`redis` for commands, `subscriber` dedicated to pub/sub/keyspace notifications, since a subscribing client can't run normal commands). `initKeySpaceNotification` enables `notify-keyspace-events Ex` and subscribes to `__keyevent@0__:expired`. Also used directly by BullMQ as its queue connection (a separate `ConnectionOptions`, `maxRetriesPerRequest: null` — a BullMQ requirement).
**Config**: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` (optional).
**Failure behavior**: connection errors are only logged — no explicit reconnect/circuit-breaker logic beyond ioredis's default auto-reconnect.

## Socket.IO

**Purpose**: Real-time order tracking, live rider location, SOS alert monitoring, support chat, vendor open/closed status push.
**Where used**: `src/app/lib/Socket/index.ts` (init/CORS/auth), `events/*.events.ts` (order, riderLiveLocation, shopStatus, sosAlerts, support).
**Config**: `ORIGINS` (shared with Express CORS, comma-split allowlist).
**Auth**: global `io.use(socketAuthMiddleware)` gate before any event handlers attach.
**Failure behavior**: `getIO()` throws `AppError(500, 'SOCKET_NOT_INITIALIZED')` if called before socket init completes — relevant because cron jobs also call `getIO()`; each cron handler wraps this in try/catch and logs, degrading gracefully rather than crashing if a cron tick fires before boot finishes.

## OpenAI (`gpt-5`)

**Purpose**: AI-generated product descriptions (max 40 words, tone-controlled, language-parameterized).
**Where used**: `src/app/config/openai.ts` (client), `src/app/modules/Ai-Content-Generator/aiContentGenerator.service.ts`. Uses the Responses API (`openai.responses.create`), not `chat.completions`.
**Config**: `OPENAI_API_KEY`.
**Failure behavior**: **no try/catch at all** around the API call — any SDK error (auth, rate limit, network) propagates as an uncaught exception through `catchAsync` to the global error handler, i.e. failure surfaces as a generic 500 rather than a curated `AppError`.
**Note**: `@google/genai` remains listed in `package.json` as a dead dependency with no code references — the codebase uses OpenAI exclusively for AI features.

## Edge Cases

- **Boot-time crashers**: RustFS (missing config) and Firebase (missing/invalid service account) both call `process.exit(1)`/throw synchronously at module load — a misconfigured `.env` for either of these prevents the app from starting at all, unlike most other integrations which fail per-request.
- **Silent-failure integrations**: Google Distance Matrix (fails open, zero-charge fallback) and Meilisearch sync (logs only) both degrade silently rather than surfacing errors to the caller — worth specific monitoring/alerting since API consumers won't see anything wrong.
- **Non-`AppError` throwers**: RustFS (`storage.ts`) and Pasta Digital (`getPdAccessToken.ts`) both throw plain `Error` objects, bypassing the app's structured, localized error-key system.

## Related Modules

[`../07-operations/environment-variables.md`](../07-operations/environment-variables.md) for the full variable reference; [`../04-api-reference/error-codes.md`](../04-api-reference/error-codes.md) for the `AppError`/message-key system these integrations plug into.

## Source References

- `src/app/utils/storage.ts`, `calculateGoggleRoadDistance.ts`, `verifySocialToken.ts`, `sendMobileOtp.ts`, `sendPushNotification.ts`, `emailSender.ts`
- `src/app/config/redis.ts`, `firebase.ts`, `openai.ts`, `bullmq.ts`
- `src/app/lib/meiliClient.ts`, `src/app/modules/Meilisearch/*`
- `src/app/lib/Socket/*`
- `src/app/modules/Payment/payment.service.ts`, `src/app/modules/Invoice/getPdAccessToken.ts`, `orderPd.service.ts`
