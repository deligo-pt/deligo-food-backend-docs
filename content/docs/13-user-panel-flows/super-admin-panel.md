---
title: Super Admin Panel
description: "How the super admin differs from an admin: the permission checks it skips, the only account that can onboard admins, which permanent deletes and zone actions are its alone, its notification and password restrictions, the SOS gap, and the other route-level and service-level differences."
order: 10
---

# Super Admin Panel

This is a **delta page**. A `SUPER_ADMIN` shares every admin route, so everything in
[Admin Panel](./admin-panel.md) applies to it unchanged. This page covers only where the two
roles differ. Read the admin page first for the shared behavior: user governance, catalog,
orders, refunds, payouts, settings, agreements, broadcast, support, SOS, logs and analytics.

Paths are relative to `src/app/`. Statements come from the committed backend code. Route role
lists were compared across every `auth(...)` call. Behavior read from code but not run is
marked **Inferred**. Uncommitted working-tree features are not described. The backend has no
concept of a panel or a screen, so this page says nothing about how a client presents these
routes.

---

## 1. Differences from ADMIN

### At route level

Comparing the role lists of every route, only **three** routes differ between the two roles:

| Route | `ADMIN` | `SUPER_ADMIN` |
| --- | --- | --- |
| `DELETE /zones/:zoneId/permanent-delete` | Not listed | **Listed** (the only route that lists the super admin alone) |
| `POST /auth/change-password` | Listed | **Not listed** |
| `POST /sos/trigger` | Listed (and fails at the model) | **Not listed** |

Every other route that lists one lists the other, including all 37 routes that carry a
permission array.

### In the services

| Area | `ADMIN` | `SUPER_ADMIN` | Section |
| --- | --- | --- | --- |
| Permission-gated routes | Must hold the action code | Skips the check | 2 |
| Admin profiles | Reads and edits only its own | Any admin's | 3 |
| Creating an admin | Refused | The only role that can | 3 |
| Agreements | Sees, edits and signs only rows it created | Full view | 8 |
| Notifications | Own rows only | Soft-delete queries without a receiver limit; the only role allowed to permanently delete | 6 |
| Password recovery | Available | Refused | 7 |
| Being deleted | Can be soft-deleted by another admin | Can never be deleted | 4 |
| Existence | Many accounts | Seeded once from environment configuration | 3 |

---

## 2. Permission-check behavior

