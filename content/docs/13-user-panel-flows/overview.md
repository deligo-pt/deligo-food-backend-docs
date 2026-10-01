---
title: User Panel Flows Overview
description: "What the user-panel flow layer covers, how the seven roles map to what the backend lets them do, a route-level capability matrix, and which flows are shared between roles and which belong to one role."
order: 1
---

# User Panel Flows Overview

The technical pages document one module at a time. This layer follows **a person
through the system**: what a customer, vendor, branch, rider, fleet manager or
admin goes through from sign-up to a finished order, and where those journeys
cross. It does not repeat the rules of each module; every step links to the page
that owns them.

Paths are relative to `src/app/`. Statements come from the committed backend code.
Route role lists were read from every `auth(...)` call and then checked against a
snapshot of the committed tree. Behavior read from code but not run is marked
**Inferred**. Uncommitted working-tree features are not described.

---

## What this layer is, and is not

| It is | It is not |
| --- | --- |
| An end-to-end view of cross-role journeys, built from routes, services and state changes | A description of screens, buttons or client behavior. The backend has no concept of a "panel" |
| A role-by-role view of what the API allows at route level | A full permission model. Service-level rules narrow the matrix and are on the technical pages |
| A set of links into the authoritative technical pages | A second copy of those pages |

**"Panel" here means the set of routes the backend lets one role call.** Which
client application hosts a role, and what its screens look like, is not
determined by the backend and is not documented here. Where a journey depends on
client behavior (for example, which screen starts payment), the page says so
instead of assuming.

### Pages in this layer

| Page | Covers |
| --- | --- |
| This overview | Roles, the capability matrix, shared and role-specific flows |
| [Onboarding Journey](./onboarding-journey.md) | Account creation, verification, approval, correction, rejection and the agreement gate, for all seven roles |
| [Order Journey](./order-journey.md) | One order from cart to settlement and rating, across the customer, vendor, rider, fleet manager and admin |

---

## The seven roles

| Role | How the account comes to exist | Signs in with | Approval | Agreement | Data it owns or is scoped to |
| --- | --- | --- | --- | --- | --- |
| `CUSTOMER` | Created on the first `login-customer` or `social-login` call; never registered explicitly | Email or phone OTP, or Google/Facebook token | `APPROVED` at creation | None | Own cart, orders, addresses, saved cards, points |
| `VENDOR` | `POST /auth/register`, or onboarded by an admin | Email and password | Admin approval | **Required** (vendor agreement) | Own products, offers, orders, wallet and branches |
| `SUB_VENDOR` | Onboarded only, by its parent vendor or by an admin | Email and password | Admin approval | None of its own; covered by the parent's | Own orders, products and wallet (a parent does not see them) |
| `DELIVERY_PARTNER` | `POST /auth/register`, or onboarded by a fleet manager or admin | Email and password | Admin approval | None | Own assignments, availability, wallet and points |
| `FLEET_MANAGER` | `POST /auth/register`, or onboarded by an admin | Email and password | Admin approval | **Required** (fleet manager agreement) | The riders it manages; their orders in the list view |
| `ADMIN` | Onboarded by a `SUPER_ADMIN` | Email and password | Admin approval | None | Back-office routes; five of the admin permission codes are enforced |
| `SUPER_ADMIN` | Seeded once from environment configuration | Email and password | `APPROVED` at seed | None | Everything an admin can reach, with no permission check |

