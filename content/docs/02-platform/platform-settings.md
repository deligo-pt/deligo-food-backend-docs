---
title: Platform Settings
description: "The admin-managed configuration of the platform as implemented: the single GlobalSettings document and what reads each value, commission rates, taxes, delivery zones, business categories and cuisines, and the restricted-items list, with their routes, roles, lifecycles and the settings that nothing uses."
order: 6
---

# Platform Settings

This page covers the configuration that admins maintain and that other modules read: the
single **GlobalSettings** document, **commission rates**, **taxes**, **delivery zones**,
**business categories and cuisines**, and the **restricted-items** list. It describes where
each value is consumed, because several settings are stored but never read. Detailed
behavior of the modules that consume them is linked, not repeated.

Paths are relative to `src/app/`. Statements come from the committed code, read but not
run, unless marked **Executed** (a probe ran real code with no database), **Inferred** or
**Unresolved**. Uncommitted working-tree features are not described.

---

## At a glance

| Area | Routes | Roles | Audit |
| --- | --- | --- | --- |
| Global settings | `/api/v1/globalSettings` | `ADMIN`, `SUPER_ADMIN` | `GLOBAL_SETTINGS_UPDATED` (create and update, no before or after values) |
| Commission rates | `/api/v1/commission-rates` | `ADMIN`, `SUPER_ADMIN` | `COMMISSION_RATE_CREATED`, `COMMISSION_RATE_CANCELLED` |
| Taxes | `/api/v1/taxes` | write: `ADMIN`, `SUPER_ADMIN`; read: also `VENDOR`, `SUB_VENDOR` | `TAX_CREATED`, `TAX_UPDATED`, `TAX_SOFT_DELETED`, `TAX_PERMANENTLY_DELETED` |
| Zones | `/api/v1/zones` | `ADMIN`, `SUPER_ADMIN`; permanent delete `SUPER_ADMIN`; one public lookup | `ZONE_*` (six actions) |
| Business categories, cuisines | `/api/v1/categories/businessCategory`, `/api/v1/categories/cuisine` | write: `ADMIN`, `SUPER_ADMIN`; read: several roles and public routes | permanent delete only |
| Restricted items | `/api/v1/restricted-items` | write: `ADMIN`, `SUPER_ADMIN`; list: also `VENDOR`, `SUB_VENDOR` | `RESTRICTED_ITEM_*` (four actions) |

