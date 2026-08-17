# Admin & Settings

## Overview

Covers the `Admin` profile module, the singleton `GlobalSettings` configuration document, the Analytics module's dual implementations, and the platform's administrative/compliance/logging modules (Agreement, Invoice, ActivityLog, ErrorLog, RequestLog/EmailLog, Sponsorships, ContactUs).

## Purpose

Explain platform-wide configuration, admin account management, and the audit/logging infrastructure — including several modules that are less complete or reachable than they first appear.

## Admin

`{userId, registeredBy, role: ADMIN|SUPER_ADMIN, email, status, isDeleted, isUpdateLocked, name, contactNumber, address, NIF, currentSessionLocation, documents, permissions: string[], approvedBy/rejectedBy/blockedBy, submittedForApprovalAt, remarks}`. No admin-creation endpoint lives in this module — accounts are created via the centralized `Auth` onboarding flow (`SUPER_ADMIN`-only for the `admin` role, see [`../02-authentication/registration-and-onboarding.md`](../02-authentication/registration-and-onboarding.md)). Module endpoints are limited to `PATCH /admins/:id` (update), `PATCH /admins/:id/docImage`, `GET /admins`, `GET /admins/:id` — all `ADMIN`/`SUPER_ADMIN`.

## Permission

Full RBAC mechanics are covered in [`../02-authentication/permissions-and-rbac.md`](../02-authentication/permissions-and-rbac.md). In brief: a 14-action catalog (`VALID_PERMISSION_ACTIONS`), stored per-admin as `Admin.permissions: string[]`, checked live from the database on every request for `ADMIN` (never `SUPER_ADMIN`, which unconditionally bypasses the check).

## GlobalSettings

Singleton document (`GlobalSettingsSchema.index({}, {unique: true})` — enforces exactly one document ever). Sections:

| Section | Fields |
|---|---|
| `delivery` | `baseCharge`, `chargePerKm`, `minCharge`, `maxCharge`, `freeAbove`, `maxDistanceKm`, `vatRate` |
| `ingredientsOrder` | `deliveryChargeInsideLisbon` (default 20), `deliveryChargeOutsideLisbon` (default 30), `vatRate` (default 23) |
| `commission` | `platformPercent`, `platformVatRate`, `fleetManagerPercent`, `serviceCharge` |
| `order` | `nearestVendorRadiusKm`, `cancelTimeLimitMinutes` |
| `rewards` | `customerPointsPerEuro`, `riderPointsPerDelivery`, `referralPoints`, `newRiderWelcomeBonus`, `pointsExpiryDays`, `customerReferralMilestones[]` |
| `payout` | `autoGenerate`, `payoutDays[]`, `minPayoutAmount`, `payoutWindowDays` |
| `meta` | `updatedBy` → Admin |

Endpoints (all `ADMIN`/`SUPER_ADMIN`): `POST /globalSettings/create` (blocks if a document already exists — "create once" pattern), `PATCH /globalSettings/update` (flattens the payload for targeted `$set`, validates payout-day/auto-generate consistency and commission-percent range), `GET /globalSettings/`. This is the single source of truth `Checkout` reads for delivery pricing — see [`../03-modules/cart-checkout-order.md`](../03-modules/cart-checkout-order.md).

**Known type/schema drift**: `globalSetting.interface.ts` (`TGlobalSettings`) omits `delivery.minCharge`/`maxCharge`/`freeAbove`/`maxDistanceKm` and `ingredientsOrder.vatRate` — all present and actively used in the real Mongoose schema. TypeScript consumers of this interface have no compile-time visibility into these real, persisted fields. See [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).

## Analytics — confirmed two independently-built implementations

