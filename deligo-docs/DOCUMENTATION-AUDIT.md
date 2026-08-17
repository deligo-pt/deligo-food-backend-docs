# Documentation Generation Audit

## Overview

This records how `deligo-docs/` was produced: what was inspected, what quality checks were run, what could not be confirmed, and what should get human review before this is treated as fully authoritative. Generated against branch `test-development`.

## Files generated

```
deligo-docs/
├── README.md
├── DOCUMENTATION-AUDIT.md
├── 01-overview/
│   ├── architecture-overview.md
│   ├── role-model.md
│   └── glossary.md
├── 02-authentication/
│   ├── registration-and-onboarding.md
│   ├── login-flows.md
│   ├── session-and-token-management.md
│   └── permissions-and-rbac.md
├── 03-modules/
│   ├── vendor-and-branches.md
│   ├── product-and-catalog.md
│   ├── cart-checkout-order.md
│   ├── delivery-and-dispatch.md
│   ├── payments-and-payouts.md
│   ├── loyalty-and-referrals.md
│   ├── support-and-safety.md
│   └── admin-and-settings.md
├── 04-api-reference/
│   ├── endpoint-index.md
│   └── error-codes.md
├── 05-data-model/
│   ├── collections-reference.md
│   └── relationships.md
├── 06-integrations/
│   └── external-services.md
├── 07-operations/
│   ├── environment-variables.md
│   ├── deployment.md
│   └── cron-and-background-jobs.md
├── 08-known-gaps/
│   └── technical-debt-and-todos.md
├── 09-change-log/
│   └── README.md
└── 10-decision-log/
    └── README.md
```

27 files total, matching the requested structure exactly — no extra files created.

## Source areas inspected

- **Full read**: `docs/architecture-audit.md` (359 lines), `docs/order-flow-guide.md` (398 lines), `docs/vendor-branch-flow-guide.md` (356 lines), `docs/offers-integration-guide.md` (387 lines), `docs/customer-social-login-guide.md` (228 lines), `docs/deployment-guide.md` (412 lines).
- **Every route file** under `src/app/modules/*/​*.route.ts` (44 files, 42 mounted + 2 confirmed unmounted).
- **Every model/interface/constant file** across all 48 module directories under `src/app/modules/`.
- **Auth subsystem in full**: `Auth/auth.service.ts` (2501 lines), `auth.route.ts`, `auth.constant.ts`, `authSession.utils.ts`, `AuthUser/authUser.model.ts`, `Permission/*`, `middlewares/auth.ts`, `utils/verifyJWT.ts`, `utils/verifySocialToken.ts`.
- **Error/message system**: `errors/*.ts`, `middlewares/globalErrorHandler.ts`, `middlewares/notFound.ts`, `middlewares/rateLimiter.ts`, a representative sample of per-module `*.messages.ts` files, `constant/GlobalMessage/global.messages.ts`.
- **Config and ops**: `src/app/config/index.ts` (full), `.env.example` (variable names only), `Dockerfile`, `docker-compose.yml`, `.github/workflows/deploy.yml`, `vercel.json`, `src/app/cron/*` (all 5 files), `src/app/BullMQ/*` (config, queues, workers).
- **Integrations**: `utils/storage.ts`, `calculateGoggleRoadDistance.ts`, `sendMobileOtp.ts`, `sendPushNotification.ts`, `emailSender.ts`, `config/redis.ts`, `config/firebase.ts`, `config/openai.ts`, `lib/meiliClient.ts`, `lib/Socket/*`, `modules/Payment/payment.service.ts`, `modules/Invoice/getPdAccessToken.ts`.
- **Commerce/dispatch deep dive**: `Product/*`, `Category/*`, `Add-Ons/*`, `Ingredients/*`, `Ingredient-Order/*`, `Tax/*`, `RestrictedItems/*`, `Delivery-Partner/*`, `Fleet-Manager/*`, `Zone/*`, `Sos/*`, the dispatch section of `Order/order.service.ts`.
- **Finance/loyalty/support/admin deep dive**: `Payment-Token/*`, `Transaction/*`, `Wallet/*`, `Payout/*`, `Points/*`, `Referral/*`, `DeliGo_Balance/*`, `Coupon/*`, `Support/*`, `Rating/*`, `Notification/*`, `Admin/*`, `GlobalSetting/*`, `Analytics/*`, `Agreement/*`, `Invoice/*`, `ActivityLog/*`, `ErrorLog/*`, `log/*`, `Sponsorships/*`, `ContactUs/*`.
- **`openapi.json`** — top-level structure only (`info`, path count: 259), used as a secondary cross-check, not a primary source (route files were primary).
- **`git log`** — commit history reviewed for context and file-recency evidence (used to assess which deployment path is actively maintained).

