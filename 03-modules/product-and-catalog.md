# Product & Catalog

## Overview

Covers the customer-facing catalog (Product, Category hierarchy, Add-Ons, Tax) and the separate B2B ingredient-supply side channel (Ingredients, Ingredient-Order) that vendors use to restock raw materials from the platform itself.

## Purpose

Explain how products are structured and validated, how the category taxonomy is organized, and how stock rules differ between restaurant and store vendors.

## Category hierarchy

Three independent Mongoose collections, related only by ObjectId reference — not a nested tree. `BusinessCategory` and `Cuisine` live in `src/app/modules/Category/category.model.ts`; `ProductCategory` was split into its own module `src/app/modules/ProductCategory/` on 2026-08-29 (mounted at `/api/v1/product-categories`).

```mermaid
flowchart TD
    BusinessCategory["BusinessCategory\n(RESTAURANT | STORE — exactly 2 values in practice)"] -.businessDetails.businessType.-> Vendor
    Vendor --> ProductCategory
    ProductCategory["ProductCategory\n(vendor-owned, e.g. Pizza, Burger)"] --> Product
    Cuisine["Cuisine\n(e.g. Italian, Portuguese —\nindependent, unrelated to the above)"] -.Vendor.restaurantCuisineType.-> Vendor
```

- **BusinessCategory** — admin-curated; in practice exactly two seed values, `RESTAURANT`/`STORE`. Every `Vendor.businessDetails.businessType` points here. Writes are `ADMIN`/`SUPER_ADMIN`-only.
- **ProductCategory** — **vendor-owned since 2026-08-29** (`vendorId` → Vendor). Each vendor manages its own flat list; these are the vendor's customer-facing product groups. `Product.category` points here and must be owned by the same vendor. No `businessCategoryId`, no icon/image, no description — just a localized `name` + `slug` + `isActive`. Writes are `VENDOR`/`SUB_VENDOR` on their own records (plain JSON, no upload); `ADMIN`/`SUPER_ADMIN` are read-only. Per-vendor uniqueness on `name.en` and `slug`.
- **Cuisine** — a flat, unrelated tag list used only for `Vendor.businessDetails.restaurantCuisineType`; not linked to BusinessCategory/ProductCategory at all. Admin-only writes.

`GET /categories/*/open` (BusinessCategory, Cuisine) and `GET /product-categories/open?vendorId=<id>` are public; the ProductCategory one requires `?vendorId=<id>`.

### Single vendor-owned category (`Product.category`) — 2026-08-29

`Product.category` is the **one and only** category field: a single required
`ProductCategory` ref, used for SKU generation, discovery filtering, and BOGO
matching. The `Product.additionalCategories[]` multi-tag field added 2026-08-24
was **removed** in the same change that made `ProductCategory` vendor-owned.

Validation (`CreateProductUtils.validateCategoryOwnership`, used by
`product.service.createProduct` and by `updateProduct.utils.prepareUpdateData`
whenever `category` changes):
- The id must resolve to a live `ProductCategory` → else `404 NOT_FOUND_MESSAGE`.
- Its `vendorId` must equal the product's own vendor → else `403 CATEGORY_NOT_OWNED_BY_VENDOR`.

Discovery matches the single `category` field directly (`?category=<id>` is a
plain exact-match filter on `GET /products` / `/products/open`; BOGO
`buyCategoryId` resolution; the customer "browse vendors by category" filter;
Meilisearch `categoryIds`, still an array but now length 1).

`copy-to-branch`: a branch is a separate owner, so the copy resolves the
branch's **own** category — it reuses a branch-owned category with the same
`slug`, otherwise clones the source category (name/slug) under the branch's
`vendorId` (same pattern as the addon-group cloning in that flow).

## Product validation rules

Executed in this order inside product creation (`createProduct.utils.ts`, `product.service.ts`):

1. **Vendor approval** — caller's `status !== 'APPROVED'` → `403 VENDOR_NOT_APPROVED_TO_ADD_PRODUCTS`.
2. **Price required without variations** — no `variations` and no `pricing.price` → `400 PRICE_REQUIRED_WHEN_NO_VARIATIONS`.
3. **Category ownership** — the chosen `ProductCategory` must exist, not be deleted, and have `vendorId` equal to the product's own vendor → else `403 CATEGORY_NOT_OWNED_BY_VENDOR` (`404` if the id doesn't resolve). Re-checked on update whenever `category` changes. `copy-to-branch` instead resolves/clones the category into the target branch (see [`vendor-and-branches.md`](vendor-and-branches.md)).
4. **Restaurant/Store stock rule** (see below).
5. **Addon ownership** — every `addonGroups[]` entry must exist, belong to the calling vendor, and not be deleted → `400 INVALID_ADDON_GROUPS`. Re-checked on update.
6. **Tax application** — `pricing.taxRate` is always overwritten server-side from the referenced `Tax` document; a client-supplied `taxRate` is never trusted.
7. **ID/SKU generation** — `productId` (`PROD-<6char>`), `slug` (from bilingual name), `sku`.
8. **Variation handling** — `pricing.price` is computed as the **minimum** variation-option price; per-option SKUs auto-generated if not supplied.

