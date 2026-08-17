# Glossary

## Overview

Domain terms actually found in the Deligo codebase, with a one- or two-line definition and a pointer to the document that covers them in depth. Terms not found in the repository are not included.

## Purpose

A quick lookup for vocabulary used throughout the rest of this documentation set and the codebase itself.

## Terms

**AuthUser** — The credentials/session/RBAC collection, fully decoupled from role-specific profile data. See [`role-model.md`](role-model.md).

**Profile (profile document)** — The role-specific data collection (`Admin`, `Customer`, `Vendor`, `FleetManager`, `DeliveryPartner`) linked to an `AuthUser` via polymorphic `profileId`/`profileModel`. This is what `req.user` actually holds after the `auth` middleware runs, not the `AuthUser` document itself. See [`role-model.md`](role-model.md).

**Vendor** — A merchant account, either a standalone business or the parent ("brand") of a multi-branch chain. See [`../03-modules/vendor-and-branches.md`](../03-modules/vendor-and-branches.md).

**SUB_VENDOR (Branch)** — Not a separate model — a `Vendor` document with `role: 'SUB_VENDOR'`, linked to its parent via `registeredBy`. See [`../03-modules/vendor-and-branches.md`](../03-modules/vendor-and-branches.md).

**Branch** — Colloquial term for a `SUB_VENDOR`. See above.

**registeredBy** — A polymorphic `{id, model}` field present on several profile schemas (`Vendor`, `DeliveryPartner`, `FleetManager`, `Admin`) recording who created the account. For `Vendor`, this is the entire parent↔branch link for `SUB_VENDOR`s. Distinct from `DeliveryPartner.currentFleetManagerId`, which is the *current*, mutable assignment rather than the original creator.

**CheckoutSummary** — The pricing/quoting snapshot document created between Cart and Order — where delivery fees, taxes, and offer discounts are computed before payment. See [`../03-modules/cart-checkout-order.md`](../03-modules/cart-checkout-order.md).

**Fulfillment type** — `DELIVERY` or `PICKUP`, chosen at checkout and fixed for the resulting order's lifetime. See [`../03-modules/cart-checkout-order.md`](../03-modules/cart-checkout-order.md).

**Dispatch** — The process of broadcasting an accepted delivery order to nearby delivery partners and having one claim it within a fixed time window. See [`../03-modules/delivery-and-dispatch.md`](../03-modules/delivery-and-dispatch.md).

**Dispatch pool (`dispatchPartnerPool`)** — The set of delivery-partner IDs a given order was broadcast to, stored on the `Order` document while status is `DISPATCHING`.

**Claim window** — The 120-second period after a broadcast during which any pooled delivery partner may accept the order; enforced both by a per-minute cron sweep and reactively at claim time.

**Radius tiers** — The expanding geo-search distances (3km, 4km, 5km) used to find delivery partners during dispatch; the search stops at the first tier that returns any eligible candidate.

**Pickup slot** — A scheduled pickup time window chosen at checkout for `PICKUP` fulfillment orders; same-day only for `RESTAURANT` vendors, up to 2 days ahead for `STORE` vendors, on 30-minute increments.

**Pickup code** — The 6-digit code generated for a self-pickup order, shown to the customer and verified by the vendor at the counter.

**GlobalSettings** — The singleton platform-configuration document (delivery pricing, commission rates, reward rules, payout scheduling). See [`../03-modules/admin-and-settings.md`](../03-modules/admin-and-settings.md).

**Wallet** — A per-user running balance (`currentBalance`, `lockedBalance`, `lifetimeEarnings`) credited automatically on order delivery and debited on payout settlement. See [`../03-modules/payments-and-payouts.md`](../03-modules/payments-and-payouts.md).

**Payout** — A scheduled or admin/fleet-manager-initiated settlement transferring a user's wallet balance out to their bank account. See [`../03-modules/payments-and-payouts.md`](../03-modules/payments-and-payouts.md).

**DeliGoBalance** — A separate balance ledger from `Wallet`, currently written to only by the Referral flow and with no HTTP surface at all. See [`../03-modules/loyalty-and-referrals.md`](../03-modules/loyalty-and-referrals.md) and [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).

**Referral** — A referrer↔referred relationship tracked through signup, rewarded on the referred user's first delivered order, subject to milestone tiers configured in `GlobalSettings.rewards`. See [`../03-modules/loyalty-and-referrals.md`](../03-modules/loyalty-and-referrals.md).

**Points / PointsLog** — Customer and delivery-partner loyalty point balances, credited on order delivery; `PointsLog` is the immutable ledger that also guards against double-crediting the same order via a database-level unique index. See [`../03-modules/loyalty-and-referrals.md`](../03-modules/loyalty-and-referrals.md).

**Coupon** — A reward record (`FREE_MEAL`/`FREE_DELIVERY`) generated by the Referral flow; has no HTTP route surface and no confirmed redemption mechanism anywhere in the codebase.

**Zone** — A geofenced polygon boundary used for address zoning; confirmed **not** consulted by delivery pricing or dispatch logic anywhere in the codebase, despite having pricing-shaped fields (`minDeliveryFee`, `maxDeliveryDistanceKm`).

**Offer** — A discount mechanism (`PERCENT`, `FLAT`, `FREE_DELIVERY` [disabled], `BOGO`), applied only at checkout, never in the Cart. See [`../03-modules/cart-checkout-order.md`](../03-modules/cart-checkout-order.md).

**Permission** — One of a 14-action catalog (`VALID_PERMISSION_ACTIONS`) that can be granted to an `ADMIN` account for finer-grained access than the role alone provides. Never applies to `SUPER_ADMIN`. See [`../02-authentication/permissions-and-rbac.md`](../02-authentication/permissions-and-rbac.md).

**AddonGroup** — A vendor-defined set of selectable options (e.g. "Choose toppings") attached to a product, with its own independent per-option tax reference.

**Dispatch expiry** — The moment (`dispatchExpiresAt`) a broadcast's 120-second claim window lapses, after which the order reverts to `AWAITING_PARTNER`.

**AI-first response (Support)** — An unimplemented concept in the `SupportTicket` schema (`activeHandler: 'AI'` default, `aiMetadata` field) — no code anywhere performs automated ticket handling; tickets simply wait for a human agent's first reply.

## Related Modules

[`role-model.md`](role-model.md), [`architecture-overview.md`](architecture-overview.md).

## Source References

Terms drawn from field names and enum values across `src/app/modules/*/​*.model.ts`, `*.interface.ts`, and `*.constant.ts` files cited in each entry's linked document.