## Known areas that could not be confirmed

Stated explicitly in the relevant documents; consolidated here:
- `IAuthUserModel.isUserExistsByContactNumber`'s implementation status in `authLookupPlugin.ts` was not re-verified line-by-line in this pass (the original audit flagged it as declared-but-unimplemented; not independently re-confirmed here).
- Actual production values of `JWT_ACCESS_EXPIRES_IN`/`JWT_REFRESH_EXPIRES_IN` — only `.env.example` reference values (`7d`/`1y`) were available from a read-only repo pass.
- Whether `loginHistory.utils.ts`'s `createLoginLog` export has any live caller beyond the confirmed BullMQ-worker path — not found called from `auth.service.ts`, but an exhaustive repo-wide grep for every import site wasn't separately run.
- The exact access rule implemented by `Invoice`'s custom `invoiceDownloadAccess` middleware was not read line-by-line — only its existence and role (replacing the standard `auth()` guard) was confirmed.
- Whether the `Order` route-shadowing concern (`/orders/:orderId` potentially matching before `/orders/delivery-partner/*`) actually manifests in live request routing — flagged from route declaration order alone, not confirmed via a runtime test.

## Potential documentation gaps

- No architectural-decision history could be reconstructed with confidence (see `10-decision-log/README.md`) — several patterns (e.g. the `AuthUser`/profile split, the `SUB_VENDOR`-as-`Vendor` branch model) are documented as observed architecture, not as decisions with a confirmed rationale.
- No historical change log could be backfilled from git history within the scope of this pass (see `09-change-log/README.md`) — git log was used for supporting evidence (e.g. deployment-path recency) but not converted into a structured change-log backfill.
- The Analytics module's two implementations are documented as coexisting and overlapping, but which specific endpoint is the intended long-term source of truth for each overlapping metric was not determinable from code alone — this requires a human/team decision, not something inferable from source.

## Contradictions discovered (and corrected)

- **`docs/order-flow-guide.md`** stated no automatic cron existed to mark uncollected self-pickup orders `NO_SHOW`. Current code (`src/app/cron/order.cron.ts`, `handleAutoNoShowCron`) contradicts this — the cron exists, is scheduled every 5 minutes, and is wired into `initAllCronJobs()`. **Corrected** in `03-modules/cart-checkout-order.md`, with the original guide's claim explicitly called out as superseded.
- **`docs/architecture-audit.md`** describes `DeliGo_Balance`'s controller/service as "empty" — direct inspection found the module directory contains *only* the model/interface files; there are no controller/service/route files present at all (not empty files, absent files), and the route is additionally unmounted. This is a refinement, not a contradiction, and is reflected in `03-modules/loyalty-and-referrals.md` and `08-known-gaps/technical-debt-and-todos.md`.
- No other direct contradictions between the architecture audit / existing guides and current source code were found — the audit and the four existing integration guides were, on the whole, accurate at the time of this pass.

## Items requiring human review

- **`08-known-gaps/technical-debt-and-todos.md`** in full — every item there is confirmed-in-code, but the *suggested action* for each is a documentation-writer's judgment call, not a team decision. Particularly: whether `DeliGo_Balance`/`Coupon` should be built out or removed, and which `Analytics` implementation should be treated as canonical.
- **QA OTP bypass** (`TEST_CUSTOMER_*`) — flagged as a security-hygiene item; whether an explicit `NODE_ENV` guard should be added is a product/security decision, not purely technical.
- **The `Order` route-shadowing concern** — recommend a quick manual verification (a live request to `GET /orders/delivery-partner/current-order`) before treating it as confirmed-broken or confirmed-fine.
- **Vercel deployment status** — documented as "legacy/vestigial based on git-recency evidence," but this is an inference from commit history, not a statement from anyone on the team; worth a quick confirmation that `vercel.json` is indeed safe to ignore or remove.

## Related Modules

[`README.md`](README.md) for navigation and conventions; every `03-modules/` and `08-known-gaps/` document for the specific evidence behind each finding summarized here.