## Business Rules — Restaurant vs. Store stock

**Stock tracking is forbidden for `RESTAURANT`-type vendors, allowed for `STORE`-type vendors.** If the vendor's business type is `RESTAURANT`:
- A simple product's `stock.quantity > 0` throws `400 STOCK_MANAGEMENT_NOT_ALLOWED_FOR_RESTAURANTS`, and `payload.stock` is forced to `undefined` before save regardless.
- A variation option's `stockQuantity > 0` throws `400 VARIATION_STOCK_NOT_ALLOWED_FOR_RESTAURANTS`, and `stockQuantity`/`totalAddedQuantity`/`isOutOfStock` are stripped from the option entirely.

**This check is re-derived independently in at least 4 separate code paths** (product creation, `manageProductVariations`, `removeProductVariations`, `updateInventoryAndPricing`) rather than centralized into one shared guard — each re-fetches the vendor's `businessDetails.businessType` and re-applies the same branch. Worth knowing if extending stock-related logic, since a change would need to be made in all four places. Similarly, the stock-availability threshold (`<5` units → `'Limited'`, `0` → `'Out of Stock'`) is duplicated across the same 4 locations rather than centralized.

## Product management endpoints

Beyond create/update, four dedicated endpoints manage variations and inventory (all `VENDOR`/`SUB_VENDOR`):
- `PATCH /products/manage-product-variations/:productId` — add a new option to an existing/new named variation group; duplicate-label and duplicate-SKU checks span the whole product.
- `PATCH /products/rename-product-variations/:productId` — rename a group or option label, with per-language duplicate checks within the group.
- `PATCH /products/remove-product-variations/:productId` — remove one option or an entire group; an emptied group is spliced out entirely.
- `PATCH /products/update-inventory-and-pricing/:productId` — adjust `addedQuantity`/`reduceQuantity`/`newPrice`; `reduceQuantity` can't exceed current stock; `variationSku` is required if the product has variations, forbidden if it doesn't; the stock branch is skipped entirely for restaurants (price-only).

All four re-derive the restaurant/store stock rule and re-sum `pricing.price` (min)/`stock.quantity` after the mutation, per the note above.

**Delete guard**: `softDeleteProduct` is blocked if the product appears in any non-terminal order (`400 CANNOT_DELETE_PRODUCT_WITH_ACTIVE_ORDER`). `permanentDeleteProduct` requires soft-delete first, admin-only.

**Out-of-stock alerting** (admin-only): `GET /products/out-of-stock-alerts` flags products with `stock.quantity < 10`, any variation option below 10, or an `'Out of Stock'` status; `POST /products/notify-vendor/:productId` pushes + emails the owning vendor (fire-and-forget).

**Visibility scoping**: `VENDOR`/`SUB_VENDOR` see all their own products (incl. unapproved/inactive); `CUSTOMER`/`FLEET_MANAGER`/`DELIVERY_PARTNER` see only `isApproved:true, isDeleted:false, meta.status:'ACTIVE'`; `ADMIN`/`SUPER_ADMIN` see everything.

## Add-Ons (AddonGroup)

Vendor-scoped groups of selectable options (`minSelectable`/`maxSelectable`, `options[]` each with its own `sku`, `price`, and an **independent per-option `Tax` reference** — populated live on every read, not snapshotted the way `Product.pricing.taxRate` is). `options.sku` is globally unique across all vendors (not just per-vendor). `AddonGroup.vendorId` is a hard ownership boundary — enforced both when a product references an addon group and on every option-level mutation endpoint. Duplicate-title checks are case-insensitive per vendor.

## Tax

A fixed enum of Portuguese VAT/IVA rates: `taxRate` ∈ `{0, 6, 13, 23}`, mapped to `taxCode` (`ISE`/`RED`/`INT`/`NOR`). Admin-only CRUD. **Schema-level compliance rule**: a `taxRate: 0` document is rejected on save/update unless it has both a non-empty `taxExemptionCode` and a localized `taxExemptionReason` — this is a Mongoose `pre('save')`/`pre('findOneAndUpdate')` guard, enforced even against direct database writes, not just app-layer validation. Referenced independently from `Product.pricing.taxId`, `AddonGroup.options[].tax`, and `Ingredient.tax` — each consumer copies or populates the rate at its own layer.

## RestrictedItems — confirmed unenforced

An admin-maintained catalog (`TOBACCO|ALCOHOL|ADULT_CONTENT|DANGEROUS_GOODS|OTHER`) with full CRUD, but **no code path anywhere in `Product`, `Cart`, or `Order` cross-checks against it** — confirmed via a repo-wide search finding zero references outside the `RestrictedItems` module itself. It is purely informational/administrative today. See [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).

