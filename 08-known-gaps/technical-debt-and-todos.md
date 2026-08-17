# Technical Debt & Known Gaps

## Overview

This document lists issues **directly confirmed** in the current codebase during this documentation pass (cross-referenced against `docs/architecture-audit.md` §13-14 where applicable) — not speculative concerns. Each entry states the problem, the evidence, the impact, and a suggested direction. **No fixes have been applied as part of producing this documentation.**

## Purpose

Give a new backend developer an honest map of where the system's implementation is incomplete, inconsistent, or carries latent risk — so time isn't lost rediscovering the same things independently.

## Testing

**Problem**: No automated test coverage exists anywhere in the repository.
**Evidence**: No test framework configured (no Jest/Vitest/Mocha config), no `*.test.ts`/`*.spec.ts` files, no `test` script in `package.json`, confirmed via repo-wide search. CI (`.github/workflows/deploy.yml`) does not run tests.
**Impact**: Every deploy to `main` ships with zero regression safety net; refactors and dependency bumps carry unverified risk.
**Suggested action**: Introduce a test framework and prioritize coverage for the highest-risk areas first — order status transitions, dispatch race conditions, and payment finalization.

## Architecture / Data Integrity

**Problem**: The two-tier `AuthUser`/profile-document status duplication has no enforced sync mechanism.
**Evidence**: `AuthUser.status` and the corresponding profile document's `status` field are updated manually, in lockstep, by service code (e.g. `approvedOrRejectedUser` in `auth.service.ts`) — no Mongoose hook, transaction guarantee, or shared helper enforces this beyond convention.
**Impact**: A future code path that updates one document without the other would silently desynchronize a user's effective status.
**Suggested action**: Consider a single write path (a shared service helper, or a Mongoose middleware) that always updates both documents together.

**Problem**: `Order.statusHistory[].updatedBy` and `Order.pickup.verifiedBy` reference a `'User'` Mongoose model that does not correspond to any collection in the codebase.
**Evidence**: No `User` model exists anywhere under `src/app/modules/*`; these fields' `ref`/`refPath` point at a name with no backing schema.
**Impact**: `.populate()` calls against these fields silently return nothing rather than erroring — likely a leftover from an earlier, since-abandoned unified-user design.
**Suggested action**: Correct the `ref` to point at the actual polymorphic set of possible updaters, or drop population expectations for these fields.

