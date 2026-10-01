---
title: Order Automation
description: The scheduled jobs that move orders without a user action (auto-accept, dispatch, retry, escalation, auto-ready, no-show, pickup reminders), the settings and order timing fields they use, how each job claims an order safely, and what is not automated.
order: 4
---

# Order Automation

This page describes the time-driven side of the order flow: which cron jobs run,
what they read, how they avoid double-processing, and which timers exist on the
`Order`. The transitions themselves (and their conditions) are listed in
[Order Lifecycle](./order-lifecycle.md#automaticsystem-transitions); dispatch
mechanics are in [Delivery Dispatch and Riders](./delivery-dispatch.md).

Paths are relative to `src/app/`. The scheduler is `cron/index.ts`; the order
jobs are in `cron/order.cron.ts` and the per-order work in
`modules/Order/order.service.ts`. Statements come from the code unless marked
**Inferred**.

---

## Schedule

| Schedule | Job | Purpose |
| --- | --- | --- |
| Every minute, step 1 | `vendorStoreOpenCloseCron` | Opens and closes stores (see [Vendors and Branches](../04-vendors/vendors-and-branches.md#store-openclose-and-timezone)); not an order job, but it runs first |
| Every minute, step 2 | `handleOrderExpiryCron` | `DISPATCHING → AWAITING_PARTNER` when the offer window ended |
| Every minute, step 3 | `handleAutoRetryDispatchCron` | Escalate, then retry `AWAITING_PARTNER`, then retry `REASSIGNMENT_NEEDED` |
| Every minute, step 4 | `handleAutoAcceptCron` | `PENDING → PREPARING` when the vendor did not answer |
| Every minute, step 5 | `handleAutoDispatchCron` | `PREPARING → DISPATCHING` for delivery orders close to ready |
| Every minute, step 6 | `handleAutoReadyCron` | `ASSIGNED → READY_FOR_PICKUP` (delivery) and `PREPARING → READY_FOR_PICKUP` (pickup), as a fallback when the vendor has not confirmed readiness |
| Every 5 minutes | `handlePickupTimeReminderCron` | Reminder push to the customer before a pickup slot |
| Every 5 minutes | `handleAutoNoShowCron` | `READY_FOR_PICKUP → NO_SHOW` for pickup orders |

The six every-minute steps run **sequentially in one callback**, in the order
above, and each step has its own `try/catch`, so a failure in one is logged and
does not stop the next. Inside a step, orders are processed one after another,
and a failure on one order is logged and the loop continues.

```mermaid
flowchart LR
    T["Every minute"] --> S1["Store open/close"]
    S1 --> S2["Dispatch expiry"]
    S2 --> S3["Escalate / retry dispatch"]
    S3 --> S4["Auto-accept"]
    S4 --> S5["Auto-dispatch"]
    S5 --> S6["Auto-ready"]
```

The order of steps matters within one tick: for example an order accepted by
step 4 is only considered by step 5 in the same tick, and only if its
`estimatedReadyAt` is already within the dispatch lead time.

---

## Configuration

The order-related global settings live in the `order` group of the
`GlobalSettings` document (one document, read through
`GlobalSettingsService.getGlobalSettings`):

| Setting | Used by | Schema default |
| --- | --- | --- |
| `order.autoAcceptTimeoutMinutes` | Sets `autoAcceptDeadlineAt` when an order is created | **2** |
| `order.autoDispatchLeadMinutes` | How far ahead of `estimatedReadyAt` auto-dispatch starts | **10** |
| `order.nearestVendorRadiusKm` | Customer vendor/product discovery radius (not an order timer) | 0 |
| `order.cancelTimeLimitMinutes` | **Not read by any code** (only the model, interface and validation mention it) | 0 |

The auto-ready grace period is **not** a setting: it is the constant
`AUTO_READY_GRACE_PERIOD_MINUTES` (5) in `order.constant.ts`.

### Timeout defaults: schema, fallbacks and precedence

Three different numbers appear in the code:

| Layer | Auto-accept timeout | Auto-dispatch lead |
| --- | --- | --- |
| Mongoose schema default (`globalSetting.model.ts`) | 2 min | 10 min |
| Code fallback in the order service (`order.service.ts`: `?? 10` at order creation, `?? 15` in auto-dispatch) | 10 min | 15 min |
| Value stored in the settings document | whatever an admin set | whatever an admin set |

**Precedence at runtime** (established by reading the code and by running the
real `GlobalSettingsService.getGlobalSettings` against an in-memory MongoDB with
the repository's Mongoose version, 8.24):

1. **A stored value wins.** With `5` and `20` stored, the service returned `5`
   and `20`.
2. **Otherwise the schema default applies, not the code fallback.** The settings
   are read as a hydrated Mongoose document, so a missing `order` group or a
   missing field is filled in on read: the service returned `2` and `10` for a
   document with no `order` group and for one with an `order` group but no timing
   fields.
3. **The code fallback (10 / 15) applies only if the stored value is explicitly
   `null`.** In that test the service returned `null`, and `null ?? 10` then
   yields 10 and 15. The settings API cannot produce this state: on create, if the
   `order` group is sent both fields are required and must be positive; on update
   they are optional but must be positive numbers when sent (`null` is rejected).

**How the document normally comes to exist.** Server start-up (`seed` in
`utils/seeding.ts`) creates the settings with `GlobalSettings.create([{}])` when
none exists, so a fresh deployment stores **2 minutes** and **10 minutes**. The
`POST /api/v1/globalSettings/create` route is refused with `SETTINGS_ALREADY_EXIST_UPDATE_INSTEAD`
once a document exists. (The same seed stores `nearestVendorRadiusKm: 0`, so
customer discovery has a radius of 0 until an admin sets it.)

**Effective values, therefore:** 2 and 10 minutes for a deployment that never
changed them, the admin-set values otherwise, and 10 / 15 only in the
unreachable-through-the-API `null` case. The "default 10" and "default 15" that
earlier versions of this documentation and the backend `AGENTS.md` quote are the
code fallbacks, not the effective defaults.

**Unresolved:** the values stored in any real environment cannot be read from the
code. Check the deployed `GlobalSettings.order` group rather than assuming the
defaults; if an admin has already saved settings, the schema defaults no longer
matter.

The fixed values are constants: the 15-minute no-show grace
(`NO_SHOW_GRACE_PERIOD_MINUTES`), the 15-minute pickup reminder lead, the
120-second offer window and the 3/4/5 km search tiers.

---

## Order timing fields

| Field | Set when | Used by |
| --- | --- | --- |
| `autoAcceptDeadlineAt` | Order creation: now + `autoAcceptTimeoutMinutes` | Auto-accept |
| `vendorRespondedAt` | Manual accept, and manual reject from `PENDING` | Informational; no job reads it |
| `preparationTime` | Default `0`. Manual accept: the vendor's `preparationTime` (≥ 1 minute). Any accept then stores the minutes actually used (so an auto-accept stores the vendor default) | Input to `estimatedReadyAt` |
| `estimatedReadyAt` | Accept (manual or automatic): now + preparation minutes. The **expected** readiness | Auto-dispatch, retry, escalation, auto-ready fallback |
| `foodReadyAt` | A vendor marks a delivery order ready (the **vendor-confirmed** readiness); stays empty if the vendor never confirms | Releases the order to `READY_FOR_PICKUP` when a rider is assigned; tells the auto-ready cron not to use the fallback |
| `dispatchExpiresAt` | Every offer, and every `AWAITING_PARTNER` entry: now + 120 s | Expiry cron, retry |
| `dispatchEscalatedAt` | Escalation; reset to `null` when a rider is assigned | Escalation latch |
| `pickup.pickupTime` | Order creation (the customer's slot) | No-show, reminder |
| `pickup.readyAt` | When the pickup order becomes `READY_FOR_PICKUP` | No-show grace |
| `pickup.reminderSentAt` | Reminder cron | Reminder latch |
| `needMoreTimeCount` | Never written | See [below](#preparation-time-extensions) |

The preparation minutes are `order.preparationTime` when it is greater than 0,
otherwise the vendor's `businessDetails.preparationTimeMinutes` (default 15),
otherwise 0. A manual accept always supplies a value, so the vendor default is
used only for an auto-accept. **Inferred:** a vendor with no default and an
auto-accept would get `estimatedReadyAt = now`, making the order immediately
eligible for auto-dispatch and auto-ready.

The comments in `order.model.ts` and `order.interface.ts` that call
`autoAcceptDeadlineAt` and `estimatedReadyAt` "foundation only — not yet
consumed by transition logic" are stale: the jobs below read both.

---

## The jobs

### Claiming an order

The state-changing per-order functions (everything except the pickup reminder,
which only sets a latch) claim the order with a **conditional
`findOneAndUpdate`** (or `updateOne`) whose filter repeats the expected status and
the timing condition, and which writes the new status and its history entry in
the same statement. If another tick or another process already moved the order,
the filter no longer matches and the function returns without doing anything.
The escalation code documents this explicitly (overlapping ticks or multiple
instances cannot send the admin notice twice). **Inferred:** the same pattern makes
the other jobs safe to run concurrently, although only escalation says so.

Notifications, emails and socket emits happen after the database write and are
not part of it.

### Auto-accept (`autoAcceptOrder`)

- Picks `PENDING`, non-deleted orders with `autoAcceptDeadlineAt <= now`.
- In one transaction: claims the order as `ACCEPTED`, then applies the same
  effects as a manual accept (fills `pickupAddress`, deducts stock for
  non-`RESTAURANT` vendors) and persists `PREPARING` with `estimatedReadyAt`. Only
  the customer email `ACCEPTED` is sent (no push).
- None of the manual-accept checks are applied (vendor ownership, `APPROVED`
  profile, paid, `preparationTime`); the vendor's agreement and store state are
  also not consulted.
- If the transaction fails, for example `INSUFFICIENT_STOCK`, it rolls back, the
  order stays `PENDING`, the error is logged, and **the next tick tries again,
  every minute**, until the vendor rejects it, the customer cancels, or stock
  becomes available. There is no retry limit.

### Auto-dispatch, retry and escalation

Covered in [Delivery Dispatch and Riders](./delivery-dispatch.md). The lead time
is `autoDispatchLeadMinutes`; an order is eligible when it is a `DELIVERY` order
in `PREPARING` with no rider and an empty pool and `estimatedReadyAt` is within
the lead time. Retry and escalation depend on whether `estimatedReadyAt` is still
in the future.

If the geo search or the dispatch write fails unexpectedly after an order was
claimed into `DISPATCHING`, `dispatchOrderToPartners` moves it back to
`AWAITING_PARTNER` with a fresh `dispatchExpiresAt` (about 120 seconds ahead) and
rethrows the error, so the retry and escalation steps above pick it up instead of
leaving it in `DISPATCHING` with an empty pool and no expiry. This is a recovery
path, not a successful dispatch. It applies only while the pool is still empty; if
the failure happens after the pool and expiry were written, the order stays
`DISPATCHING` and the normal expiry step handles it.

### Auto-ready (`autoReadyOrder`)

`READY_FOR_PICKUP` is the status that allows pickup, and the vendor can confirm
it. `estimatedReadyAt` is only the expected time; the cron is the fallback when the
vendor says nothing. The job claims an order in one of two ways, each with a
conditional update so only one run changes it:

| Trigger | Orders | Effect |
| --- | --- | --- |
| **Fallback** (vendor never confirmed: `foodReadyAt` empty) | `ASSIGNED` delivery orders, and `PREPARING` **pickup** orders, whose `estimatedReadyAt` is at least `AUTO_READY_GRACE_PERIOD_MINUTES` (5) in the past | Becomes `READY_FOR_PICKUP` with the history note "Auto-marked ready: the vendor did not confirm within 5 minutes of estimatedReadyAt". The run that wins the update alerts every `ADMIN` / `SUPER_ADMIN` once (`ORDER_AUTO_READY_FALLBACK_TO_ADMIN`) and, for a delivery order, pushes the assigned rider (`ORDER_AUTO_READY_TO_PARTNER`) |
| **Vendor-confirmed** (`foodReadyAt` set) | `ASSIGNED` delivery orders | Becomes `READY_FOR_PICKUP` with the note "the vendor had confirmed the food ready and a rider is now assigned". No admin alert and no rider push. Normally the order was already released when the rider was assigned, so this is a safety net |

- A **delivery order with no rider** is never touched by this job; it can only
  become ready after a rider is assigned. When a rider is assigned to an order that
  already has `foodReadyAt` (a rider accepting an offer, or an admin assigning a
  rider), the assignment itself releases it to `READY_FOR_PICKUP` in the same
  transaction, so the rider's `PICKED_UP` works straight away.
- A vendor that marks a delivery order ready while a rider is already assigned
  gets the status change immediately, without waiting for this job. The vendor's
  manual action does **not** send the rider push above.
- For a pickup order the fallback also sets `pickup.readyAt` and notifies the
  customer with the pickup code (as the vendor action does).
- Marking an order ready does not change dispatch timing: auto-dispatch, retry and
  escalation still follow `estimatedReadyAt` and the vendor's broadcast.

### No-show (`handleAutoNoShowCron`, `autoMarkOrderNoShow`)

Every 5 minutes it loads all non-deleted `PICKUP` orders in `READY_FOR_PICKUP`. For each:

1. If `max(pickup.pickupTime, pickup.readyAt) + 15 minutes` has passed, mark it
   `NO_SHOW` (trigger `GRACE_PERIOD`).
2. Otherwise compute the vendor's closing instant (in the vendor's timezone; for a
   `RESTAURANT` vendor today's closing time, otherwise the closing time on the
   scheduled pickup day) and mark it `NO_SHOW` (trigger `CLOSING_TIME`) once it has
   passed. Vendors with no opening or closing hours have no closing rule.

`NO_SHOW` sets `refundStatus: NOT_APPLICABLE`, writes a fixed `cancelReason`,
restores stock for non-`RESTAURANT` vendors, and queues `PROCESS_ORDER_POST_UPDATE`
so the order settles. There is no customer notification for `NO_SHOW`.

### Pickup reminder (`handlePickupTimeReminderCron`)

Every 5 minutes it finds non-deleted `PICKUP` orders that are not in a terminal
status (`CANCELED`, `REJECTED`, `NO_SHOW`, `PICKED_UP_BY_CUSTOMER`), have a
`pickupTime` between now and 15 minutes ahead, and no `pickup.reminderSentAt`. It
saves `reminderSentAt` first, then sends the customer a push
(`ORDER_PICKUP_TIME_REMINDER_TO_CUSTOMER`). **Inferred:** with a 5-minute schedule
and a 15-minute window, the reminder goes out roughly 10 to 15 minutes before the
slot. Because it does not filter by status, an order still `PENDING` or
`PREPARING` gets the reminder too.

### Expiry (`handleOrderExpiryCron`)

`DISPATCHING` orders whose `dispatchExpiresAt` is before now become
`AWAITING_PARTNER`, the offered riders are added to the rejected pool, and the
pool is cleared. It emits `REMOVE_ORDER_POPUP` and the vendor event
`ORDER_DISPATCH_EXPIRED` (not `ORDER_STATUS_UPDATED`); see
[Order Tracking and Realtime](./order-tracking-and-realtime.md#order-events).

---

## Preparation-time extensions

**There is no preparation-time extension feature in the current code.** The
vendor cannot extend `estimatedReadyAt`: the order routes have no such endpoint,
and no service function changes `preparationTime` or `estimatedReadyAt` after the
accept. What remains is unused scaffolding:

- `Order.needMoreTimeCount` (default 0, never written);
- the message key `ORDER_NEED_MORE_TIME_SUCCESS`;
- the push template `ORDER_NEED_MORE_TIME_TO_CUSTOMER` (it interpolates
  `extensionMinutes`), which no code sends.

The related global setting was removed from the settings and services in an
earlier change (the backend history has a commit named "remove preparation
extension minutes from global settings and related services"). The vendor's
`preparationTimeMinutes` is only a default, not an extension.

---

## What is not automated

- **No auto-cancel of pickup orders.** `PICKUP_AUTO_CANCEL_HOURS` (24) is defined
  in `order.constant.ts` but not used anywhere.
- **No timeout for a paid `PENDING` order other than auto-accept.** There is no
  auto-reject or auto-cancel.
- **No timeout after escalation.** An escalated `AWAITING_PARTNER` order waits for
  an admin assignment or a vendor broadcast indefinitely; the customer can still
  cancel.
- **No expiry of unpaid checkout summaries** in the order cron. Summaries are only
  replaced when the same customer checks out again with the same vendor (see
  [Checkout and Order Creation](./checkout-and-order-creation.md)).
- **No automatic refund.** Cancellation and rejection only set `refundStatus`;
  refunds are an admin action (see
  [Cancellations, Refunds and Settlement](./cancellations-refunds-settlement.md)).
- **`cancelTimeLimitMinutes` is not enforced.** Customer cancellation is allowed
  from any non-terminal status regardless of time.

---

## Related documentation

- [Order Lifecycle](./order-lifecycle.md): transitions, conditions and history semantics.
- [Delivery Dispatch and Riders](./delivery-dispatch.md): the dispatch, retry and escalation mechanics.
- [Delivery Exceptions and Verification](./delivery-exceptions.md): what happens to an in-transit order when the hand-over cannot finish.
- [Checkout and Order Creation](./checkout-and-order-creation.md): where `autoAcceptDeadlineAt` is set.
- [Cancellations, Refunds and Settlement](./cancellations-refunds-settlement.md): what `NO_SHOW` and cancellations do to stock and money.
- [Vendors and Branches](../04-vendors/vendors-and-branches.md): store schedule, timezone and the vendor default preparation time.
- [Architecture](../01-introduction/architecture.md): the scheduler and BullMQ workers in context.
