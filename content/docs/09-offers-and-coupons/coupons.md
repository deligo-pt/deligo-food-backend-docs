---
title: Coupons
description: "The Coupon model as implemented: its fields and two types, the only code path that creates coupons (referral milestone rewards during order settlement), and the absence of any route, validation, redemption or expiry logic. Coupons are separate from the Offer engine and cannot be used on a checkout."
order: 2
---

# Coupons

The `Coupon` model is a small, separate system from the [Offer engine](./offers.md).
In the current code a coupon can be **created** (as a referral reward) but nothing can
list, validate, apply, redeem or expire it. This page records exactly what exists so
nobody assumes more.

Paths are relative to `src/app/`. Statements come from the committed code unless marked
**Inferred** (read from code, not run). Uncommitted working-tree features are not described.

---

## Short answers

| Question | Answer |
| --- | --- |
| Is there a coupon API? | No. The module `modules/Coupon/` holds only `coupon.model.ts` and `coupon.interface.ts`; it has no route, controller, service or validation, and nothing mounts it. |
| Who creates coupons? | Only `ReferralServices.distributeReferralBonus`, for a referral milestone whose reward type is `FREE_MEAL` or `FREE_DELIVERY`. Nothing else in `src/` calls `Coupon.create`. |
| Who can use a coupon? | Nobody. No code reads `isUsed`, `expiryDate` or `code` for validation, and checkout, cart and order have no coupon field. |
| Is it related to `Offer`? | No. There is no link between the two models, and the coupon types are not the offer types. |
| Can a customer see their coupons? | Not through any endpoint in the code. `GET /referrals/my-referrals` returns milestones and history, not coupons. |
| Notifications | None. |

---

## Data model

`Coupon` (`coupon.model.ts`), `timestamps: true`.

| Field | Notes |
| --- | --- |
| `userId`, `userModel` | The owner. `userModel` is `Customer`, `Vendor`, `DeliveryPartner`, `FleetManager` or `Admin`, and `userId` is a `refPath` to that collection. |
| `code` | Required and **unique** (unique index). |
| `type` | `FREE_MEAL` or `FREE_DELIVERY`. |
| `isUsed` | Default `false`. Never set to `true` by any code. |
| `expiryDate` | Optional. Never read. |
| `remarks` | Free text. |

Index: `{ userId, isUsed }`. There is no `value`, `vendorId`, `minOrderAmount` or usage-count field, so a coupon carries
no amount, vendor restriction or limit.

---

## How a coupon is created

The only source is the referral reward, run inside the order settlement transaction.

1. A referred customer's order reaches `DELIVERED` or `PICKED_UP_BY_CUSTOMER`. The settlement worker (`Order/order.worker.ts`) calls `ReferralServices.distributeReferralBonus(customerId, orderId, session)`. It is **not** called for `NO_SHOW`.
2. The service looks for a `PENDING` referral for that customer whose reward has not been distributed. No such referral means nothing happens.
3. It counts the referrer's completed referrals plus this one and looks for a milestone in the global settings (`rewards.customerReferralMilestones`) whose `friendsRequired` equals that number. A milestone has `friendsRequired`, `rewardType`, `rewardValue`, `minOrderAmountPerFriend` and `validityDays`.
4. If the order's grand total is below the milestone's `minOrderAmountPerFriend`, the referral is marked completed **without** a reward.
5. Otherwise the referral is marked completed and the reward is paid by type:

| Milestone `rewardType` | Result |
| --- | --- |
| `CASHBACK`, `CREDIT` | The referrer's DeliGo balance is increased by `rewardValue` and a `REFERRAL_BONUS` transaction is written. No coupon. |
| `FREE_MEAL`, `FREE_DELIVERY` | One `Coupon` is created for the referrer (`userId` = referrer, `userModel` = the referrer's model): `code` is `<REWARD_TYPE>-<random suffix>`, `type` is the reward type, `expiryDate` is today plus `validityDays` (or `null` when `validityDays` is `0`), `remarks` is `Earned from <n>th referral milestone`. `rewardValue` is **not** stored on the coupon. |
| `OTHER` | Nothing is created. |

The suffix is taken from a random base-36 string, so its length is not fixed, and the code is not checked for
uniqueness before the insert.

---

## What does not exist

- **No endpoints.** No create, list, read, validate, apply, redeem or delete route. `Coupon` is not imported by any route file, so there is no role or permission check on coupons at all.
- **No redemption.** Checkout (`Checkout/checkout.service.ts`), the cart and `finalizeCheckoutIntoOrder` do not mention coupons. A coupon cannot reduce an order total or waive a delivery charge.
- **No expiry handling.** Nothing compares `expiryDate` with the current time, and no cron touches the collection.
- **No coupon offers.** The Offer engine has a `FREE_DELIVERY` type of its own; it is [disabled](./offers.md#offer-types) and unrelated to the coupon type of the same name.

### Permissions

`permission.constant.ts` defines an admin permission code `CAN_MANAGE_COUPONS`. No route or service
uses it, so it guards nothing today. **Inferred:** it is a placeholder for a future coupon admin feature.

---

## Mismatches and inconsistencies

1. **Coupons are earned but unusable.** A referrer who reaches a `FREE_MEAL` or `FREE_DELIVERY` milestone receives a row that no endpoint exposes and no flow consumes. From the code, the reward is invisible to the client and cannot be redeemed.
2. **The milestone value is dropped.** `rewardValue` applies to `CASHBACK` and `CREDIT` only; for the coupon types it is ignored.
3. **The remark text is hard-coded English.** The message key `REFERRAL_MILESTONE_COUPON_REMARK` (English and Portuguese) exists in `referral.messages.ts`, but the service writes its own English string and nothing else references the key.
4. **Collision risk.** A duplicate random `code` would violate the unique index inside the settlement transaction, and the worker does not catch that error. **Inferred:** the settlement job would fail and retry. The odds are small, and this was not reproduced.

---

## Unverified or inferred behavior

- Whether a mobile or admin client reads coupons some other way (for example directly from the database) is not known from the backend code.
- The worker retry effect of a duplicate coupon code was derived from the code paths, not run.
- The intended design for redemption (value, vendor scope, stacking with offers) is not described anywhere in the code.

---

## Related documentation

- [Offers](./offers.md): the Offer engine, which is the only discount mechanism a customer can use on a checkout.
- [Cancellations, Refunds and Settlement](../03-orders/cancellations-refunds-settlement.md): the settlement transaction that triggers the referral reward.
- [Notification Triggers and Templates](../06-notifications/notification-triggers.md): referrals send no notification.