**Problem**: `DeliveryPartner`'s dispatch capacity check references a field name that doesn't exist on the schema.
**Evidence**: `broadcastOrderToPartners` (`order.service.ts`) filters candidates with a `$expr` referencing `operationalData.currentOrderIds` (plural, array); the actual schema field is the singular `operationalData.currentOrderId`. The `$ifNull` fallback means this check is a permanent no-op.
**Impact**: Low in practice (the query already filters to `IDLE` status, which a partner mid-delivery wouldn't have), but "capacity" is not actually enforced during dispatch despite the field's presence.
**Suggested action**: Fix the field name if capacity limiting is intended to be a real constraint.

**Problem**: `PointsLog.onModel` enum includes `'RewardClaim'`, a collection that does not exist anywhere in the codebase.
**Evidence**: No `RewardClaim` model/schema found under `src/app/modules/*`.
**Impact**: An aspirational/unbuilt reference — harmless until code attempts to actually use this enum value.
**Suggested action**: Remove the unused enum value, or build the feature if still planned.

**Problem**: `GlobalSettings`' TypeScript interface is out of sync with its actual Mongoose schema.
**Evidence**: `globalSetting.interface.ts` omits `delivery.minCharge`/`maxCharge`/`freeAbove`/`maxDistanceKm` and `ingredientsOrder.vatRate`, all of which exist and are actively defaulted/used in `globalSetting.model.ts`.
**Impact**: TypeScript consumers of `TGlobalSettings` have no compile-time visibility into these real, persisted fields.
**Suggested action**: Regenerate or manually update the interface to match the schema.

## Incomplete Modules

**Problem**: `DeliGo_Balance` has no HTTP surface at all.
**Evidence**: `deliGoBalance.controller.ts` and `deliGoBalance.service.ts` are both 0-byte files; `deliGoBalance.route.ts` registers zero endpoints on its router; and `DeliGoBalanceRoutes` is not imported or mounted anywhere in `src/app/routes/index.ts`. The underlying model is actively written to by the Referral flow (rider welcome bonus, milestone `CASHBACK`/`CREDIT` rewards).
**Impact**: A customer or vendor's `DeliGoBalance` accrues silently with no way to view, spend, or withdraw it via the API — the balance is currently a dead end for end users. No documented relationship to `Wallet` exists either.
**Suggested action**: Either build the HTTP surface (view/spend/convert-to-wallet), or consolidate this balance concept into the existing `Wallet` module if the two were meant to converge.

**Problem**: `Coupon` has no HTTP surface and no redemption path.
**Evidence**: Only `coupon.model.ts`/`coupon.interface.ts` exist — no controller, service, or route files. The only writer anywhere in the codebase is `Referral.distributeReferralBonus()`. A repo-wide search of `Checkout`, `Cart`, and `Order` found zero code that reads, redeems, or marks a coupon `isUsed`.
**Impact**: `FREE_MEAL`/`FREE_DELIVERY` referral rewards are generated but can never actually be applied by the customer who earned them.
**Suggested action**: Build a redemption path in Checkout/Offer, or replace this reward type with the existing `Offer` mechanism.

**Problem**: `ContactUs` is fully implemented but entirely unreachable.
**Evidence**: `contact.route.ts` (`ContactRoutes`) defines a working `POST /` with validation, email forwarding, and activity logging — but is never imported into `src/app/routes/index.ts` or `src/app.ts`.
**Impact**: The contact-form feature does not function for any client, despite complete backend code.
**Suggested action**: Mount the route, or remove the dead code if the feature was superseded by `Support`.

**Problem**: `Analytics` has two independently-built, overlapping implementations.
**Evidence**: `analytics.route.ts` contains two developer-labeled sections, each backed by a separate controller/service pair (`analytics.*` vs. `analyticsSecond.*`), mounted together under `/analytics` with no path collisions but clearly overlapping domains under different endpoint names (e.g. `vendor-sales-analytics` vs. `vendor/dashboard-analytics`).
**Impact**: A newcomer or frontend integrator cannot tell which of two similarly-named endpoints is the intended/maintained source of truth for a given metric without asking the team.
**Suggested action**: Consolidate into one implementation, or explicitly document which is canonical for each metric.

**Problem**: `RequestLog` is never populated in the running application.
**Evidence**: The `logIPToDB` middleware, the `RequestLog` model, and its 7-day TTL index are all fully implemented and correct — but `src/app.ts` has the middleware invocation commented out.
**Impact**: The audit's characterization of RequestLog as an active "7-day retention" collection describes dead code; the collection is empty in practice.
**Suggested action**: Re-enable the middleware if request auditing is still desired, or remove the unused model/index.

**Problem**: `Support`'s AI-handling concept is unimplemented scaffolding.
**Evidence**: `SupportTicket.activeHandler` defaults to `'AI'` and a typed `aiMetadata` field exists, but no code anywhere reads or writes `aiMetadata` or performs any automated response — a ticket simply waits in the `'AI'` state until a human agent's first reply flips it to `'AGENT'`.
**Impact**: None functionally (tickets still work via human agents), but the schema implies a capability that doesn't exist, which could mislead a developer building against it.
**Suggested action**: Either build the AI-first-response feature, or simplify the schema/default to reflect actual behavior.

## Business-Rule Inconsistencies

**Problem**: `RestrictedItems` is maintained but never enforced.
**Evidence**: A repo-wide search found zero references to the `RestrictedItem` model outside its own module — `Product` creation, `Cart`, and `Order` never cross-check against it.
**Impact**: The restricted-items catalog (tobacco/alcohol/adult content/dangerous goods) is purely informational today.
**Suggested action**: Wire an enforcement check into product creation/approval if this catalog is meant to actually restrict listings.

**Problem**: `Zone` is disconnected from both delivery pricing and dispatch.
**Evidence**: `Zone.minDeliveryFee`/`maxDeliveryDistanceKm` exist on the schema but are never read by `Checkout`'s delivery-pricing logic (which sources entirely from `GlobalSettings.delivery`). Dispatch geo-search also runs its own raw `$geoNear` against delivery-partner locations directly, never consulting `Zone` boundaries. `Vendor.businessDetails.deliveryZoneId` and `DeliveryPartner.operationalData.assignmentZoneId`/`currentZoneId` are plain fields that are set but never read by any pricing or dispatch code path.
**Impact**: `Zone` functions today as a pure standalone geofencing/admin catalog with no live consumer in the commerce pipeline, despite having fields that suggest an intended pricing/dispatch role.
**Suggested action**: Either wire Zone into pricing/dispatch as originally intended, or remove the unused pricing-shaped fields to avoid confusion.

**Problem**: `Rating` lacks a database-level duplicate guard.
**Evidence**: The one-rating-per-`{orderId, reviewerId, ratingType}` rule is enforced only by an application-level `findOne` pre-check — no unique index backs it, unlike the equivalent guards on `Payout` and `PointsLog`.
**Impact**: A narrow race-condition window allows duplicate ratings for the same order/reviewer/type under concurrent requests.
**Suggested action**: Add a compound unique index matching the existing pattern used elsewhere in the codebase.

**Problem**: `Wallet.getMyWallet` resolves the platform admin wallet via a hardcoded ObjectId fallback instead of a dynamic role lookup.
**Evidence**: `wallet.service.ts` hardcodes an ObjectId literal for the `ADMIN`/`SUPER_ADMIN` "my wallet" view, while the order-completion worker and payout service correctly resolve the platform wallet dynamically via `Admin.findOne({role:'SUPER_ADMIN'})` elsewhere in the codebase.
**Impact**: If that specific admin document is ever deleted or the platform is reseeded with a different super-admin ID, this specific view would silently fail to locate the correct wallet even though it exists.
**Suggested action**: Replace the hardcoded ID with the same dynamic lookup pattern used elsewhere.

## Security

**Problem**: The QA/App-Store OTP test bypass has no `NODE_ENV`-based hard-disable.
**Evidence**: `TEST_CUSTOMER_*` env vars, when set, allow a fixed OTP to bypass Redis-stored OTP verification in `verifyOtp` — there is no code-level guard preventing this from being active in a production environment beyond the env vars themselves staying unset.
**Impact**: This is a legitimate, common QA/App-Store review pattern, but its safety depends entirely on environment hygiene rather than a defense-in-depth code check.
**Suggested action**: Add an explicit `NODE_ENV === 'production'` guard that disables the bypass regardless of whether the env vars are set.

**Problem**: `SUPER_ADMIN` has no way to be permission-restricted.
**Evidence**: The `auth` middleware's live-permission check is gated on `role === 'ADMIN'` literally — `SUPER_ADMIN` never enters that branch, regardless of what permissions a route requires.
**Impact**: A single compromised `SUPER_ADMIN` credential is a full-system compromise with no granular containment available even in principle, short of a code change.
**Suggested action**: This is a deliberate design choice (a true superuser role) rather than an oversight — worth confirming with the team whether a more contained "break glass" alternative is ever needed.

## Dependencies

**Problem**: Two unused npm dependencies remain in `package.json`.
**Evidence**: `stripe` (Payment module uses REDUNIQ exclusively) and `@google/genai` (Ai-Content-Generator uses OpenAI exclusively) both have zero references anywhere in `src/`.
**Impact**: Minor — dependency bloat and a confusing signal to anyone reading the dependency list about what payment/AI providers are actually in use.
**Suggested action**: Remove both from `package.json`.

## CI/CD

**Problem**: The GitHub Actions build step's lockfile-integrity flag is a no-op.
**Evidence**: `.github/workflows/deploy.yml`'s build job runs `npm install --frozen-lockfile` — `--frozen-lockfile` is pnpm/yarn syntax, not a valid npm flag; npm silently ignores it. The repository otherwise standardizes on pnpm (`packageManager` field, `pnpm-lock.yaml`), so this CI path does not actually enforce the dependency-version guarantee its flag implies.
**Impact**: A `package.json`/`pnpm-lock.yaml` mismatch would not be caught by this CI step the way it appears intended to.
**Suggested action**: Switch the CI build step to `pnpm install --frozen-lockfile` to match the rest of the repository's tooling.

**Problem**: No CI step runs tests (see Testing above) or deploys via the Docker Compose path.
**Evidence**: `.github/workflows/deploy.yml` has exactly two jobs (build, deploy-via-PM2); the Docker Compose deployment path described in `docs/deployment-guide.md` is entirely manual today.
**Impact**: The actively-developed deployment target (Docker Compose) has no automated pipeline; only the older PM2 path is automated.
**Suggested action**: Extend CI to build/push a Docker image and optionally automate the Compose-based deploy, once that path is confirmed ready to be the primary target.

## Documentation Gaps (pre-existing, closed by this documentation pass where possible)

- No architecture/README overview existed at the repo root prior to this documentation set.
- No documented data model / ER diagram existed prior to `05-data-model/`.
- No documented environment-variable reference existed beyond bare `.env.example` names prior to `07-operations/environment-variables.md`.
- No documented error-key reference existed prior to `04-api-reference/error-codes.md`.
- No test/QA documentation exists — consistent with no test suite existing (see Testing above).

## Route-Level Observations

**Problem**: A likely route-shadowing issue in `Order`'s route file.
**Evidence**: `GET /orders/delivery-partner/dispatch-order` and `GET /orders/delivery-partner/current-order` are registered *after* `GET /orders/:orderId` in `order.route.ts`. Express matches routes in registration order, so a request to either path could match `/orders/:orderId` first (with `orderId` bound to the literal string `"delivery-partner"`) rather than reaching the intended handler.
**Impact**: Not confirmed via a live request in this pass — flagged from route declaration order alone. If real, either endpoint could be unreachable as documented.
**Suggested action**: Verify directly against running route behavior; if confirmed, reorder the routes so the more specific paths are registered before `/:orderId`.

**Problem**: A duplicate, undocumented route exists for the same controller.
**Evidence**: `GET /orders/delivery-partner-dispatch-order` (no slash) and `GET /orders/delivery-partner/dispatch-order` both map to `getDeliveryPartnersDispatchOrder`.
**Impact**: Harmless but redundant — a client integrating from the route file directly (rather than the documented endpoint) could pick either.
**Suggested action**: Remove the undocumented duplicate.

## Related Modules

Every `03-modules/` document links back to this page for the specific gaps relevant to that module. See also `docs/architecture-audit.md` §13-14 for the original audit pass this document builds on and re-verifies.

## Source References

All items above are confirmed directly against source during this documentation pass — see each `03-modules/`, `04-api-reference/`, `05-data-model/`, and `07-operations/` document for the specific file paths backing each finding.
