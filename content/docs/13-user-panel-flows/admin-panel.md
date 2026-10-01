---
title: Admin Panel
description: "What the admin role can do in the backend: account and permission access, governance of users, vendors and branches, riders and fleet managers, the catalog, order intervention, refunds and payout finalization, ingredients, platform settings, agreements and permissions, broadcasts, support and SOS, activity logs and analytics, and the route restrictions and asymmetries to know about."
order: 8
---

# Admin Panel

This page describes the **admin role** (`ADMIN`) as the backend implements it. A
`SUPER_ADMIN` shares nearly every admin route, so the routes below apply to both; the few
places where the two differ are collected in
[ADMIN versus SUPER_ADMIN at route level](#admin-versus-super_admin-at-route-level). A
separate super-admin page is not part of this layer yet.

It builds on [User Panel Flows Overview](./overview.md), [Onboarding Journey](./onboarding-journey.md),
[Order Journey](./order-journey.md) and the role pages, and links to the technical pages for
every rule instead of repeating them.

Paths are relative to `src/app/`. Statements come from the committed backend code.
Behavior read from code but not run is marked **Inferred**; behavior a probe ran is marked
**Executed**. Uncommitted working-tree features are not described. The backend has no concept
of a panel or a screen, so this page says nothing about how a client presents these routes.

---

## 1. Role purpose

The admin is the back office: it decides who may operate (approval, correction, blocking),
configures the platform, intervenes where automation stops (rider assignment, refunds,
payout proof), watches the platform (analytics, SOS, support, activity logs) and manages the
legal agreements. It is not a participant in the order flow, and its power over an order is
small and specific.

A defining trait of this role: **most admin routes need no permission code.** Only five of
the fourteen permission codes are enforced anywhere, so an `ADMIN` with an empty permission
list reaches most of what is described below.

---

## 2. Account and access

| Topic | Behavior | Owning page |
| --- | --- | --- |
| Creation | Onboarded by a `SUPER_ADMIN` only, who chooses the initial password. Not self-registered | [Onboarding Journey](./onboarding-journey.md#admin-and-super-admin) |
| Verification | Email OTP at `POST /auth/verify-otp`; status stays `PENDING` | [Authentication](../03-identity-access/authentication.md#flow-customer-otp-login) |
| Approval | `PENDING` → `SUBMITTED` → `APPROVED`. The admin or another admin submits; **a different admin or the super admin approves**, because nobody can change their own status. No agreement | [User Lifecycle](../03-identity-access/user-lifecycle.md#approval-rejection-and-blocking) |
| Permissions | A list of action codes on the `Admin` profile. Assigned and revoked through the permission routes; only five codes are enforced | [Authorization](../03-identity-access/authorization.md#admin-permissions) |
| Own profile | `PATCH /admins/:adminId`, `PATCH /admins/:adminId/docImage`, `GET /admins/:adminId`: an `ADMIN` only for itself. Refused while the profile is locked | [Authorization](../03-identity-access/authorization.md#super_admin-vs-admin) |
| Password | `change-password`, `forgot-password` and `reset-password` are available to an `ADMIN` | [Authentication](../03-identity-access/authentication.md#flow-forgot--reset-password) |
| Many services need `APPROVED` | Several admin reads and writes refuse an admin whose own status is not `APPROVED` (for example `GET /vendors`, sponsorships), though an unapproved admin can sign in | [User Lifecycle](../03-identity-access/user-lifecycle.md#lifecycle-effects-on-authentication-and-authorization) |
| Not gated | An admin is never subject to the agreement gate | [Agreement Gate](../07-agreements/agreement-gate.md#short-answers) |
| Deleting | An admin can soft-delete any account except a `SUPER_ADMIN`, and permanently delete one that is already soft-deleted | [User Lifecycle](../03-identity-access/user-lifecycle.md#soft-delete) |

---

## 3. Main capabilities

| Area | Representative routes | Permission code | Owning page |
| --- | --- | --- | --- |
| Account decisions | `PATCH /auth/:userId/approved-rejected-user`, `request-corrections`, `submitForApproval` (for anyone) | None | [User Lifecycle](../03-identity-access/user-lifecycle.md) |
| Onboarding | `POST /auth/register/onboard` | None | [Onboarding Journey](./onboarding-journey.md#which-callers-can-onboard-whom) |
| Account removal | `DELETE /auth/soft-delete/:userId`, `DELETE /auth/permanent-delete/:userId` | None | [User Lifecycle](../03-identity-access/user-lifecycle.md#permanent-delete) |
| Directories | `GET /customers`, `GET /vendors`, `GET /fleet-managers`, `GET /delivery-partners`, `GET /admins` and the single reads | None | Sections 4 to 6 |
| Catalog | `PATCH /products/approveOrReject/:productId`, `POST /products/admin/create-product`, stock alerts, `POST /search/reindex`, offers, categories, add-ons, sponsorships, taxes, restricted items | None | [Products](../05-products/products.md#endpoints-and-roles) |
| Orders | `GET /orders`, `GET /orders/:orderId/nearby-partners`, `PATCH /orders/:orderId/assign-partner` | `CAN_MANAGE_ORDERS` on the last two | [Delivery Dispatch](../03-orders/delivery-dispatch.md#admin-tools) |
| Refunds | `POST /payment/reduniq/refund/:orderId` | None | [Cancellations, Refunds and Settlement](../03-orders/cancellations-refunds-settlement.md#refunds) |
| Payouts | `POST /payouts/finalize-settlement/:payoutId`, `GET /payouts`, `GET /wallets`, `GET /transactions` | None | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md) |
| Ingredients | `/ingredients`, `/ingredients-order/admin/all`, `PATCH /ingredients-order/:orderId/status` | `CAN_MANAGE_INGREDIENTS` on the catalog only | [Ingredient Purchasing](../04-vendors/ingredient-purchasing.md) |
| Platform settings | `/globalSettings`, `/commission-rates`, `/taxes`, `/zones`, `/categories`, `/restricted-items` | None | [Platform Settings](../02-platform/platform-settings.md) |
| Agreements | `/agreement-versions`, `/agreements` | `CAN_MANAGE_AGREEMENTS` | [Agreements](../07-agreements/agreements.md) |
| Permissions | `/permissions` | `CAN_MANAGE_PERMISSIONS` | [Authorization](../03-identity-access/authorization.md#admin-permissions) |
| Notifications | `POST /notifications/broadcast`, `GET /notifications/all`, `POST /test/send-notification` | None | [Notifications](../06-notifications/notifications.md#admin-broadcast) |
| Support and SOS | `/support/*` as an agent, `/sos/*` | None | [Support](../02-platform/support.md), [SOS](../02-platform/sos.md) |
| Activity logs | `GET /activity-logs`, `GET /activity-logs/:id` | `CAN_MANAGE_ACTIVITY_LOGS` | [Activity Logs](../12-activity-logs/activity-logs.md) |
| Analytics | `/analytics/admin/*`, `offer-analytics` | None | [Analytics](../02-platform/analytics.md#admin-reports-admin-super_admin) |
| Other reads | `GET /carts`, `GET /points/all-points`, `GET /login-histories` (all rows) | None | [Cart](../08-cart/cart.md#endpoints), [Points and Referrals](../09-offers-and-coupons/points-and-referrals.md#routes-apiv1points) |

---

## 4. User governance

| Task | Route and rules | Notes |
| --- | --- | --- |
| Approve, reject or block | `PATCH /auth/:userId/approved-rejected-user`. Not on itself; the target must not already be in that status; `remarks` required for reject and block | A vendor or fleet manager can only be approved from `SUBMITTED`, with a party-signed agreement and a configured DeliGo signatory when an agreement version is effective. Every other role can move between any two statuses |
| Request corrections | `PATCH /auth/:userId/request-corrections` | Only for vendor, branch, fleet manager and rider; only while `SUBMITTED` or `APPROVED`; one open request at a time. The owner confirms |
| Submit for someone | `PATCH /auth/:userId/submitForApproval` | An admin may submit any account, which is the only way to submit on behalf of a party that cannot call the route |
| Onboard | `POST /auth/register/onboard` | Vendor, branch (send the parent's `userId` as `parentVendorId`), rider and fleet manager. Creating an admin is `SUPER_ADMIN` only |
| Edit another account | Customer: `PATCH /customers/:customerId`. Vendor, branch, rider, fleet manager: their update and document routes | Admins bypass the profile lock. An admin can also set `isUpdateLocked` directly on a vendor |
| Delete | `DELETE /auth/soft-delete/:userId`, then `permanent-delete` | Needs an `APPROVED` admin. The profile and `AuthUser` are removed; related records are not |
| See who is who | `GET /customers`, `GET /vendors`, `GET /fleet-managers`, `GET /delivery-partners`, `GET /admins` | See the asymmetry on admin reads below |
| See sign-in history | `GET /login-histories` returns every row | A non-admin sees only its own |

There is **no unblock route.** `APPROVED` is reachable from `BLOCKED` for a role without an
agreement, but a vendor or fleet manager needs `SUBMITTED` first, and a blocked account cannot
call `submitForApproval` itself. **Inferred:** an admin could submit on its behalf and then
approve; this was not run and is not documented as a procedure.

Owning pages: [User Lifecycle](../03-identity-access/user-lifecycle.md),
[Onboarding Journey](./onboarding-journey.md#approval-rejection-correction-and-blocking).

---

## 5. Vendor and branch governance

| Task | Route | Notes | Owning page |
| --- | --- | --- | --- |
| Read vendors | `GET /vendors`, `GET /vendors/:vendorId`, `GET /vendors/:vendorId/branches` | The list needs an `APPROVED` admin. The profile response adds agreement information and `coveredByAgreement` | [Vendors and Branches](../04-vendors/vendors-and-branches.md#parentbranch-permissions) |
| Edit a vendor or branch | `PATCH /vendors/:vendorId`, `PATCH` and `DELETE /vendors/:vendorId/docImage` | Staff bypass the lock. A branch's `businessName` and `businessType` cannot be changed by anyone | [Vendors and Branches](../04-vendors/vendors-and-branches.md#profile-updates-the-lock-and-correction-requests) |
| Approve a branch | The same account decision route | A branch has no agreement precondition and the parent's status is not consulted | [Vendors and Branches](../04-vendors/vendors-and-branches.md#known-implementation-inconsistencies) |
| Create branches for a parent | `POST /auth/register/onboard` with `parentVendorId` | The branch copies the parent's business, bank and document data once | [Onboarding Journey](./onboarding-journey.md#sub-vendor) |
| Create catalog items for a vendor | `POST /products/admin/create-product`, `POST /product-categories/admin/create-product-category`, `POST /add-ons/admin/create-group` | Each takes a `vendorId`; the vendor must be `APPROVED` | [Products](../05-products/products.md#creating-a-product) |
| Copy products to branches | `POST /products/copy-to-sub-vendors` | An admin must send `sourceVendorId` | [Vendors and Branches](../04-vendors/vendors-and-branches.md#copy-to-branches-post-productscopy-to-sub-vendors) |
| Vendor agreement | `/agreements/party/:partyId` | Visible only to the admin that created the row, apart from a super admin | Section 13 |

Limits of vendor governance:

- **No store control.** The store open/close route is for the vendor and branch only; an
  admin cannot toggle it.
- **No cascade.** Blocking or deleting a parent does not change its branches, which can still
  be listed and ordered from.
- **No vendor-specific delete route.** Removal goes through the shared account routes.

---

## 6. Delivery and fleet governance

| Task | Route | Notes | Owning page |
| --- | --- | --- | --- |
| Read riders and fleet managers | `GET /delivery-partners`, `GET /delivery-partners/:id`, `GET /fleet-managers`, `GET /fleet-managers/:id` | The admin reads include soft-deleted rows by userId | [Delivery Dispatch](../03-orders/delivery-dispatch.md#rider-state) |
| Approve riders and fleet managers | The account decision route | A fleet manager needs a signed agreement; a rider needs none | [Onboarding Journey](./onboarding-journey.md#fleet-manager) |
| Attach a rider to a fleet manager | `PATCH /delivery-partners/:deliveryPartnerId/assign-fleet-manager` | Body `fleetManagerId`; the manager must be `APPROVED`. **Admin only, one-way:** no route clears or changes the link, and the rider's earnings then go to the manager | [Onboarding Journey](./onboarding-journey.md#delivery-partner) |
| Edit riders and managers | Their update and document routes | There is no `DELETE` route for rider documents | [Onboarding Journey](./onboarding-journey.md#correction-requests) |
| Performance | `fleet-performance-analytics`, `fleet-performance-details-analytics/:fleetManagerId`, `delivery-partner-performance-analytics`, `delivery-partner-performance-details-analytics/:partnerUserId`, `delivery-partner-analytics` | Detail routes take the `userId` | [Analytics](../02-platform/analytics.md#admin-reports-admin-super_admin) |
| Dispatch | `nearby-partners`, `assign-partner` | Section 8 | [Delivery Dispatch](../03-orders/delivery-dispatch.md#admin-tools) |
| Settlement | Finalize payouts, read wallets | Section 10 | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md) |
| Safety | SOS monitoring and status | Section 15 | [SOS](../02-platform/sos.md) |

An admin has **no route to force a rider online or offline**, because the availability route
is rider-only, and none to move a rider between fleet managers.

---

## 7. Catalog governance

| Task | Route | Behavior | Owning page |
| --- | --- | --- | --- |
| Approve or reject a product | `PATCH /products/approveOrReject/:productId` | Rejecting requires `remarks`. Approval is **post-hoc**: products are created already approved, so an admin can only reject afterwards, and deactivating a rejected product re-approves it | [Products](../05-products/products.md#approval-status-and-deletion) |
| Delete products | `DELETE /products/soft-delete/:productId`, `permanent-delete/:productId` | A soft delete is blocked while any active order contains the product. Permanent delete follows a soft delete | Same page |
| Stock alerts | `GET /products/out-of-stock-alerts`, `POST /products/notify-vendor/:productId` | The notify route takes the Mongo `_id` and pushes and emails the vendor | [Products](../05-products/products.md#alerts) |
| Search index | `POST /search/reindex` | Rewrites every approved, active, non-deleted product | [Menus](../05-products/menus.md#search-and-the-meilisearch-index) |
| Offers | `/offers` | An admin's offers are global; an admin can manage any vendor's offer and permanently delete one | [Offers](../09-offers-and-coupons/offers.md#who-can-do-what) |
| Business categories, cuisines | `/categories/businessCategory`, `/categories/cuisine` | Admin writes; public reads exist | [Platform Settings](../02-platform/platform-settings.md#business-categories-and-cuisines) |
| Vendor categories and add-ons | The admin create routes and `PATCH` | **Admins cannot delete vendor product categories or add-on groups**: those delete routes are owner-only | [Products](../05-products/products.md#product-categories) |
| Taxes, restricted items | `/taxes`, `/restricted-items` | Restricted items are not consumed by any code | [Platform Settings](../02-platform/platform-settings.md#restricted-items) |
| Sponsorships | `/sponsorships` | Admin writes; a banner file is required; permanent delete is the only audited action | [Sponsorships](../02-platform/sponsorships.md#admin-operations) |
| AI product text | `POST /ai/generate-product-description` | Open to admins as well as vendors | [Products](../05-products/products.md) |

There is **no menu to govern.** The platform has no menu system, only products and
categories ([Menus](../05-products/menus.md#verdict-is-there-a-menu-system)).

---

## 8. Order intervention

An admin's power over a single order is **narrow**.

| Task | Route | Rules | Owning page |
| --- | --- | --- | --- |
| Find an order | `GET /orders`, `GET /orders/:orderId` | Unrestricted by the role filter; no permission code | [Order Tracking and Realtime](../03-orders/order-tracking-and-realtime.md#role-scoping) |
| Download the invoice | `GET /orders/:orderId/download-invoice-pdf` | After the invoice has synced | [Order Tracking and Realtime](../03-orders/order-tracking-and-realtime.md#invoice) |
| Find riders for an order | `GET /orders/:orderId/nearby-partners` | `CAN_MANAGE_ORDERS` for an `ADMIN`. Read-only; up to 20 idle approved riders within 5 km of the pickup address; nothing is reserved. It does not check the order's status | [Delivery Dispatch](../03-orders/delivery-dispatch.md#admin-tools) |
| Assign a rider | `PATCH /orders/:orderId/assign-partner` | `CAN_MANAGE_ORDERS`. Only a delivery order in `AWAITING_PARTNER` without a rider; the rider must be approved, idle and free; the rider and vendor are pushed | Same page |
| Be alerted | Push `ORDER_DISPATCH_ESCALATED_TO_ADMIN` | Once per order, after `estimatedReadyAt` passes with no rider | [Order Automation](../03-orders/order-automation.md#auto-dispatch-retry-and-escalation) |

For an order that is already in transit (`PICKED_UP` / `ON_THE_WAY`), an admin can also
work the delivery exceptions: acknowledge or resolve a rider SOS, reset a locked delivery
OTP, replace the rider after an SOS, ask the customer to confirm receipt, complete the
delivery manually (with the customer's confirmation or a verified OTP) and cancel it as
a delivery fault (an open SOS or the customer's NO). Same `CAN_MANAGE_ORDERS` rule. These
are described in [Delivery Exceptions and Verification](../03-orders/delivery-exceptions.md).

What an admin **cannot** do to an order: reject it, change its status freely, mark it
ready, or cancel it other than through the fault-cancel rule above. There is no general
admin cancellation path ([Order Lifecycle](../03-orders/order-lifecycle.md#implementation-notes-and-inconsistencies)).
After escalation there is no timeout; the order waits for an admin or a vendor broadcast.

---

## 9. Refunds

| Topic | Behavior | Owning page |
| --- | --- | --- |
| Route | `POST /payment/reduniq/refund/:orderId`, any admin, **no permission code** | [Cancellations, Refunds and Settlement](../03-orders/cancellations-refunds-settlement.md#refunds) |
| Eligibility | A paid order that is `REJECTED` or `CANCELED` with `refundStatus` not `NOT_APPLICABLE` | Same page |
| Amount | The full grand total, delivery and service charge included. No partial refund | Same page |
| Gateway | A refund, falling back to a void when the payment has not settled | [Payments](../10-payments/payments.md#refunds-and-voids) |
| Records | The order becomes refunded, a `REFUND` ledger row is written, the customer is emailed | Same page |
| Not automatic | Reject and cancel only mark a refund as owed. The admin finds those orders and runs the refund | Same page |

Gaps: a customer cancel after the vendor has accepted ends with `NOT_APPLICABLE`, which this
route refuses, and the code does not say whether a manual resolution exists outside the API.
`REFUND_STATUS.FAILED` is never written, so a failed attempt leaves the order unchanged and the
admin retries. There is no list of orders awaiting a refund beyond filtering `GET /orders`.
(**Inferred:** the order list can be filtered by `refundStatus` as an ordinary top-level key.)

---

## 10. Payout finalization

| Topic | Behavior | Owning page |
| --- | --- | --- |
| Who creates payouts | **Not an admin.** The automatic daily run creates them (when enabled and on a payout day); the only manual request route is the fleet manager's, and it currently fails validation | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md#payout-lifecycle) |
| Finalize | `POST /payouts/finalize-settlement/:payoutId` with a proof file and `bankReferenceId`. Any admin, no permission code | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md#finalizing-post-payoutsfinalize-settlementpayoutid) |
| What it does | Moves the payout to `PAID`, debits the recipient's locked and current balance, debits the **payout's sender** wallet, writes a settlement row and pushes the recipient | Same page |
| No money movement | The backend records a transfer a person made; it does not move money | Same page |
| No reject or cancel | A pending payout can only be finalized | Same page |
| Wallet views | `GET /wallets`, `GET /wallets/:walletId` for any wallet; `GET /payouts` for all payouts | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md#reading-wallets) |
| Own wallet | `GET /wallets/me` returns a **hard-coded** wallet id for an admin, not the caller's | Same page |

Also: an automatic payout is created only if a `SUPER_ADMIN` exists, because the sender is
that account (**Executed**: without one the create fails). An admin finalizing an automatic
payout debits the **super admin's** wallet, and finalizing one a fleet manager requested would
debit the fleet manager's (**Inferred**).

---

## 11. Ingredients

| Task | Route | Permission | Owning page |
| --- | --- | --- | --- |
| Manage the catalog | `POST /ingredients/create-ingredient`, `PATCH /ingredients/update-ingredient/:ingredientId`, soft and permanent delete | `CAN_MANAGE_INGREDIENTS` for an `ADMIN` | [Ingredient Purchasing](../04-vendors/ingredient-purchasing.md#catalog-routes-apiv1ingredients) |
| Read the catalog | `GET /ingredients`, `GET /ingredients/:sku` | The same permission for an `ADMIN`; vendors are not checked | Same page |
| Read purchases | `GET /ingredients-order/admin/all`, `GET /ingredients-order/:orderId` | None | [Ingredient Purchasing](../04-vendors/ingredient-purchasing.md#reading-orders) |
| Ship and deliver | `PATCH /ingredients-order/:orderId/status` (`SHIPPED`, then `DELIVERED`) | None | [Ingredient Purchasing](../04-vendors/ingredient-purchasing.md#4-shipping-patch-ingredients-orderorderidstatus) |
| Be alerted | Push `NEW_INGREDIENT_PURCHASE_TO_ADMIN` when an order is confirmed | None | Same page |

A permission is needed to **read** the catalog but not to ship an order, and status updates send
no notification and write no activity log. There is no refund or cancel route for an ingredient
order.

---

## 12. Platform settings

| Area | Routes | Owning page |
| --- | --- | --- |
| Global settings | `POST /globalSettings/create`, `PATCH /globalSettings/update`, `GET /globalSettings` | [Platform Settings](../02-platform/platform-settings.md#global-settings) |
| Commission rates | `/commission-rates` (the delete route cancels a rate) | [Platform Settings](../02-platform/platform-settings.md#commission-rates) |
| Taxes | `/taxes` | [Platform Settings](../02-platform/platform-settings.md#taxes) |
| Zones | `/zones`; permanent delete is `SUPER_ADMIN` only | [Platform Settings](../02-platform/platform-settings.md#zones) |
| Categories and cuisines | `/categories/...` | [Platform Settings](../02-platform/platform-settings.md#business-categories-and-cuisines) |
| Restricted items | `/restricted-items` | [Platform Settings](../02-platform/platform-settings.md#restricted-items) |

Points that matter to an operator, all stated on the technical page:

- **No permission code is required** for any of them; `CAN_MANAGE_SYSTEM_SETTINGS` is not
  enforced.
- **Several settings are not read by any code**, for example `order.cancelTimeLimitMinutes` and
  `rewards.referralPoints`, and zones are stored but not used for dispatch or pricing.
- **A setting of `0` is often ignored** because the code falls back with `||`: for example the
  rider points per delivery, delivery VAT and ingredient delivery charges.
- **The audit trail is thin.** A settings change records only that it happened, with no before
  or after values.
- The global settings also hold the **DeliGo signatory** that approving a vendor or fleet
  manager requires, and the payout and activity-log retention settings.

---

## 13. Agreements and permissions

| Task | Routes | Notes | Owning page |
| --- | --- | --- | --- |
| Draft and publish a version | `POST /agreement-versions`, `PATCH /agreement-versions/:id`, `GET .../preview`, `POST .../publish` | Needs `CAN_MANAGE_AGREEMENTS` for an `ADMIN`. A published version cannot be edited, unpublished or deleted | [Agreements](../07-agreements/agreements.md#versioning-and-publishing) |
| What publishing does | `POST /agreement-versions/:id/publish` | Assigns a version number and queues a push and email per affected party. It does not make the version binding: that happens when its effective date passes, with no job | [Agreements](../07-agreements/agreements.md#automation-worker-notifications-and-emails) |
| Work on a party's agreement | `/agreements/party/:partyId`, sign, edit, read | An admin sees, edits and signs only rows **it created**; only a super admin has a full view | [Agreements](../07-agreements/agreements.md#endpoints-and-who-may-call-them) |
| Configure the DeliGo signature | Global settings | Approval of a vendor or fleet manager needs it when a version is effective | [Platform Settings](../02-platform/platform-settings.md#agreement-signatory-and-activity-log-retention) |
| Manage permission definitions | `POST /permissions/create`, `PATCH /permissions/:permissionId`, `GET`, `DELETE` | `CAN_MANAGE_PERMISSIONS` for an `ADMIN`. System-defined permissions cannot be deleted or have their action changed | [Authorization](../03-identity-access/authorization.md#the-permission-collection-vs-the-string-list) |
| Assign and revoke | `PATCH /permissions/assign-permissions/:adminId`, `revoke-permissions/:adminId` | Same permission | Same page |

Facts that follow from the code:

- **Only five codes are enforced**: permissions, agreements, ingredients, activity logs and the
  two order-dispatch routes. The other nine can be assigned and have no effect.
- **The assign route has no guard on the target.** It accepts any admin account, so **Inferred:**
  an `ADMIN` holding `CAN_MANAGE_PERMISSIONS` can grant itself or anyone any permission.
- **Agreement visibility is per creator**, so a non-super admin does not see agreements created
  by the parties themselves or by the gate.

---

## 14. Notifications and broadcast

| Task | Route | Behavior | Owning page |
| --- | --- | --- | --- |
| Broadcast | `POST /notifications/broadcast` | `EMAIL`, `PUSH` or `BOTH` to roles, optionally narrowed by user ids. Answers at once and runs in the same process, so a restart loses the remainder (**Inferred**). A record is written for every processed user; `BOTH` needs a push token for the email too | [Notifications](../06-notifications/notifications.md#admin-broadcast) |
| Read everything | `GET /notifications/all` | An admin sees every notification and may filter by receiver | [Notifications](../06-notifications/notifications.md#in-app-notification-apis) |
| Test a push | `POST /test/send-notification` | A fixed payload, nothing stored | [Notifications](../06-notifications/notifications.md#push-notification-flow) |
| Receive | Pushes for approval submissions, correction confirmations, dispatch escalation and ingredient purchases | Delivery does not check permission codes | [Notification Flow](../02-platform/notification-flow.md#8-other-notification-sources) |

An admin's own list works like any user's. Permanent deletion of notifications is `SUPER_ADMIN`
only, and a super admin's soft-delete-all affects every user's notifications.

---

## 15. Support and SOS

| Topic | Admin behavior | Owning page |
| --- | --- | --- |
| Support as an agent | `POST /support/send-message` with `targetUserObjectId`, `targetUserId` and `targetUserModel` in the body, which are not checked against the database. An agent cannot create a ticket; the user does. The first reply assigns the agent and sets `IN_PROGRESS` | [Support](../02-platform/support.md#sending-a-message-createmessage) |
| Read | All tickets, all messages, mark read | [Support](../02-platform/support.md#reading) |
| Close | `PATCH /support/tickets/:ticketId/close`; logs `SUPPORT_TICKET_CLOSED` | [Support](../02-platform/support.md#closing) |
| Live alerts | Joins `admin-notifications-room` on connect and receives `incoming-notification` for messages sent **over the socket**; a message sent over REST emits nothing | [Support](../02-platform/support.md#socketio-events) |
| SOS monitoring | `join-sos-monitoring`, then `new-sos-alert`; `GET /sos`, `GET /sos/nearby` (needs the admin's own stored location), `GET /sos/stats`, `GET /sos/user/:id`, `GET /sos/:id` | [SOS](../02-platform/sos.md#reading-alerts-over-rest) |
| SOS status | `PATCH /sos/:id/status`: `INVESTIGATING`, `FALSE_ALARM`, `RESOLVED`; only `RESOLVED` is final. Logs `SOS_STATUS_CHANGED`. The update is emitted to the SOS monitoring room and the alert owner only. For a rider SOS on an order, the order routes in section 8 also update the alert | [SOS](../02-platform/sos.md#status-workflow) |
| Raising an SOS | `POST /sos/trigger` lists `ADMIN`, but **Executed:** the alert fails validation, so an admin cannot raise one | [SOS](../02-platform/sos.md#mismatches-and-inconsistencies) |

---

## 16. Activity logs

| Topic | Behavior | Owning page |
| --- | --- | --- |
| Read | `GET /activity-logs`, `GET /activity-logs/:id`; `CAN_MANAGE_ACTIVITY_LOGS` for an `ADMIN`. Every entry is visible, including other admins' | [Activity Logs](../12-activity-logs/activity-logs.md#reading-the-log) |
| Filters | Search on name, email, action and target; equality filters on actor, role, action, entity type and entity id. **No date-range filter** | Same page |
| Not editable | There is no create, edit or delete endpoint | [Activity Logs](../12-activity-logs/activity-logs.md#immutability-and-retention) |
| Coverage | Partial. Writes are fire-and-forget and can be lost; there is no IP, user agent or before and after value | [Activity Logs](../12-activity-logs/activity-logs.md#mismatches-and-gaps) |
| Retention | Archived after 12 months and deleted after 18 by default; archived entries cannot be read through any route | Same page |
| Missing entry | An unknown id returns `200` with null data | Same page |

Admin actions that **are not logged** include sponsorship creation, updates and soft deletes (only
the permanent delete is logged); settings changes are logged without values. See the inventory on [Activity Logs](../12-activity-logs/activity-logs.md#trigger-inventory).

---

## 17. Analytics

| Group | Routes (`/analytics/admin/...`) | Owning page |
| --- | --- | --- |
| Entity reports | `sales-report-analytics`, `order-report-analytics`, `customer-report-analytics`, `vendor-report-analytics`, `fleet-manager-report-analytics`, `delivery-partner-report-analytics` | [Analytics](../02-platform/analytics.md#admin-reports-admin-super_admin) |
| Performance | The fleet, rider and vendor performance routes | Same page |
| Platform insight | `sales-analytics`, `customer-insights`, `top-vendors`, `peak-hours`, `delivery-insights`, `delivery-partner-analytics`, `all-customers-analytics` | Same page |
| Money | `platform-earnings` | Same page |
| Dashboard | `dashboard-analytics` | Same page |
| Offers | `GET /analytics/offer-analytics` | Same page |

Reading them correctly depends on the known gaps: **completed pickup orders are not counted**
(every "completed" filter is `DELIVERED`), the dashboard counts do not exclude soft-deleted
rows, and "canceled" is narrower in some reports than in others. No permission code is
enforced. See [Analytics](../02-platform/analytics.md#mismatches-and-inconsistencies).

---

## 18. Restrictions and route asymmetries

### ADMIN versus SUPER_ADMIN at route level

| Area | `ADMIN` | `SUPER_ADMIN` |
| --- | --- | --- |
| Permission-gated routes | Needs the action code | Passes without a check |
| Own profile and others' | Edits and reads only its own admin profile | Any admin's |
| `GET /admins` | Lists **all** admins (no scoping in the service), yet cannot open another admin | Same list, and can open any |
| Creating an admin | Not allowed | Allowed |
| Agreements | Sees and acts only on rows it created | Full view |
| `POST /sos/trigger` | Listed, and fails at the model | Not listed |
| `change-password` | Available | Not in the route list; recovery is also refused |
| Zone permanent delete | No | Yes |
| Permanent delete of notifications | Refused in the service | Allowed |
| Can be deleted | Yes, by another admin | Never |

### Other route asymmetries

| Area | Asymmetry | Owning page |
| --- | --- | --- |
| Permissions | Five enforced, nine not. A permission is needed to read the ingredient catalog but not to refund, finalize a payout, approve an account or change platform settings | [Authorization](../03-identity-access/authorization.md#admin-permissions) |
| Order powers | An admin can assign a rider and, for an in-transit order, work the delivery exceptions (replace the rider after an open SOS, complete manually with proof, fault-cancel with proof). There is still no general cancel, reject or status change | Section 8, [Delivery Exceptions and Verification](../03-orders/delivery-exceptions.md) |
| Refund and payout | Both run with no permission code, and neither has a list of what is waiting | Sections 9 and 10 |
| Payout creation | No admin route creates a payout | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md#payout-lifecycle) |
| Wallet | `GET /wallets/me` returns a hard-coded id for admins | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md#reading-wallets) |
| Categories and add-ons | Admin can create and edit but not delete a vendor's | [Products](../05-products/products.md#product-categories) |
| Vendor store | No admin route to open or close a store | [Vendors and Branches](../04-vendors/vendors-and-branches.md#store-openclose-and-timezone) |
| Fleet link | Assign only, never change | [Onboarding Journey](./onboarding-journey.md#delivery-partner) |
| Reads of customers | `GET /customers/:customerId` is effectively admin-only, though vendors, riders and fleet managers are on the route | [Customer Addresses](../03-identity-access/customer-addresses.md#what-reads-these-values) |
| Product approval | Post-hoc, and reversible by the vendor through the status route | [Products](../05-products/products.md#approval-status-and-deletion) |
| Account recovery | No unblock route | Section 4 |
| Realtime | SOS status goes only to the SOS monitoring room and the alert owner; support rooms have no ownership check; sockets do not recheck blocked state | [SOS](../02-platform/sos.md#socketio), [Support](../02-platform/support.md#socketio-events) |
| Search and notifications | `POST /search/reindex` and `POST /test/send-notification` are open to any admin | [Menus](../05-products/menus.md#search-and-the-meilisearch-index) |

---

## Unresolved and ambiguous points

- **Client behavior.** How an admin finds work (pending approvals, escalated orders, refunds
  owed, pending payouts) is not defined by the backend. There is no dedicated queue route for
  any of them.
- **Permission design.** Whether the nine unenforced codes should gate routes is not stated.
  The unguarded permission-assign route is read from code, and its consequence is **Inferred**.
- **Order powers.** Whether an admin should also be able to cancel or reject an order outside
  the in-transit exception cases is not stated; today only rider assignment and the
  [delivery exception](../03-orders/delivery-exceptions.md) actions exist.
- **Refund eligibility** after a customer cancels post-acceptance is not stated.
- **Unblocking.** Whether an admin submitting on a blocked party's behalf is the intended path is
  not stated.
- **Payouts.** Whether an admin should be able to create or reject a payout is not stated;
  neither exists.
- **Hard-coded wallet.** Whether the admin wallet id matches production data is unknown.
- **Admin SOS.** Whether an admin should raise alerts is not stated; the role is listed and the
  trigger fails.
- **Agreement visibility.** Whether per-creator filtering is intended is not stated.

---

## Related documentation

- [User Panel Flows Overview](./overview.md), [Onboarding Journey](./onboarding-journey.md), [Order Journey](./order-journey.md): the shared layer.
- [Customer Panel](./customer-panel.md), [Vendor Panel](./vendor-panel.md), [Delivery Partner Panel](./delivery-partner-panel.md), [Fleet Manager Panel](./fleet-manager-panel.md): the roles an admin governs.
- [Authorization](../03-identity-access/authorization.md) and [User Lifecycle](../03-identity-access/user-lifecycle.md): permissions, approval and account states.
- [Platform Settings](../02-platform/platform-settings.md), [Agreements](../07-agreements/agreements.md), [Activity Logs](../12-activity-logs/activity-logs.md), [Analytics](../02-platform/analytics.md): configuration, legal and audit.
- [Cancellations, Refunds and Settlement](../03-orders/cancellations-refunds-settlement.md), [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md), [Delivery Dispatch](../03-orders/delivery-dispatch.md): money and intervention.
