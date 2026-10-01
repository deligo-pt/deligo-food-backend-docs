---
title: Sub-Vendor Panel
description: "How the branch role differs from its parent vendor: the relationship, the routes a branch lacks, how its access depends on the parent's agreement, what is scoped to the branch, and the support, referral, upload, deletion and approval restrictions that follow."
order: 9
---

# Sub-Vendor Panel

This is a **delta page**. A branch (`SUB_VENDOR`) is a vendor row with a parent, so almost
everything in [Vendor Panel](./vendor-panel.md) applies to it unchanged. This page covers
only what is different. Read the vendor page first for the shared behavior: catalog, orders,
store state, earnings, notifications and the vendor's workflows.

Paths are relative to `src/app/`. Statements come from the committed backend code. Route
role lists were compared across every `auth(...)` call. Behavior read from code but not run
is marked **Inferred**. Uncommitted working-tree features are not described. The backend has
no concept of a panel or a screen, so this page says nothing about how a client presents
these routes.

---

## 1. Relationship to the vendor

| Fact | Behavior | Owning page |
| --- | --- | --- |
| Storage | The same `Vendor` collection as the parent, with `role: SUB_VENDOR` and a `parentVendorId` | [Vendors and Branches](../04-vendors/vendors-and-branches.md#vendor-vs-sub_vendor) |
| Creation | Onboarded only, by its parent (for itself) or by an admin who sends the parent's `userId` as `parentVendorId`. It cannot register itself | [Onboarding Journey](./onboarding-journey.md#sub-vendor) |
| Inheritance | Business details, bank details and document references are **copied once** at creation and then diverge. Only the parent's brand fields stay linked (`businessName`, `businessType` and, since the latest backend commit, `companyLegalName`): a parent change is written to every non-deleted branch. The technical page still lists the first two only | [Vendors and Branches](../04-vendors/vendors-and-branches.md#what-a-new-branch-inherits) |
| Independence | Its own products, offers, orders, wallet, ratings, analytics and notifications. A parent does not see any of them | [Vendor Panel](./vendor-panel.md#5-order-responsibilities) |
| Brand fields | `businessName`, `businessType` and `companyLegalName` cannot be changed on a branch by anyone, including an admin | [Vendors and Branches](../04-vendors/vendors-and-branches.md#profile-updates-the-lock-and-correction-requests) |
| Status | Has its own `PENDING` → `SUBMITTED` → `APPROVED` path. The parent's status is never consulted | [Vendors and Branches](../04-vendors/vendors-and-branches.md#known-implementation-inconsistencies) |

---

## 2. Available capabilities

A branch can call **99 of the 115** routes a vendor can, which is every vendor route except
the sixteen listed in the next section. In practice it can do, on its own row, all of the
following; see the [Vendor Panel](./vendor-panel.md#3-main-capabilities) for the routes:

- Edit its profile and documents, and open or close its store.
- Create and manage products, categories, add-on groups and offers.
- Accept, reject, cancel, mark ready, verify pickup codes and broadcast its own orders.
- Read its ratings, analytics, wallet, payouts and transactions.
- Buy ingredients and read its ingredient orders.
- Raise an SOS and list its own SOS alerts.
- Submit itself for approval and confirm a correction request.
- Read its own notifications and login history.

---

## 3. Missing and restricted routes

These are the routes a vendor has and a branch does not (read from the route role lists):

| Route | Effect for a branch | Notes |
| --- | --- | --- |
| `GET /agreements/current`, `GET /agreements/:agreementId`, `GET` and `POST /agreements/party/:partyId`, `POST /agreements/:agreementId/sign`, `PATCH /agreements/:agreementId` | Cannot read, create, edit or sign any agreement | The parent signs for it. See section 4 |
| `GET /profile` | Cannot read its own profile through the shared route | It uses `GET /vendors/:vendorId` for itself. The profile service has a branch case that the route list makes unreachable |
| `POST /uploads` | Cannot upload files through the upload route | See below |
| `POST /support/send-message`, `GET /support/tickets/:ticketId/messages`, `PATCH /support/tickets/:ticketId/read` | Cannot write to support or read a thread | It can still list tickets. See section 6 |
| `GET /referrals/my-referrals` | No referral statistics | See section 6 |
| `POST /products/copy-to-sub-vendors` | Cannot copy products | Copy runs only from the parent or an admin |
| `POST /auth/register/onboard` | Cannot create any account | A branch has no branches |
| `DELETE /offers/permanent-delete/:offerId` | Not in the route list | A parent vendor reaches the service and is refused there; permanent offer deletion is admin-only either way |
| `GET /customers/:customerId` | Not on the route | Effectively admin-only for a vendor too, so this loses nothing in practice |

Consequences that are not obvious from the list:

- **A branch's product images cannot come from the upload route.** The product module
  accepts only an image URL, files go through `POST /uploads`, and that route excludes
  `SUB_VENDOR`. A branch that needs an image must obtain a URL some other way. Products copied
  from the parent already carry the parent's URL, which the copy shares. See
  [Products](../05-products/products.md#images-and-uploads).
- **Document images still work.** They use their own multipart routes under
  `/vendors/:vendorId/docImage`, which list the branch.
- **`POST /uploads` is also the route the signature upload needs**, but a branch never signs.

---

## 4. Agreement behavior

| Question | Answer | Owning page |
| --- | --- | --- |
| Does a branch have an agreement? | **No row of its own.** `getInitialAgreementTypeForRole('SUB_VENDOR')` is undefined | [Agreement Gate](../07-agreements/agreement-gate.md#vendor-parent-vendor-and-branch) |
| Whose agreement decides its access? | The **parent's.** `resolveAgreementPartyContext` resolves a branch to its parent | Same page |
| Does the gate apply? | Yes, once the **branch** is `APPROVED`: writes and every `/orders` route are blocked while the parent's effective agreement is unsigned. The parent's own status is not consulted | [Agreement Gate](../07-agreements/agreement-gate.md#the-gate-in-authts) |
| Can the branch fix it? | **No.** It cannot read or sign. The parent signs, and one signature restores every branch | [Agreement Gate](../07-agreements/agreement-gate.md#re-sign-when-a-new-version-takes-effect) |
| Submit and approve | No agreement precondition. An admin can approve a branch from any status, with no `SUBMITTED` step | [Onboarding Journey](./onboarding-journey.md#sub-vendor) |
| Customers | Discovery, cart add and checkout judge the branch by the parent's signed row | [Vendors and Branches](../04-vendors/vendors-and-branches.md#customer-vendor-discovery) |
| Profile hints | No `agreement` summary and no `resignRequired` on the branch profile; vendor endpoints add `coveredByAgreement` instead | [Agreement Gate](../07-agreements/agreement-gate.md#edge-cases) |
| Notified of a new version? | **No.** The publish job targets parties, never branches | [Agreements](../07-agreements/agreements.md#automation-worker-notifications-and-emails) |

Gate edge cases:

- A branch **without** a `parentVendorId` is never gated, never eligible for discovery, and
  refused at cart and checkout.
- A branch whose **parent is soft-deleted** is not gated (the parent lookup finds nothing),
  while the by-id signed check used by cart, checkout and discovery still reads the parent's
  rows.
- A branch whose **parent is blocked or rejected** keeps working while the parent's last signed
  row is valid.
- **A branch cannot learn why it is blocked from its own routes**: it receives
  `403 AGREEMENT_RESIGN_REQUIRED`, but it has no agreement route to open (**Inferred**: the
  parent must be told outside the API).

---

## 5. Product, order, wallet and offer scope

Every one of these is **per row**. A branch and its parent are as separate as two unrelated
vendors.

| Area | Scope | Owning page |
| --- | --- | --- |
| Products | Created, edited and deleted by the owning row. A parent cannot edit a branch's products, though it can list them with `GET /products?vendorId=` and copy its own to the branch. Copies share the source product's image URL | [Vendors and Branches](../04-vendors/vendors-and-branches.md#vendorproduct-relationship) |
| Categories and add-ons | Each belongs to one row, so a branch has its own | [Products](../05-products/products.md#product-categories) |
| Offers | A branch's offer applies only to that branch's checkouts. The parent's offers do not apply to the branch and the parent cannot edit the branch's | [Offers](../09-offers-and-coupons/offers.md#who-can-do-what) |
| Orders | A branch sees and acts only on orders whose `vendorId` is its own row. Its new-order push goes to the branch, not the parent | [Order Tracking and Realtime](../03-orders/order-tracking-and-realtime.md#role-scoping) |
| Wallet | Credited at settlement to the branch's own wallet; `GET /wallets/me` returns it, and 404s until the first credit | [Cancellations, Refunds and Settlement](../03-orders/cancellations-refunds-settlement.md#settlement) |
| Payouts | Same as a vendor: only the automatic run creates one, an admin finalizes it. The branch cannot request | [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md#automatic-payouts) |
| Analytics | Only the branch's own numbers | [Analytics](../02-platform/analytics.md#vendor-and-branch-reports-vendor-sub_vendor) |
| Store | Its own open or closed state and its own opening hours, copied from the parent once | [Vendors and Branches](../04-vendors/vendors-and-branches.md#store-openclose-and-timezone) |
| Ingredients | The branch buys for itself and reads its own orders | [Ingredient Purchasing](../04-vendors/ingredient-purchasing.md) |

A branch also has **no view of its parent or siblings** beyond the branch list:
`GET /vendors/:vendorId` works for itself only, and `GET /vendors/:vendorId/branches` lists
the branches of the same parent.

---

## 6. Support and referral limitations

| Topic | Branch behavior | Owning page |
| --- | --- | --- |
| Support, send | **Not allowed** over REST (not in the route list). What a branch socket can do on the support events is not documented | [Support](../02-platform/support.md#who-can-do-what) |
| Support, read | `GET /support/tickets` is allowed and returns tickets whose owner is the branch's profile. Reading messages and marking read are **not allowed** | Same page |
| Support, close | Not allowed over REST; the socket close path has no role check | [Support](../02-platform/support.md#socketio-events) |
| SOS | Allowed: `POST /sos/trigger` and `GET /sos` (its own alerts). `GET /sos/:id` is not allowed | [SOS](../02-platform/sos.md#reading-alerts-over-rest) |
| Referrals | `GET /referrals/my-referrals` is not allowed. A vendor may call it but has no referral code anyway | [Points and Referrals](../09-offers-and-coupons/points-and-referrals.md#referral-codes) |
| Points | No points route for any vendor role | [Points and Referrals](../09-offers-and-coupons/points-and-referrals.md#at-a-glance) |

So a branch can list support tickets but cannot send to or read any thread over REST. Whether a
branch socket can open or use a ticket is not documented, because the socket path was not traced
per role (**Inferred**: it has no role list of its own).

---

## 7. Branch-specific restrictions

| Area | Restriction | Owning page |
| --- | --- | --- |
| Deleting | The soft-delete route lists the branch, but a non-admin may delete **only its own account**. A **parent vendor cannot delete a branch**; only the branch itself or an admin can. Deletion recomputes the parent's branch counters | [User Lifecycle](../03-identity-access/user-lifecycle.md#soft-delete) |
| Approval submit | The branch may submit itself, and its parent may submit it | [User Lifecycle](../03-identity-access/user-lifecycle.md#submit-for-approval) |
| Corrections | A branch is eligible for an admin correction grant, and only the branch confirms it | [Onboarding Journey](./onboarding-journey.md#correction-requests) |
| Profile lock | Locks on submit and stays locked after approval, like the parent | [Vendors and Branches](../04-vendors/vendors-and-branches.md#profile-updates-the-lock-and-correction-requests) |
| Editing | The parent may edit a branch's profile and documents; the branch may edit its own | [Vendors and Branches](../04-vendors/vendors-and-branches.md#parentbranch-permissions) |
| No cascade | Blocking, rejecting or deleting the parent does not touch the branch, which can still be listed and ordered from | [Vendors and Branches](../04-vendors/vendors-and-branches.md#known-implementation-inconsistencies) |
| Two location fields | The authenticated customer list reads `currentSessionLocation`, the public list `businessLocation`; neither is copied from the parent | Same page |
| Passwords | `change-password`, `forgot-password` and `reset-password` are available as for a vendor | [Authentication](../03-identity-access/authentication.md#flow-forgot--reset-password) |

---

## Unresolved and ambiguous points

- **Missing routes.** Whether the branch's absence from the agreement routes, `GET /profile`,
  `POST /uploads`, support send and read, and referrals is intended is not stated; the route
  lists are the only evidence.
- **Product images.** Whether a branch is meant to have no way to upload a product image is not
  stated.
- **Branch eligibility.** Whether a branch should follow its parent's status as well as its
  agreement is a product decision.
- **Who deletes a branch.** Whether a parent should be able to remove its own branch is not
  stated; at HEAD it cannot.
- **Branch support.** Whether a branch is meant to have a support channel is not stated.
- **Gate behavior on logout and push-token routes** for a blocked branch is **Inferred**, as
  on the vendor page.
- **Client behavior.** How a branch is told its parent must sign is not defined by the backend.

---

## Related documentation

- [Vendor Panel](./vendor-panel.md): the shared behavior this page is a delta of.
- [User Panel Flows Overview](./overview.md), [Onboarding Journey](./onboarding-journey.md), [Order Journey](./order-journey.md): the shared layer.
- [Vendors and Branches](../04-vendors/vendors-and-branches.md): branch lifecycle, cloning and permissions.
- [Agreement Gate](../07-agreements/agreement-gate.md): how a branch resolves to its parent's agreement.
- [Products](../05-products/products.md) and [Offers](../09-offers-and-coupons/offers.md): per-row catalog and promotion scope.
