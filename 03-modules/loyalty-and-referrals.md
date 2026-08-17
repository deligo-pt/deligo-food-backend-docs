# Loyalty & Referrals

## Overview

Covers customer/delivery-partner loyalty points, the referral program, and two related-but-incomplete reward mechanisms (`DeliGoBalance`, `Coupon`) that the referral flow writes to but that have little to no independent HTTP surface of their own.

## Purpose

Explain how points are earned, how referrals are rewarded, and clearly flag which parts of this reward system are actually reachable by a client versus dead/incomplete.

## Points & PointsLog

Two collections: `Points` (running balance, one document per user) and `PointsLog` (immutable audit ledger).

### Earning rules
- **Customer**: `addOrderPoints()`, triggered from the `order-queue` worker on `DELIVERED`. `Math.floor(orderAmount × GlobalSettings.rewards.customerPointsPerEuro)` (fallback rate 10 if settings are missing). Points expire `GlobalSettings.rewards.pointsExpiryDays` days out (fallback 365).
- **Delivery Partner**: `addDeliveryPartnerPoints()`, same trigger. A fixed `GlobalSettings.rewards.riderPointsPerDelivery` (fallback 20) per delivered order.
- Both guard against double-crediting the same order — an app-level pre-check plus a **database-level partial unique index** on `PointsLog` (`{'userId.id', referenceId, transactionType}`, partial on `transactionType:'EARN'`) as the real TOCTOU guard.
- Failure handling asymmetry (explicit in code): if called **without** an external session, a points-crediting failure is caught and logged as a `FAILED_LOG` entry rather than propagated (keeps the main order-completion flow alive). If called **under** an external session (i.e. from within the order worker's own transaction), a failure **is** re-thrown so the outer transaction aborts too.

`REDEEM`/`REFERRAL_BONUS`/`ADJUSTMENT` all flow through a shared `updatePointBalance()` helper; `REDEEM` requires `currentPoints >= points` via a conditional filter on the update (no upsert — a non-existent `Points` doc for a redeem attempt means insufficient balance by definition).

Read endpoints: `GET /points/my-points` (CUSTOMER, DELIVERY_PARTNER), `GET /points/all-points` (ADMIN/SUPER_ADMIN). `POST /points/add-order-points`/`add-rider-points` exist as manual/duplicate trigger paths alongside the automatic worker call. No `VENDOR` points despite vendors being eligible for referral rewards — a vendor's loyalty-adjacent balance, if any, lives in `DeliGoBalance`/`Coupon` instead.

## Referral

`Referral` tracks a referrer↔referred relationship: `{referrerId, referredId (unique — each referred user can only be referred once), referrerModel/referredModel: Customer|Vendor|DeliveryPartner, status: PENDING|COMPLETED|EXPIRED, isRewardDistributed, referenceOrderId}`.

### Mechanics

1. **`createReferralEntry()`** — called during onboarding when a new user signs up with a `referralCode`. Blocks self-referral. Creates a `PENDING` entry. **Special case**: if the new user is a `DELIVERY_PARTNER`, a `newRiderWelcomeBonus` (from `GlobalSettings.rewards`) is credited immediately to the **new rider's own** `DeliGoBalance` — a signup bonus for the referred person, not the referrer.
2. **`distributeReferralBonus(referredId, orderId)`** — called from the order worker on the *referred* user's first order `DELIVERED`. Finds the matching `PENDING`, undistributed `Referral`. Counts the referrer's total `COMPLETED` referrals + 1 = the current milestone tier, looked up against `GlobalSettings.rewards.customerReferralMilestones[]` (`friendsRequired`, `rewardType`, `rewardValue`, `minOrderAmountPerFriend`, `validityDays`). If the triggering order is below `minOrderAmountPerFriend`, the referral is marked `COMPLETED` but `isRewardDistributed: false` — **no reward is paid, but the referral is still consumed** and can't be re-triggered by a later order. Otherwise: `CASHBACK`/`CREDIT` rewards credit the **referrer's** `DeliGoBalance` and log a `Transaction` (`type: REFERRAL_BONUS`); `FREE_MEAL`/`FREE_DELIVERY` rewards generate a `Coupon` for the referrer (no `Transaction` for coupon rewards).
3. **`getReferralStats()`** (`GET /referrals/my-referrals`, CUSTOMER/DELIVERY_PARTNER/VENDOR) — returns the caller's referral code, invite summary, current `DeliGoBalance`, full milestone progress, and referral history.

## DeliGoBalance — confirmed incomplete, no HTTP surface at all

`{userId (unique, polymorphic), userModel: Customer|Vendor|DeliveryPartner|FleetManager, totalBalance, pendingBalance, totalEarned, status}`. **The controller and service files are empty (0 bytes), and the route file registers zero endpoints — and is not even imported into the application's route mounter**, so there is no reachable HTTP path to this module at any URL, not merely an empty one. The only writer anywhere in the codebase is `Referral` (rider welcome bonus, `CASHBACK`/`CREDIT` milestone rewards). There is no admin visibility, no self-service view/withdrawal, and no documented or coded relationship between `DeliGoBalance` and `Wallet` — a customer or vendor's `DeliGoBalance` currently cannot be spent, withdrawn, or even viewed except embedded inside the `/referrals/my-referrals` response.

## Coupon — confirmed no HTTP surface, no redemption path

`{userId, userModel, code (unique), type: FREE_MEAL|FREE_DELIVERY, isUsed, expiryDate}`. Only 2 files exist for this module (`coupon.model.ts`, `coupon.interface.ts`) — no controller, service, or route files at all. The only writer is `Referral.distributeReferralBonus()` (`Coupon.create()` for `FREE_MEAL`/`FREE_DELIVERY` milestone rewards). **No code path anywhere reads, redeems, or marks `isUsed` on a coupon** — confirmed via a repo-wide search covering `Checkout`, `Cart`, and `Order`. Coupons are generated but currently cannot be consumed by any part of the system. A `CAN_MANAGE_COUPONS` permission action is reserved in the RBAC catalog with no route to gate — further evidence this feature was planned but never completed. See [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).

## Business Rules

- Referral rewards are only ever distributed on the **referred** user's order completion — not the referrer's.
- Milestone tiers are cumulative counts of completed referrals, not a rolling window.
- A referral that falls below the `minOrderAmountPerFriend` threshold is permanently spent (marked `COMPLETED`, unrewarded) rather than retried on a future order.

## Database Impact

See [`../05-data-model/collections-reference.md`](../05-data-model/collections-reference.md) for `Points`/`PointsLog`, `Referral`, `DeliGoBalance`, `Coupon` field/index detail.

## Edge Cases

- `PointsLog.onModel` includes `'RewardClaim'` as a valid polymorphic target, but no `RewardClaim` collection exists anywhere in the codebase — an aspirational/unbuilt reference.
- Anyone building a frontend around `DeliGoBalance` or `Coupon` should confirm with the team whether these are on a roadmap to complete, since as they exist today they are effectively write-only, dead-end data stores.

## Related Modules

[`cart-checkout-order.md`](cart-checkout-order.md) for how order completion triggers points/referral crediting, [`payments-and-payouts.md`](payments-and-payouts.md) for the separate, functioning `Wallet`/`Payout` system, [`../02-authentication/login-flows.md`](../02-authentication/login-flows.md) for where `referralCode` is accepted at signup.

## Source References

- `src/app/modules/Points/points.model.ts`, `.service.ts`, `.route.ts`
- `src/app/modules/Referral/referral.model.ts`, `.service.ts`, `.route.ts`
- `src/app/modules/DeliGo_Balance/deliGoBalance.model.ts`, `.interface.ts` (controller/service confirmed empty; route confirmed unmounted)
- `src/app/modules/Coupon/coupon.model.ts`, `.interface.ts` (no controller/service/route files exist)
- `src/app/modules/Permission/permission.constant.ts` (`CAN_MANAGE_COUPONS`)
- `src/app/BullMQ/Workers/order.worker.ts`