`analytics.route.ts` explicitly labels two sections via header comments (developer names redacted here since they're not meaningful to an external reader, but the split itself is real and confirmed):
- **First implementation**: `AnalyticsControllers`/`analytics.service.ts` — roughly 21 endpoints (vendor sales/customer-insights/order-trend/top-selling, admin sales/order/customer/vendor/fleet/delivery-partner reports, fleet and delivery-partner performance detail views, platform earnings/top-vendors/peak-hours/delivery-insights, vendor tax report).
- **Second implementation**: `AnalyticsSecondControllers`/`analyticsSecond.service.ts` — roughly 13 endpoints (admin/vendor/fleet dashboard-analytics, partner-performance-analytics, delivery-partner/fleet-manager/vendor earning-analytics, admin all-customers/vendor-performance analytics, offer-analytics, vendor tax-report-analytics, admin delivery-partner-analytics). No separate interface/utils file — reuses or inlines types from the first pair.

Both mount under `/analytics` with no path collisions, but clearly **overlapping domains under different endpoint names** (e.g. `vendor-sales-analytics` vs. `vendor/dashboard-analytics`; `admin/sales-analytics` vs. `admin/dashboard-analytics`; `vendor/tax-report` vs. `vendor/tax-report-analytics`). This is two independently-built analytics surfaces that were never merged or deduplicated — the in-code section-header comments are the only documentation of why two implementations coexist. See [`../04-api-reference/endpoint-index.md`](../04-api-reference/endpoint-index.md) for the endpoint list and [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).

## Agreement

A vendor/establishment e-signature onboarding flow — an **admin-operated tool**, not self-service by vendors. `{establishmentName, email (unique), contactNumber, nif, isEmailVerified, draftPdfPath, agentSignaturePath, establishmentSignaturePath, signedPdfPath, status: PENDING_VERIFICATION → VERIFIED → DRAFT → SIGNED → EMAILED, createdBy → Admin}`. Flow: `POST /agreements/initiate` → OTP to email → `POST /verify-otp`/`resend-otp` → `POST /sign/:agreementId` (captures a signature image, generates a PDF via Puppeteer, uploads to RustFS) → `GET /:agreementId`/`GET /`. All endpoints gated `auth('ADMIN','SUPER_ADMIN',['CAN_MANAGE_AGREEMENTS'])`.

## Invoice

Two distinct concerns:
1. **Pasta Digital fiscal sync** — `syncOrderWithPd(orderId)`, triggered from the order-queue worker on every new order. Maps the order to Pasta Digital's sales payload (service charge + delivery fee as separate line items with the correct Portuguese VAT tax IDs). On success, persists `Order.invoiceSync = {isSynced, invoiceNo, atcud, signature}`; on failure, `isSynced: false` with a `syncError`. **No retry or cron sweep exists for failed syncs** — a failed sync requires manual/external intervention, and the customer-facing PDF download endpoint hard-requires `isSynced: true` to function at all.
2. **PDF generation/download** — Puppeteer + Handlebars, `getPdAccessToken.ts` (PD OAuth token, Redis-cached 100 minutes), `invoiceDownloadAuth.ts` (signed short-lived download tokens). Endpoint: `GET /invoices/download/:orderId`, gated by a custom `invoiceDownloadAccess` middleware rather than the standard `auth()` guard, plus global rate limiting. **A leftover Cloudinary URL** is hardcoded as the invoice's brand logo — a remnant of the RustFS migration.

## ActivityLog

`{authUserId, userName, email, role, action, target, type: INFO|WARNING|DANGER}`. Writes are fire-and-forget (a self-invoking async function, not awaited by callers) — called from many modules for audit-trail purposes. No TTL — retained indefinitely. Read access gated `auth('ADMIN','SUPER_ADMIN',['CAN_MANAGE_ACTIVITY_LOGS'])`.

## ErrorLog

Infra-only, no controller/service/route — written directly from `globalErrorHandler` on every `statusCode >= 500` error, with sensitive request-body fields redacted before persisting. TTL: 30 days. See [`../04-api-reference/error-codes.md`](../04-api-reference/error-codes.md).

## RequestLog / EmailLog

- **RequestLog** — intended as a 7-day-TTL HTTP request audit trail, and its populating middleware (`logIPToDB`) is fully implemented. **However, `src/app.ts` has the middleware call commented out** — the collection is confirmed never populated in the running application, despite the model, index, and middleware code all being correct. See [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).
- **EmailLog** — actively written on every outbound email attempt (success or failure) from `src/app/utils/emailSender.ts`. No TTL — retained indefinitely. Uses a defensive `mongoose.models.EmailLog || model(...)` guard against duplicate model registration, unique among all models in the codebase.

## Sponsorships

Admin-managed promotional banners: `{sponsorName, sponsorType: Ads|Offer|Other, startDate, endDate, bannerImage, url, isActive, isDeleted}`. Full CRUD with multipart image upload, soft+permanent delete (`ADMIN`/`SUPER_ADMIN`); a public unauthenticated read (`GET /sponsorships/open`) and a customer-visible authed read.

## ContactUs — confirmed entirely unreachable

`POST /contact` (public) is fully implemented — validates the request, emails `SENDER_EMAIL` via the shared email helper, and logs an `ActivityLog` entry — **but `ContactRoutes` is never imported or mounted anywhere in `src/app/routes/index.ts` or `src/app.ts`**. The feature is complete code with zero HTTP reachability. See [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).

## Database Impact

See [`../05-data-model/collections-reference.md`](../05-data-model/collections-reference.md) for `Admin`, `GlobalSettings`, `Agreement`, `ActivityLog`, `ErrorLog`, `RequestLog`/`EmailLog`, `Sponsorship` field/index detail.

## Edge Cases

- `GlobalSettings.create` being a strict "create once" endpoint means the very first deployment of a new environment must call it exactly once before any pricing-dependent feature (checkout, ingredient orders, payouts, rewards) will function correctly.
- Analytics endpoints have significant naming overlap between the two implementations — a frontend integrating against this API should confirm with the backend team which of the two overlapping endpoints is the intended/maintained one for a given metric, since both currently return live data.

## Related Modules

[`../02-authentication/permissions-and-rbac.md`](../02-authentication/permissions-and-rbac.md), [`../03-modules/cart-checkout-order.md`](../03-modules/cart-checkout-order.md) for `GlobalSettings.delivery` consumption, [`../04-api-reference/error-codes.md`](../04-api-reference/error-codes.md) for `ErrorLog`, [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md) for all the confirmed-incomplete items noted throughout this document.

## Source References

- `src/app/modules/Admin/admin.model.ts`, `.service.ts`
- `src/app/modules/GlobalSetting/globalSetting.model.ts`, `.interface.ts`, `.service.ts`
- `src/app/modules/Analytics/analytics.route.ts`, `analytics.service.ts`, `analyticsSecond.service.ts`
- `src/app/modules/Agreement/agreement.model.ts`, `.service.ts`, `agreement.pdf.service.ts`
- `src/app/modules/Invoice/orderPd.service.ts`, `invoice.service.ts`, `invoice.utils.ts`, `getPdAccessToken.ts`
- `src/app/modules/ActivityLog/activityLog.model.ts`, `.utils.ts`
- `src/app/modules/ErrorLog/errorLog.schema.ts`
- `src/app/modules/log/log.model.ts`, `emailLog.model.ts`
- `src/app/modules/Sponsorships/sponsorships.model.ts`
- `src/app/modules/ContactUs/contact.route.ts` (confirmed unmounted)
- `src/app.ts` (confirmed `logIPToDB` commented out)