## Ingredients & Ingredient-Order (B2B supply chain)

A **separate, admin-run raw-materials marketplace for vendors** — unrelated to the customer-facing catalog above.

- **Ingredient** — admin-maintained catalog (`ADMIN`/`SUPER_ADMIN` + `CAN_MANAGE_INGREDIENTS` permission for writes; `VENDOR`/`SUB_VENDOR` read-only). Fields include `lowStockAlert` (default 5), `minOrder` (default 1), `bulkDiscount[]` tiers.
- **IngredientOrder** — a vendor "buys" ingredients from the platform itself, not from another vendor. Order creation is **split across two modules**:
  1. `POST /payment/ingredient/create-payment-intent` (`Payment` module) builds the `IngredientOrder` as `PENDING`/`PROCESSING`, **decrements `Ingredient.stock` immediately at intent-creation time** (not at confirmation), applies `bulkDiscount` tiers, computes delivery charge from `GlobalSettings.ingredientOrder.deliveryChargeInsideLisbon`/`OutsideLisbon` based on the vendor's city.
  2. `POST /ingredient-orders/create-order` (`confirmIngredientOrder`, `Ingredient-Order` module) verifies the REDUNIQ payment token, flips to `PAID`, assigns the display `orderId`, creates a `Transaction` (`type: INGREDIENT_PURCHASE`), notifies all admins.
  - Status lifecycle: `PENDING → CONFIRMED → SHIPPED → DELIVERED`, sequential only, admin-only transitions.
  - A 5-minute cron (`releaseAbandonedIngredientStockCron`) restores reserved stock for intents that never completed payment within a 15-minute window. See [`../07-operations/cron-and-background-jobs.md`](../07-operations/cron-and-background-jobs.md).

## Database Impact

See [`../05-data-model/collections-reference.md`](../05-data-model/collections-reference.md) for full field/index detail on `Product`, `BusinessCategory`/`ProductCategory`/`Cuisine`, `AddonGroup`, `Tax`, `Ingredient`, `IngredientOrder`, `RestrictedItems`.

## Validation

Zod schemas (`*.validation.ts`) validate request shape; the business rules above (stock-by-business-type, category/business-type match, addon ownership) are enforced in service code, not the validation layer.

## Authorization

Product / AddonGroup / **ProductCategory** writes: `VENDOR`/`SUB_VENDOR` (own resources only). BusinessCategory / Cuisine / Tax / Ingredients / RestrictedItems writes: `ADMIN`/`SUPER_ADMIN`. Admins have read-only access to every vendor's ProductCategories. See [`../04-api-reference/endpoint-index.md`](../04-api-reference/endpoint-index.md) for the full per-endpoint role table.

## Edge Cases

- `copy-to-branch` re-derives the restaurant/store stock rule for the **target branch's** business type, not the source vendor's — relevant since a branch always inherits its parent's `businessType` at onboarding, so a mismatch shouldn't occur in practice, but the code does correctly handle it per-destination rather than assuming it matches the source.
- `copy-to-branch` also can't reuse the parent's `category` id (categories are vendor-owned) — it looks up a branch-owned category with the same `slug` and, if absent, silently creates one for the branch. Re-running the copy reuses that clone.
- Deleting a `ProductCategory` (soft or permanent) is **blocked** with `409 PRODUCT_CATEGORY_HAS_PRODUCTS` while any non-deleted `Product` still points its `category` at it (`assertNoProductsUnderCategory` in `productCategory.service.ts`). There is no cascade/cleanup — the vendor must reassign or delete those products first. Soft-deleted products don't count toward the guard.
- A `RESTAURANT` vendor's product `stock` field is always `undefined`, not zero — code checking for "out of stock" on a restaurant product must not assume a numeric `stock.quantity` exists.

## Related Modules

[`vendor-and-branches.md`](vendor-and-branches.md), [`cart-checkout-order.md`](cart-checkout-order.md), [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).

## Source References

- `src/app/modules/Product/product.model.ts`, `product.service.ts`, `createProduct.utils.ts`, `updateProduct.utils.ts`, `product.route.ts`
- `src/app/modules/Category/category.model.ts`, `businessCategory.*`, `cuisineCategory.*`
- `src/app/modules/ProductCategory/productCategory.*` (standalone module, mounted at `/api/v1/product-categories`)
- `src/app/modules/Add-Ons/addOns.model.ts`, `addOns.service.ts`
- `src/app/modules/Tax/tax.model.ts`
- `src/app/modules/RestrictedItems/restrictedItems.model.ts`
- `src/app/modules/Ingredients/ingredients.model.ts`, `src/app/modules/Ingredient-Order/ing-order.model.ts`, `ing-order.service.ts`
- `src/app/modules/Payment/payment.service.ts` (`createIngredientRedUniqPayment`)
- `src/app/cron/ingredientOrder.crone.ts`