The account model behind this table is in [Authentication](../03-identity-access/authentication.md)
and [User Lifecycle](../03-identity-access/user-lifecycle.md). Who the
agreement applies to is on [Agreement Gate and Party Resolution](../07-agreements/agreement-gate.md#short-answers).

---

## Capability matrix (route level)

### How to read it

- **Y** means the route's `auth(...)` list contains the role. **—** means it does not.
- **Y†** means the role is listed but an `ADMIN` must also hold a permission code
  (a `SUPER_ADMIN` passes without it). Only five codes are enforced; see
  [Authorization](../03-identity-access/authorization.md#admin-permissions).
- The matrix is **route level only.** A service can still refuse a listed role: it
  may require an `APPROVED` profile, ownership, a parent/branch or fleet
  relationship, or a specific order state. Those rules are on the linked page.
- On top of the matrix, an approved vendor, branch or fleet manager with an
  unsigned effective agreement is blocked on every write and on every `/orders`
  route. See [Agreement and access consequences](./onboarding-journey.md#agreement-gate-and-access-consequences).

Columns: **C** customer, **V** vendor, **SV** sub-vendor, **DP** delivery partner,
**FM** fleet manager, **A** admin, **SA** super admin.

### Account and access

| Capability | C | V | SV | DP | FM | A | SA | Notes and owning page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Register or sign in | OTP / social | Pwd | Pwd | Pwd | Pwd | Pwd | Pwd | `register` accepts only `VENDOR`, `DELIVERY_PARTNER`, `FLEET_MANAGER`. [Authentication](../03-identity-access/authentication.md#authentication-methods) |
| Read own profile `GET /profile` | Y | Y | — | Y | Y | Y | Y | A branch is not in the route list, although the service has a branch case |
| Change own email or contact number (`/profile/*`) | Y | Y | Y | Y | Y | Y | Y | OTP-confirmed |
| Submit an account for approval | — | Y | Y | Y | Y | Y | Y | Own account; a vendor for its branch; a fleet manager for its riders; admins for anyone. [User Lifecycle](../03-identity-access/user-lifecycle.md#submit-for-approval) |
| Approve, reject or block; request corrections | — | — | — | — | — | Y | Y | [User Lifecycle](../03-identity-access/user-lifecycle.md#approval-rejection-and-blocking) |
| Confirm a correction request | — | Y | Y | Y | Y | — | — | Owner only. [Onboarding Journey](./onboarding-journey.md#approval-rejection-correction-and-blocking) |
| Onboard another account (`register/onboard`) | — | Y | — | — | Y | Y | Y | Which target roles each caller may create is only partly enforced. [Authorization](../03-identity-access/authorization.md#onboarding-authorization) |
| Read and sign own agreement | — | Y | — | — | Y | Y† | Y | An admin acts only on rows it created. [Agreements](../07-agreements/agreements.md#endpoints-and-who-may-call-them) |
| Soft-delete an account | Y | Y | Y | Y | Y | Y | Y | A non-admin may delete only its own account. A parent vendor cannot delete a branch and a fleet manager cannot delete a rider |
| Upload a file `POST /uploads` | Y | Y | — | Y | Y | Y | Y | A branch is not in the route list |
| Read own notifications | Y | Y | Y | Y | Y | Y | Y | [Notifications](../06-notifications/notifications.md) |

### Customer side of ordering

| Capability | C | V | SV | DP | FM | A | SA | Notes and owning page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Browse products and search | Y | Y | Y | Y | Y | Y | Y | Public variants exist for `GET /products/open` and `GET /search`. [Products](../05-products/products.md) |
| Discover vendors `GET /vendors/customer` | Y | — | — | — | — | — | — | [Vendors and Branches](../04-vendors/vendors-and-branches.md#customer-vendor-discovery) |
| Delivery addresses and live location | Y | — | — | — | — | — | — | [Customer Addresses](../03-identity-access/customer-addresses.md) |
| Cart add, toggle, clear | Y | — | — | — | — | — | — | Admins can only read carts. [Cart](../08-cart/cart.md) |
| Checkout, apply an offer, pay | Y | — | — | — | — | — | — | [Checkout and Order Creation](../03-orders/checkout-and-order-creation.md), [Payments](../10-payments/payments.md) |
| Saved cards | Y | — | — | — | — | — | — | [Saved Cards](../10-payments/saved-cards.md) |
| Create order, cancel, reorder | Y | — | — | — | — | — | — | [Order Lifecycle](../03-orders/order-lifecycle.md) |
| Rate products and the rider | Y | — | — | — | — | — | — | [Ratings](../11-ratings/ratings.md) |
| Read points | Y | — | — | Y | — | — | — | [Points and Referrals](../09-offers-and-coupons/points-and-referrals.md) |
| Read referrals | Y | Y | — | Y | — | — | — | Same page |

### Handling an order

| Capability | C | V | SV | DP | FM | A | SA | Notes and owning page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Accept, reject, cancel, mark ready or no-show; verify pickup code; broadcast to riders | — | Y | Y | — | — | — | — | Only for orders the row itself owns. [Order Lifecycle](../03-orders/order-lifecycle.md#role-based-actions) |
| Accept or reject a dispatch offer | — | — | — | Y | — | — | — | [Delivery Dispatch](../03-orders/delivery-dispatch.md#rider-response) |
| Pick up, on the way, delivered, hand back | — | — | — | Y | — | — | — | Same page |
| Go online or offline; send live location | — | — | — | Y | — | — | — | [Delivery Dispatch](../03-orders/delivery-dispatch.md#rider-state) |
| List nearby riders and assign one | — | — | — | — | — | Y† | Y | `CAN_MANAGE_ORDERS`. [Delivery Dispatch](../03-orders/delivery-dispatch.md#admin-tools) |
| List orders `GET /orders` | Y | Y | Y | Y | Y | Y | Y | Scoped per role. A fleet manager sees only its riders' orders. [Order Tracking](../03-orders/order-tracking-and-realtime.md#role-scoping) |
| Read one order `GET /orders/:id` | Y | Y | Y | Y | — | Y | Y | A fleet manager is not in the route list |
| Download the invoice PDF | Y | Y | Y | — | — | Y | Y | After the invoice is synced |
| Refund a rejected or canceled order | — | — | — | — | — | Y | Y | No permission code is required. [Cancellations, Refunds and Settlement](../03-orders/cancellations-refunds-settlement.md#refunds) |

### Vendor operations

| Capability | C | V | SV | DP | FM | A | SA | Notes and owning page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Open or close the store | — | Y | Y | — | — | — | — | Own row only. [Vendors and Branches](../04-vendors/vendors-and-branches.md#store-openclose-and-timezone) |
| Create products, categories and add-on groups | — | Y | Y | — | — | — | — | Admins use separate `admin/create-…` routes. [Products](../05-products/products.md) |
| Copy products to branches | — | Y | — | — | — | Y | Y | A branch cannot copy |
| Manage offers | — | Y | Y | — | — | Y | Y | [Offers](../09-offers-and-coupons/offers.md) |
| Read ingredient catalog; buy ingredients | — | Y | Y | — | — | Y† | Y | Buying (`ingredients-order/create-order`) is vendor and branch only. [Ingredient Purchasing](../04-vendors/ingredient-purchasing.md) |
| Vendor analytics | — | Y | Y | — | — | — | — | [Analytics](../02-platform/analytics.md) |

### Money

| Capability | C | V | SV | DP | FM | A | SA | Notes and owning page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Read own wallet `GET /wallets/me` | — | Y | Y | Y | Y | Y | Y | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md) |
| List all wallets | — | — | — | — | Y | Y | Y | A fleet manager gets only its riders' wallets |
| Request a payout | — | — | — | — | Y | — | — | The request currently fails schema validation. [Payouts](../10-payments/payouts-wallets-transactions.md#manual-request-post-payoutsinitiate-settlement) |
| Finalize a payout | — | — | — | — | Y | Y | Y | Same page |
| Read payouts | — | Y | Y | Y | Y | Y | Y | Scoped per role |
| Read transactions | Y | Y | Y | Y | Y | Y | Y | Non-admins see their own rows |

### Support and safety

| Capability | C | V | SV | DP | FM | A | SA | Notes and owning page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Send a support message; read a thread | Y | Y | — | Y | Y | Y | Y | A branch can list tickets but not send or read messages. [Support](../02-platform/support.md) |
| List support tickets | Y | Y | Y | Y | Y | Y | Y | Same page |
| Close a ticket | — | — | — | — | — | Y | Y | Same page |
| Raise an SOS alert | — | Y | Y | Y | Y | Y | — | A `SUPER_ADMIN` is not in the list, and an `ADMIN` alert fails at the model. [SOS](../02-platform/sos.md) |

### Platform operations

| Capability | C | V | SV | DP | FM | A | SA | Notes and owning page |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Global settings, zones, tax and commission writes, categories | — | — | — | — | — | Y | Y | Any admin; no permission code. [Platform Settings](../02-platform/platform-settings.md) |
| Read taxes | — | Y | Y | — | — | Y | Y | Writes are admin only |
| Agreement versions | — | — | — | — | — | Y† | Y | `CAN_MANAGE_AGREEMENTS`. [Agreements](../07-agreements/agreements.md#versioning-and-publishing) |
| Permissions and activity logs | — | — | — | — | — | Y† | Y | `CAN_MANAGE_PERMISSIONS`, `CAN_MANAGE_ACTIVITY_LOGS`. [Activity Logs](../12-activity-logs/activity-logs.md) |
| List riders | — | — | — | — | Y | Y | Y | A fleet manager sees its own riders |
| Assign a rider to a fleet manager | — | — | — | — | — | Y | Y | [Onboarding Journey](./onboarding-journey.md#delivery-partner) |
| List customers | — | — | — | — | — | Y | Y | `GET /customers/:id` is open to V, DP, FM, A, SA |
| Broadcast notifications | — | — | — | — | — | Y | Y | [Notifications](../06-notifications/notifications.md) |
| Analytics | — | Y | Y | Y | Y | Y | Y | Each role has its own endpoints (vendor and branch, rider earnings, fleet manager); admins have the report set. [Analytics](../02-platform/analytics.md) |
| Sponsorships (read) | Y | — | — | — | — | Y | Y | Writes are admin only. [Sponsorships](../02-platform/sponsorships.md) |

### What the matrix says about each role

- **A branch is not a smaller vendor at route level.** It is missing from
  `GET /profile`, `/uploads`, the agreement routes, support send and read,
  referrals and `copy-to-sub-vendors`. It can read its own profile through
  `GET /vendors/:vendorId`.
- **A fleet manager has no order-handling route.** It sees orders in the list,
  scoped to its riders, but cannot open one order, and no order notification
  targets it. Its stake in an order is the wallet credit at settlement.
- **A rider cannot raise `READY_FOR_PICKUP`.** Only the vendor (pickup orders) or
  the auto-ready cron does.
- **Any admin reaches most back-office routes.** Nine of the fourteen permission
  codes are never checked.
- **Customers have no onboarding steps beyond the first login**, and no
  agreement or approval.

---

## Shared flows and role-specific flows

### Shared flows

These look the same for several or all roles. Each is documented once on a
technical page.

| Flow | Roles | Where |
| --- | --- | --- |
| Token, device session, refresh and logout | All seven | [Authentication](../03-identity-access/authentication.md) |
| Password change and recovery | All but customers (recovery also excludes `SUPER_ADMIN`) | [Authentication](../03-identity-access/authentication.md#flow-forgot--reset-password) |
| Account approval and correction | `VENDOR`, `SUB_VENDOR`, `DELIVERY_PARTNER`, `FLEET_MANAGER`, `ADMIN` | [Onboarding Journey](./onboarding-journey.md) |
| Notification inbox, push token | All seven | [Notifications](../06-notifications/notifications.md) |
| Support chat | `CUSTOMER`, `VENDOR`, `DELIVERY_PARTNER`, `FLEET_MANAGER`, admins | [Support](../02-platform/support.md) |
| Wallet, payouts and transactions | Vendor, branch, rider, fleet manager, admins | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md) |
| An order across panels | Customer, vendor or branch, rider, admin (and a fleet manager read-only) | [Order Journey](./order-journey.md) |

### Role-specific flows

| Role | Flows that belong to it | Where they are documented today |
| --- | --- | --- |
| `CUSTOMER` | Addresses and live location; cart; checkout and payment; saved cards; cancel and reorder; rating; points and referrals | [Customer Addresses](../03-identity-access/customer-addresses.md), [Cart](../08-cart/cart.md), [Checkout and Order Creation](../03-orders/checkout-and-order-creation.md), [Payments](../10-payments/payments.md), [Ratings](../11-ratings/ratings.md), [Points and Referrals](../09-offers-and-coupons/points-and-referrals.md) |
| `VENDOR` | Profile and documents; agreement signing; store schedule; products and menus; offers; incoming orders; ingredient purchasing; branches | [Vendors and Branches](../04-vendors/vendors-and-branches.md), [Agreements](../07-agreements/agreements.md), [Products](../05-products/products.md), [Menus](../05-products/menus.md), [Offers](../09-offers-and-coupons/offers.md), [Ingredient Purchasing](../04-vendors/ingredient-purchasing.md) |
| `SUB_VENDOR` | The same operating flows on its own row; nothing agreement-related of its own | [Vendors and Branches](../04-vendors/vendors-and-branches.md#parentbranch-permissions) |
| `DELIVERY_PARTNER` | Going online; dispatch offers; delivery steps; live location; points | [Delivery Dispatch](../03-orders/delivery-dispatch.md), [Order Tracking](../03-orders/order-tracking-and-realtime.md#rider-live-location) |
| `FLEET_MANAGER` | Onboarding its riders; payouts for its riders and itself; fleet analytics | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md), [Analytics](../02-platform/analytics.md) |
| `ADMIN` / `SUPER_ADMIN` | Approvals; settings, zones, taxes and commissions; agreement versions; permissions; refunds; manual dispatch; broadcasts; reports | [Platform Settings](../02-platform/platform-settings.md), [Agreements](../07-agreements/agreements.md), [Cancellations, Refunds and Settlement](../03-orders/cancellations-refunds-settlement.md), [Activity Logs](../12-activity-logs/activity-logs.md) |

This layer has only the two cross-role journeys so far. The role-specific rows
above point at the technical pages that already cover them; there are no
role-by-role panel pages yet.

---

## Open points that affect every journey

These are carried through the journey pages instead of being resolved by
assumption.

- **No panel concept in the backend.** Route lists are the only role boundary the
  code expresses. Anything about screens or client apps is outside this layer.
- **Approval does not lock down much by itself.** Password login needs a verified
  email, not an approved status. Individual services add `APPROVED` checks, but
  the check is not applied uniformly (for example the rider online/offline route
  does not check the rider's status, and checkout does not check the vendor's).
- **Route-level exclusions may not be deliberate.** The omission of a branch from
  `GET /profile`, `/uploads` and the support message routes, and of a fleet
  manager from `GET /orders/:id`, is read from the route lists. The code does not
  say whether each is intended.
- **Admin permission codes are mostly decorative.** Only five are enforced.
- **The agreement gate's exempt paths mostly do not match**, so the effect on a
  blocked vendor or fleet manager of logout, password change and push-token
  registration is **Inferred**, not reproduced. See
  [the gate page](../07-agreements/agreement-gate.md#the-exemption-check-does-not-match-as-documented).

---

## Related documentation

- [Onboarding Journey](./onboarding-journey.md) and [Order Journey](./order-journey.md): the two journeys in this layer.
- [System Overview](../01-introduction/overview.md): the roles and the end-to-end order flow at a glance.
- [Authorization](../03-identity-access/authorization.md): role gates, admin permissions and service-level rules behind the matrix.
- [User Lifecycle](../03-identity-access/user-lifecycle.md): account states and transitions.
- [Notification Flow](../02-platform/notification-flow.md): every push, email and socket event by trigger.