The permission block in `auth()` runs only when the token's role is `ADMIN` and the route lists
permissions. A `SUPER_ADMIN` passes the role list and then **skips the permission check
entirely**. See
[Authorization](../03-identity-access/authorization.md#the-auth-middleware-as-the-primary-gate).

| Permission code | Routes it gates for an `ADMIN` | For a `SUPER_ADMIN` |
| --- | --- | --- |
| `CAN_MANAGE_PERMISSIONS` | `/permissions/*` | Not needed |
| `CAN_MANAGE_AGREEMENTS` | `/agreements/*` (except `GET /current`), `/agreement-versions/*` | Not needed |
| `CAN_MANAGE_INGREDIENTS` | `/ingredients/*`, including the reads | Not needed |
| `CAN_MANAGE_ACTIVITY_LOGS` | `/activity-logs/*` | Not needed |
| `CAN_MANAGE_ORDERS` | `GET /orders/:orderId/nearby-partners`, `PATCH /orders/:orderId/assign-partner`, and the delivery-exception admin routes (`GET /orders/delivery-exceptions`, `.../delivery-exception/acknowledge` and `resolve`, `.../delivery-otp/reset`, `.../replace-partner`, `.../request-receipt-confirmation`, `.../complete-delivery`, `.../fault-cancel`) | Not needed |

Consequences:

- **A super admin never needs a permission.** The permission list on its profile is irrelevant
  to access, and the nine unenforced codes are irrelevant to it for the same reason.
- **A super admin is the only role whose access to these five areas cannot be revoked** through
  the permission routes (**Inferred**: revoking removes strings from a list that the super admin
  is never checked against).
- **The permission routes can target a super admin's profile.** The assign and revoke services
  look up any admin by `userId` with no guard on the target (read from the code), so the list can
  be edited for a `SUPER_ADMIN` though it has no effect.

---

## 3. Admin onboarding and the account itself

| Topic | Behavior | Owning page |
| --- | --- | --- |
| Creating an admin | `POST /auth/register/onboard` with role `ADMIN` is enforced as **`SUPER_ADMIN` only**. The super admin chooses the initial password; the new admin verifies by email, submits, and is approved by someone other than itself | [Onboarding Journey](./onboarding-journey.md#admin-and-super-admin) |
| Creating another super admin | **No route.** The onboarding role enum excludes `SUPER_ADMIN` | [Authorization](../03-identity-access/authorization.md#onboarding-authorization) |
| How it exists | Seeded at server start from environment configuration, as `APPROVED` with a verified email and contact number, if no super admin exists | [Onboarding Journey](./onboarding-journey.md#admin-and-super-admin) |
| Environment sync | On later starts, if the configured email, contact number or password differs from the stored one, the stored value is **overwritten**. A password changed any other way would be replaced at the next start while the environment value differs | Same page |
| Reading and editing admin profiles | `GET /admins/:adminId`, `PATCH /admins/:adminId`, `PATCH /admins/:adminId/docImage` for any admin. An `ADMIN` is limited to itself | [Authorization](../03-identity-access/authorization.md#super_admin-vs-admin) |
| Profile lock | `updateAdmin` refuses **any** caller, a super admin included, while the target is locked. The document-image upload refuses only an `ADMIN` | [Authorization](../03-identity-access/authorization.md#super_admin-vs-admin) |
| Approving an admin | Any other admin or the super admin can approve; nobody can change their own status | [User Lifecycle](../03-identity-access/user-lifecycle.md#approval-rejection-and-blocking) |
| Being the platform account | Settlement credits the platform wallet of the super admin found by role, and automatic payouts are sent from it | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md#how-wallets-are-created-and-credited) |

One asymmetry in the other direction: **`GET /admins` has no scoping**, so any `ADMIN` lists
every admin, the super admin included, although it cannot open another admin's profile.

---

## 4. Permanent-delete capabilities

A permanent delete is not mostly a super-admin power. Only two are:

| Permanent delete | `ADMIN` | `SUPER_ADMIN` | Notes |
| --- | --- | --- | --- |
| Zone, `DELETE /zones/:zoneId/permanent-delete` | No (route) | **Yes** | Needs a prior soft delete and no references. See section 5 |
| Notifications, three `permanent-delete` routes | Refused in the service | **Yes** | The routes list all seven roles; the service refuses everyone but the super admin, and the "all" form removes every soft-deleted row platform-wide |
| User account, `DELETE /auth/permanent-delete/:userId` | Yes | Yes | The target must already be soft-deleted; the caller must be `APPROVED`. A super admin is never a valid target |
| Product | Yes | Yes | After a soft delete |
| Taxes, business categories, cuisines, restricted items, sponsorships | Yes | Yes | After a soft delete |
| Offers | Yes | Yes | Admin roles only in the service; a vendor reaches it and is refused |
| Ingredients | Yes, with `CAN_MANAGE_INGREDIENTS` | Yes, without it | After a soft delete |
| Vendor categories | No | No | Owner-only routes |

Owning pages: [Platform Settings](../02-platform/platform-settings.md),
[Notifications](../06-notifications/notifications.md#in-app-notification-apis),
[User Lifecycle](../03-identity-access/user-lifecycle.md#permanent-delete),
[Products](../05-products/products.md#approval-status-and-deletion).

**A super admin cannot be soft-deleted or permanently deleted** (`CANNOT_DELETE_SUPER_ADMIN`),
by anyone.

---

## 5. Zone management

| Task | `ADMIN` | `SUPER_ADMIN` |
| --- | --- | --- |
| Create, validate a boundary, read, update, toggle, soft-delete, restore | Yes | Yes |
| Permanent delete | No | **Yes**, after a soft delete and only if no rider, customer address or sponsorship references the zone |
| Public lookup `GET /zones/check-point` | Open to everyone | Open to everyone |

The zone rules, the overlap check and the delete guard are on
[Platform Settings](../02-platform/platform-settings.md#zones). Zones are stored but not used for
dispatch or delivery pricing; only sponsorship audiences read them. The delete guard's customer
check cannot match in practice, because no route can set an address `zoneId`.

---

## 6. Broadcast and communication privileges

**Sending is identical.** `POST /notifications/broadcast`, `POST /test/send-notification` and the
support agent routes list both roles, and the broadcast rules are on
[Notifications](../06-notifications/notifications.md#admin-broadcast). The super admin has no extra
way to send.

The differences are all in the notification inbox:

| Operation | `ADMIN` | `SUPER_ADMIN` |
| --- | --- | --- |
| `GET /notifications/my-notifications` | Own rows | Own rows |
| `GET /notifications/all` | Every notification, with an optional receiver filter | Same |
| Soft-delete one, several, or all | Own rows only | **No receiver restriction.** `soft-delete-all` soft-deletes **every user's** notifications |
| Permanent delete (all three forms) | Refused (`403`) | Allowed; only rows already soft-deleted are removed, and the "all" form removes every soft-deleted row platform-wide |
| Mark read | Own rows | Own rows |

So the only role that can erase other users' notifications, or remove the stored records
permanently, is the super admin. There is no confirmation step in the routes.

---

## 7. Password and SOS restrictions

### Password

| Flow | `ADMIN` | `SUPER_ADMIN` |
| --- | --- | --- |
| `POST /auth/change-password` | In the route list | **Not in the route list** |
| `POST /auth/forgot-password` | Allowed | Refused (`SUPER_ADMIN_PASSWORD_RESET_DENIED`) |
| `POST /auth/reset-password` | Allowed (with a valid token) | No token can be issued for it |

The super admin's password is set by the environment and re-applied at server start when it
differs (section 3). No route changes it. See
[Authentication](../03-identity-access/authentication.md#flow-forgot--reset-password).

### SOS

| Capability | `ADMIN` | `SUPER_ADMIN` |
| --- | --- | --- |
| `POST /sos/trigger` | Listed, but **Executed** at the earlier HEAD: the alert fails model validation, so an admin cannot raise one (the model's sender list is unchanged at the current HEAD) | Not listed |
| Monitor (`join-sos-monitoring`, `GET /sos`, `GET /sos/stats`, `GET /sos/user/:id`, `GET /sos/:id`) | Yes. Joining also subscribes to the delivery-exception admin room | Yes, the same |
| Change a status (`PATCH /sos/:id/status`) | Yes | Yes |
| `GET /sos/nearby` | Needs its own stored location | Needs its own stored location |

**Net effect:** neither admin role can raise an SOS alert. For `GET /sos/nearby`, the caller's
`currentSessionLocation` must exist. The admin profile update derives it from `address`
coordinates, and the super admin seed creates none, so a freshly seeded super admin gets a
`400` until it saves an address with coordinates (read from the code, not run). See
[SOS](../02-platform/sos.md#triggering).

---

## 8. Other route-level and service-level differences

| Area | Difference | Owning page |
| --- | --- | --- |
| Agreement visibility | Only a super admin has a full view of agreements. An admin sees, reads, edits and signs only rows it created, so rows created by a party or by the auth gate are outside a non-super admin's view | [Agreements](../07-agreements/agreements.md#endpoints-and-who-may-call-them) |
| Activity logs | An `ADMIN` needs `CAN_MANAGE_ACTIVITY_LOGS`; a super admin does not | [Activity Logs](../12-activity-logs/activity-logs.md#reading-the-log) |
| Order intervention | An `ADMIN` needs `CAN_MANAGE_ORDERS` for `nearby-partners`, `assign-partner` and the delivery-exception routes. Escalation pushes reach both roles, and an `ADMIN`'s manual delivery completion also notifies every `SUPER_ADMIN` | [Delivery Dispatch](../03-orders/delivery-dispatch.md#admin-tools), [Delivery Exceptions and Verification](../03-orders/delivery-exceptions.md) |
| Wallet | `GET /wallets/me` returns the **hard-coded** wallet id for both admin roles, not the caller's. The settlement worker credits the platform wallet of the super admin it finds by role, so the two match only if that account's `_id` equals the hard-coded value | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md#reading-wallets) |
| Payouts | Automatic payouts are created only if a super admin exists, because the sender is that account (**Executed:** without one the create fails). Finalizing an automatic payout debits the super admin's wallet | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md#automatic-payouts) |
| Status changes targeting it | `approved-rejected-user` has no guard on the target's role. Only soft and permanent delete refuse a super admin. **Inferred:** an `ADMIN` could block a super admin, after which `auth()` would refuse every request from it. Not run | [User Lifecycle](../03-identity-access/user-lifecycle.md#approval-rejection-and-blocking) |
| Correction requests | A super admin is not an eligible target, as with every non-profile role | [Onboarding Journey](./onboarding-journey.md#correction-requests) |
| Sessions | The same per-device sessions and socket rules as any account; a blocked account's open socket is not re-checked | [Authentication](../03-identity-access/authentication.md) |
| Agreement gate | A super admin is never gated, like an admin | [Agreement Gate](../07-agreements/agreement-gate.md#short-answers) |

---

## Unresolved and ambiguous points

- **Why only three routes differ.** Whether the super admin is meant to be distinguished by
  more than the permission bypass and a few services is not stated.
- **Change-password.** Whether the super admin's absence from the route is deliberate is not
  stated; with recovery also refused, only the environment changes its password.
- **Protecting the super admin.** The code protects it from deletion but not from a status
  change by an admin; whether that is intended is not stated. The blocking consequence is
  **Inferred**.
- **Notification clean-up.** That a super admin's `soft-delete-all` affects every user is read
  from the code; whether it is intended is not stated.
- **Platform wallet.** Whether the hard-coded wallet id matches the seeded super admin in a given
  environment is unknown.
- **No second super admin.** The code has no route to create one, and what happens if the seeded
  account is lost is not described.
- **SOS.** Whether either admin role should raise alerts is not stated.
- **Newer SOS routes.** The delivery-exception routes are documented in [Delivery Exceptions and Verification](../03-orders/delivery-exceptions.md), and the SOS socket and notification behavior in [SOS](../02-platform/sos.md).
- **Agreement view.** Whether the per-creator filter for admins is intended is not stated.
- **Client behavior.** How a client distinguishes the super admin from an admin is not defined by
  the backend.

---

## Related documentation

- [Admin Panel](./admin-panel.md): the shared behavior this page is a delta of.
- [User Panel Flows Overview](./overview.md), [Onboarding Journey](./onboarding-journey.md): the shared layer.
- [Authorization](../03-identity-access/authorization.md): permissions and the `SUPER_ADMIN` versus `ADMIN` rules.
- [Platform Settings](../02-platform/platform-settings.md), [Notifications](../06-notifications/notifications.md), [Agreements](../07-agreements/agreements.md): zones, inbox operations and agreement visibility.
- [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md), [SOS](../02-platform/sos.md): the platform wallet and the SOS gap.