None of these routes requires a permission action. Any `ADMIN` can change them
(`CAN_MANAGE_SYSTEM_SETTINGS` exists but is not enforced; see
[Authorization](../03-identity-access/authorization.md#admin-permissions)). The activity log
entries themselves are described in [Activity Logs](../12-activity-logs/activity-logs.md).

---

## Global settings

One `GlobalSettings` document (`modules/GlobalSetting/`), kept unique by an index. The boot
seed creates an empty one (all defaults) when none exists (see
[Local Development](../01-introduction/local-development.md#database-setup-and-seeding)),
so `POST /globalSettings/create` normally answers `409 SETTINGS_ALREADY_EXIST_UPDATE_INSTEAD`.

| Endpoint | Behavior |
| --- | --- |
| `POST /globalSettings/create` | Creates the document when none exists. Each section is optional, but a section that is sent must contain **all** of its fields. `ADMIN`, `SUPER_ADMIN`; the caller must be `APPROVED`. |
| `PATCH /globalSettings/update` | Partial update: any subset of sections and fields (strict). The payload is flattened to dot paths, so nested fields merge; **arrays are replaced whole** (`payoutDays`, `customerReferralMilestones`). Records `meta.updatedBy`. A `404 SETTINGS_NOT_FOUND_CREATE_FIRST` if there is no document. |
| `GET /globalSettings` | The document, without the legacy `commission.platformPercent` and `platformVatRate`. |

Cross-field rules enforced on update: `activityLogRetention.deleteAfterMonths` must be
greater than `archiveAfterMonths` (also on create), and `payout.autoGenerate: true` requires
at least one payout day. Other values are checked by the field rules below.

### Delivery and service pricing

| Setting | Default | Read by |
| --- | --- | --- |
| `delivery.baseCharge` | 0 | Checkout: a fixed amount added whenever the distance is above zero. |
| `delivery.chargePerKm` | 0 | Checkout: rate for the first `distanceThresholdKm`. |
| `delivery.distanceThresholdKm` | 5 | Checkout. |
| `delivery.chargePerKmBeyondThreshold` | unset | Checkout: rate beyond the threshold, falling back to `chargePerKm`. |
| `delivery.vatRate` | 0 | Checkout, offers, payment. A configured 0 is treated as 23 at checkout (see [Checkout and Order Creation](../03-orders/checkout-and-order-creation.md#known-implementation-notes)). |
| `commission.serviceCharge` | 0 | Checkout and offers: the customer service charge (validated 0 to 100). |
| `commission.serviceChargeVatRate` | 23 | Checkout, invoices. |
| `commission.fleetManagerPercent` | 0 | Checkout and offers: the fleet manager's share of the delivery charge. |

The formula is on [Checkout and Order Creation](../03-orders/checkout-and-order-creation.md)
and [Data Model](./data-model.md#delivery-fee-food-orders). The platform commission is **not**
here: it is in the commission rates below, and `commission.platformPercent` and
`platformVatRate` are legacy fields kept only in old documents.

### Order settings

| Setting | Default | Read by |
| --- | --- | --- |
| `order.nearestVendorRadiusKm` | 0 | Customer vendor and product discovery and the search index (radius). With the default 0 the vendor search area is a single point and the search filter a zero-radius circle until an admin sets it (validated `> 0` on update); see [Products and Categories](../05-products/products.md) and [Menus](../05-products/menus.md). |
| `order.autoAcceptTimeoutMinutes` | 2 | Auto-accept (see [Order Automation](../03-orders/order-automation.md#configuration)). |
| `order.autoDispatchLeadMinutes` | 10 | Auto-dispatch. |
| `order.cancelTimeLimitMinutes` | 0 | **Nothing.** |

### Ingredient order settings

`ingredientsOrder` holds `deliveryChargeInsideLisbon` (default 20), its VAT rate (23),
`deliveryChargeOutsideLisbon` (30) and its VAT rate (23). They are read only by the
ingredient payment intent (see [Ingredient Purchasing](../04-vendors/ingredient-purchasing.md)),
which treats a configured charge of `0` as the default.

### Rewards settings

| Setting | Default | Read by |
| --- | --- | --- |
| `rewards.customerPointsPerEuro` | 0 | Customer points at settlement. |
| `rewards.riderPointsPerDelivery` | 0 | Rider points; `0` falls back to 20 in the code. |
| `rewards.pointsExpiryDays` | 0 | Stored on the points balance; nothing enforces expiry. |
| `rewards.newRiderWelcomeBonus` | 0 | Referral entry for a rider. |
| `rewards.customerReferralMilestones` | empty | Referral reward distribution. |
| `rewards.referralPoints` | 0 | **Nothing.** |

Behavior is on [Points and Referrals](../09-offers-and-coupons/points-and-referrals.md).

### Payout settings

| Setting | Default | Read by |
| --- | --- | --- |
| `payout.autoGenerate` | false | The daily payout cron. |
| `payout.payoutDays` | empty | The cron: weekday names in the platform timezone (`Sunday` to `Saturday`). |
| `payout.minPayoutAmount` | 0 | Automatic payouts: the smallest available balance that is paid out. |
| `payout.payoutWindowDays` | 0 | Automatic payouts: moves the recorded `endDate`. |

See [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md#automatic-payouts).

### Agreement signatory and activity-log retention

- `agreement.deligoSignatureUrl`, `deligoSignatoryName`, `deligoSignatoryRole` and `deligoCompanyStampUrl` (strict URLs and non-empty strings, all default `null`) are the platform's default signatory, read when a party's agreement is approved and rendered (see [Agreements](../07-agreements/agreements.md)). Approving a gated vendor or fleet manager needs the signatory to be configured.
- `activityLogRetention` (`archiveAfterMonths` 12, `deleteAfterMonths` 18, `batchSize` 500, whole numbers of at least 1) is read by the retention job (see [Activity Logs](../12-activity-logs/activity-logs.md#immutability-and-retention)).

---

## Commission rates

`POST /commission-rates`, `GET /commission-rates`, `GET /commission-rates/effective` and
`DELETE /commission-rates/:id` (which **cancels** a rate; there is no hard delete), all
`ADMIN` and `SUPER_ADMIN`. The model (agreement link, baseline, effective dates, one active
rate per agreement) and how checkout picks the effective rate are documented in
[Data Model](./data-model.md#platform-commission-effective-dated). The audit entries record
the percent and the agreement version.

---

## Taxes

`Tax` (`modules/Tax/`) is a Portuguese VAT definition.

| Field | Notes |
| --- | --- |
| `taxName`, `description` | Localized (`en` and `pt`). |
| `taxCode` and `taxRate` | Fixed pairs: `NOR` 23, `INT` 13, `RED` 6, `ISE` 0. The validation rejects a mismatched pair. |
| `taxExemptionCode`, `taxExemptionReason` | Required (code and a reason in at least one language) when the rate is 0, in validation, service and model. |
| `countryID` (default `PRT`), `TaxRegionID`, `taxGroupID` (default `IVA`) | Invoicing fields. |
| `isActive`, `isDeleted` | Activation and soft delete. |

| Endpoint | Roles | Behavior |
| --- | --- | --- |
| `POST /taxes/create-tax` | `ADMIN`, `SUPER_ADMIN` | Only one **active** tax may exist per country for a given `taxCode` **or** a given `taxRate` (`TAX_CONFLICT_CODE_OR_RATE_EXISTS` on update; a duplicate on create). A duplicate name among non-deleted taxes is refused. |
| `PATCH /taxes/:taxId` | same | Partial update, including `isActive`. The conflict and zero-rate rules are re-checked. The update runs without Mongoose validators. |
| `GET /taxes`, `GET /taxes/:taxId` | `ADMIN`, `SUPER_ADMIN`, `VENDOR`, `SUB_VENDOR` | Search on the localized name. The list has **no base filter**, so inactive and soft-deleted taxes are returned. |
| `DELETE /taxes/soft-delete/:taxId` | `ADMIN`, `SUPER_ADMIN` | Refused while the tax is active (`ACTIVE_TAX_CANNOT_BE_DELETED_DEACTIVATE_FIRST`). |
| `DELETE /taxes/permanent-delete/:taxId` | same | Requires a prior soft delete. |

Consumers: a product copies the tax **rate** when it is created, updated or copied, and
ingredients reference a tax. Creating an ingredient requires an active, non-deleted tax,
but a product's `taxId` is only looked up by id (existence), with no check that the tax is
active or not deleted. Nothing checks whether a tax is in use before it is deleted, and
changing a tax's rate does not touch existing products (they keep the rate they stored).
See [Products and Categories](../05-products/products.md#pricing-and-tax).

---

## Zones

`Zone` (`modules/Zone/`) is a delivery-area polygon.

| Field | Notes |
| --- | --- |
| `zoneId` | Business slug such as `Lisbon-Zone-01` (3 to 50 characters, letters, digits and single hyphens, never a 24-character hex string). Unique, compared case-insensitively. |
| `district`, `zoneName` | Names. |
| `boundary` | A GeoJSON `Polygon` with a `2dsphere` index. At most 2,000 vertices; the area must be between 0.05 and 5,000 km². |
| `areaKm2`, `centroid`, `bbox` | Computed by the server from the boundary. |
| `isOperational` | Active flag. |
| `minDeliveryFee`, `maxDeliveryDistanceKm` | Optional, each above 0 and at most 100. **Nothing reads them.** |
| `deactivationReason`, `createdBy`, `updatedBy`, `deletedBy`, `deletedAt`, `isDeleted` | Lifecycle data. |

| Endpoint | Roles | Behavior |
| --- | --- | --- |
| `POST /zones/create-zone` | `ADMIN`, `SUPER_ADMIN` | Validates and analyzes the polygon. An **operational** zone may overlap another operational zone by at most 100 m² (touching edges are allowed); otherwise `ZONE_OVERLAP_DETECTED`. A zone created with `isOperational: false` is not checked until it is activated. |
| `POST /zones/validate-boundary` | same | Previews area, centroid, bbox and overlaps without saving; `excludeZoneId` ignores one zone. |
| `GET /zones/all-zones`, `GET /zones/:zoneId` | same | List (search on `zoneId`, `zoneName`, `district`; the boundary is left out unless `includeBoundary=true` or `fields` is given) and one by `_id` or `zoneId`. |
| `GET /zones/check-point?lng=&lat=` | **public** | Finds the operational, non-deleted zone containing the point and returns its id, names and the two optional limits (`404 ZONE_NOT_FOUND` otherwise). |
| `PATCH /zones/:zoneId` | `ADMIN`, `SUPER_ADMIN` | Update. A changed boundary or an activation re-runs the overlap check. Activating clears `deactivationReason`. A deleted zone cannot be updated. |
| `PATCH /zones/:zoneId/toggle-status` | same | Sets `isOperational` with an optional reason. Activating re-runs the overlap check. Setting the current value is refused. |
| `DELETE /zones/:zoneId/soft-delete` | same | Refused while the zone is operational. |
| `PATCH /zones/:zoneId/restore` | same | Restores a soft-deleted zone, **inactive**. |
| `DELETE /zones/:zoneId/permanent-delete` | `SUPER_ADMIN` only | Requires soft delete first and that nothing references the zone: no rider's `assignmentZoneId` or `currentZoneId`, no customer address `zoneId`, no sponsorship target (`409 ZONE_IN_USE_CANNOT_DELETE`, naming the users). |

**What uses zones.** Only the sponsorship audience (see [Sponsorships](./sponsorships.md)) and
the delete guard above. Customer addresses have a `zoneId` field, but **no API accepts it**
(**Executed:** the address validation is strict and rejects `zoneId`), so it stays empty and
the customer check of the delete guard cannot match in practice. Riders have zone fields that
nothing sets, and a vendor's `deliveryZoneId` is a plain string. Dispatch and delivery pricing do not use zones, as noted in
[Vendors and Branches](../04-vendors/vendors-and-branches.md).

---

## Business categories and cuisines

`BusinessCategory` has exactly two meaningful values, `RESTAURANT` and `STORE`, created from
a fixed English and Portuguese pair (`RESTAURANT` / `RESTAURANTE`, `STORE` / `LOJA`); the
slug is derived from the English name and an icon file is required. A vendor's business type
points at one of them and drives store rules such as stock checks. `Cuisine` is an
admin-maintained list (upper-cased localized name, derived slug, required image).

| Endpoint | Roles | Behavior |
| --- | --- | --- |
| `POST /categories/businessCategory` and `POST /categories/cuisine/create` | `ADMIN`, `SUPER_ADMIN` | Create (multipart file). Duplicates by name are refused. |
| `PATCH /categories/businessCategory/:id`, `PATCH /categories/cuisine/:id` | same | Update. Sending `isActive` equal to the current value is refused; a new file replaces and deletes the old one. |
| `GET` list and single (authenticated) | business category: `ADMIN`, `SUPER_ADMIN`, `FLEET_MANAGER`, `VENDOR`, `SUB_VENDOR`, `CUSTOMER`; cuisine: the same without `FLEET_MANAGER` | Non-admins only see active, non-deleted rows in the list. |
| `GET .../open` and `.../open/:id` | public | Active, non-deleted rows in the lists. A single cuisine is hidden when it is inactive **or** deleted; a single business category only when it is inactive **and** deleted (so an inactive but not deleted business category is still returned by `GET /categories/businessCategory/open/:id`, **Inferred** from the condition). The authenticated single reads of both follow the same conditions for non-admins. |
| `DELETE .../soft-delete/:id` | `ADMIN`, `SUPER_ADMIN` | Refused while the row is active. |
| `DELETE .../permanent-delete/:id` | same | Requires a prior soft delete, logs `BUSINESS_CATEGORY_PERMANENTLY_DELETED` or `CUISINE_CATEGORY_PERMANENTLY_DELETED`. |

Creation and updates are not logged. Nothing checks whether vendors still use a category or
cuisine before it is deleted. Product categories are a different, vendor-owned concept
(see [Products and Categories](../05-products/products.md#product-categories)).

---

## Restricted items

`RestrictedItem` (`modules/RestrictedItems/`) is a list of goods the platform does not allow
(`name`, `reason`, `category` of `TOBACCO`, `ALCOHOL`, `ADULT_CONTENT`, `DANGEROUS_GOODS`,
`OTHER`, `isDeleted`).

| Endpoint | Roles | Behavior |
| --- | --- | --- |
| `POST /restricted-items/add` | `ADMIN`, `SUPER_ADMIN` | Creates; a duplicate `name` is refused. |
| `PATCH /restricted-items/:itemId` | same | Update. |
| `GET /restricted-items` | `ADMIN`, `SUPER_ADMIN`, `VENDOR`, `SUB_VENDOR` | The query chain adds no `search`, `filter` or `paginate` (only a count), so **every** row is returned, including soft-deleted ones (**Inferred** from the code). |
| `GET /restricted-items/:itemId` | `ADMIN`, `SUPER_ADMIN` | One item. |
| `DELETE /restricted-items/:itemId` | same | Soft delete. |
| `DELETE /restricted-items/permanent-delete/:itemId` | same | Requires a prior soft delete. |

**No code consumes the list.** Product creation, updates and the search index do not check
a product against it, so it is reference data that a client may show vendors, not an enforced
rule. All four mutations are logged (`RESTRICTED_ITEM_*`).

---

## Mismatches and inconsistencies

1. **Settings that nothing reads:** `order.cancelTimeLimitMinutes` and `rewards.referralPoints`. `rewards.pointsExpiryDays` is stored but expiry is never enforced.
2. **Falsy fallbacks ignore configured zeros:** `riderPointsPerDelivery: 0` still pays 20 points, the ingredient delivery charges of `0` still charge 20 or 30, and a delivery VAT of `0` becomes 23.
3. **Discovery radius defaults to 0** (seeded document), so vendor and product discovery effectively matches only the exact point (normally returning nothing) until `order.nearestVendorRadiusKm` is set.
4. **No permission action protects any of this.** `CAN_MANAGE_SYSTEM_SETTINGS` is unused, so any `ADMIN` can change pricing, payouts and retention.
5. **Settings updates are not diffed.** The activity log records only that the settings changed.
6. **Taxes can be deleted while used,** the tax list exposes inactive and deleted rows, and a product can reference an inactive tax.
7. **Zone limits are decorative.** `minDeliveryFee` and `maxDeliveryDistanceKm` are validated and stored but unused, and zones do not affect dispatch or pricing.
8. **Restricted items are not enforced.**
9. **Category and cuisine deletion is unchecked** against vendors that use them, and their creation and updates leave no audit entry.

---

## Unverified or inferred behavior

- Nothing on this page was executed; values and consumers come from reading the models, validation and a search of the codebase for each setting's readers.
- How clients present the restricted list, the zone limits or the public category routes is not known from the backend.

---

## Related documentation

- [Data Model](./data-model.md): commission rates, delivery fee and the `GlobalSettings` summary.
- [Checkout and Order Creation](../03-orders/checkout-and-order-creation.md): where the pricing settings are applied.
- [Order Automation](../03-orders/order-automation.md#configuration): the effective order timers.
- [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md): the payout settings in use.
- [Points and Referrals](../09-offers-and-coupons/points-and-referrals.md): the rewards settings in use.
- [Sponsorships](./sponsorships.md): the only consumer of zones.
- [Activity Logs](../12-activity-logs/activity-logs.md): the settings audit entries.
