# Collections Reference

## Overview

MongoDB via Mongoose. Each collection is defined in a module's `*.model.ts` (one module, `ErrorLog`, uses `errorLog.schema.ts` instead — a naming outlier worth knowing if searching for it). Some modules have no collection of their own — `Auth`, `Payment`, `Analytics`, `ContactUs`, `Meilisearch`, `Upload`, `Profile`, `Test`, `Ai-Content-Generator` are service/orchestration layers over other modules' collections.

## Purpose

Give a developer the field-level shape, relationships, indexes, and soft-delete behavior of every collection without reading every model file directly.

## Two-tier identity model

`AuthUser` (credentials, sessions, RBAC) is fully decoupled from role-specific profile collections (`Admin`, `Customer`, `Vendor`, `FleetManager`, `DeliveryPartner`) via a polymorphic `profileId`/`profileModel` link (`refPath`, not a Mongoose discriminator). See [`../02-authentication/session-and-token-management.md`](../02-authentication/session-and-token-management.md).

## Collections

### AuthUser — `src/app/modules/AuthUser/authUser.model.ts`
Unified credentials/session/RBAC-anchor collection. Fields: `userId` (unique), `profileId` (`refPath: profileModel`), `profileModel` (`Customer|Vendor|FleetManager|DeliveryPartner|Admin`), `email`, `contactNumber`, `role`, `status`, `isDeleted`, `loginDevices[]` (embedded), `isEmailVerified`, `isContactNumberVerified`, `requiresOtpVerification`, `socialAccounts[]` (`provider`, `providerId`, `email`), `password` (select-excluded), `passwordChangedAt`, `twoFactorEnabled`.
Indexes: `{email:1, role:1}` unique, partial on email being a string; `{contactNumber:1, role:1}` unique, partial on contactNumber being a string; `{'socialAccounts.provider':1, 'socialAccounts.providerId':1}` unique, partial on providerId being a string. This lets the same email be reused across different roles but not twice within one role.
Soft delete: yes (`isDeleted`).
Business rule in schema: `pre('save')` auto-sets `status: 'APPROVED'` for any new document with `profileModel === 'Customer'` — customers bypass the approval workflow entirely, enforced at the schema level, not just in service code.
Plugins: `authLookupPlugin` (email/userId lookup statics — `isUserExistsByContactNumber` is referenced in `user.interface.ts` but not confirmed implemented in the plugin), `passwordPlugin` (hash-on-save, `isPasswordMatched`, `isJWTIssuedBeforePasswordChanged`, `createPasswordResetToken` — the latter only generates a raw token, persists nothing on the document; reset tokens live in Redis only).

### Admin — `src/app/modules/Admin/admin.model.ts`
Shared collection for `ADMIN` and `SUPER_ADMIN` (differentiated by `role`). Fields: `userId` (unique), `registeredBy` (→ Admin, self-ref), `role`, `email` (unique), `status`, `isDeleted`, `isUpdateLocked`, `name`, `contactNumber`, `address`, `NIF`, `currentSessionLocation` (GeoJSON), `documents`, `permissions: string[]`, `approvedBy`/`rejectedBy`/`blockedBy` (→ Admin), `submittedForApprovalAt`, `approvedOrRejectedOrBlockedAt`, `remarks`.
Relationships: `registeredBy`, `approvedBy`, `rejectedBy`, `blockedBy` → Admin (self).
Soft delete: yes.
Note: a stale code comment implies a password-hashing plugin is applied here, but it is not — Admin credentials live only in `AuthUser`.

### Customer — `src/app/modules/Customer/customer.model.ts`
Fields: `userId` (unique), `role` (fixed `CUSTOMER`), `email` (unique, sparse), `status` (defaults `APPROVED`), `isDeleted`, `name`, `contactNumber` (unique, sparse), `address`, `NIF`, `currentSessionLocation` (GeoJSON, 2dsphere), `deliveryAddresses[]` (each with `zoneId` → Zone, `addressType`), `referralCode`, `referredBy` (→ Customer, self), `approvedBy`/`rejectedBy`/`blockedBy` (→ Admin), `paymentMethods[]` (masked card metadata only).
Indexes: `{currentSessionLocation: '2dsphere'}`.
Soft delete: yes.
Enums: `AddressType` = PRIMARY|SECONDARY|HOME|OFFICE|OTHER|CURRENT_LOCATION.

### Vendor — `src/app/modules/Vendor/vendor.model.ts`
Shared collection for `VENDOR` (parent) and `SUB_VENDOR` (branch). Fields: `userId` (unique), `registeredBy: {id (refPath registeredBy.model), model: Admin|Vendor}`, `role`, `email` (unique), `status`, `isDeleted`, `isUpdateLocked`, `businessDetails` (`businessType` → BusinessCategory, `restaurantCuisineType[]`, `isHalal`, `openingHours`/`closingHours`/`closingDays`, `isStoreOpen`, `isManualControl`, `storeClosedAt`, `deliveryZoneId` — a plain `String`, **not** an ObjectId ref to Zone, `preparationTimeMinutes`), `businessLocation`, `currentSessionLocation` (GeoJSON), `bankDetails`, `documents`, `rating`, `approvedBy`/`rejectedBy`/`blockedBy` (→ Admin).
Relationships: `registeredBy.id` → Admin or Vendor (self, for branches — this is how a `SUB_VENDOR` links to its parent, see [`../03-modules/vendor-and-branches.md`](../03-modules/vendor-and-branches.md)); `businessDetails.businessType` → BusinessCategory. Virtual populate `cuisinesData` → Cuisine, matched by `slug` (string match, not ObjectId).
Indexes: `{currentSessionLocation: '2dsphere'}`; `{status:1, isDeleted:1, 'businessLocation.latitude':1, 'businessLocation.longitude':1}`.
Soft delete: yes.
Side effects: `post('save')`/`post('findOneAndUpdate')` hooks trigger a Meilisearch resync of the vendor's products.

### FleetManager — `src/app/modules/Fleet-Manager/fleet-manager.model.ts`
Fields: `userId` (unique), `registeredBy` (→ Admin, single ref, not polymorphic), `role`, `email` (unique), `status`, `isDeleted`, `isUpdateLocked`, `businessDetails` (`businessName`, `businessLicenseNumber`, `totalBranches`), `businessLocation`, `bankDetails`, `documents`, `operationalData` (`totalDrivers`, `activeVehicles`, `totalDeliveries`), `approvedBy`/`rejectedBy`/`blockedBy` (→ Admin), `rating`.
Soft delete: yes.

### DeliveryPartner — `src/app/modules/Delivery-Partner/delivery-partner.model.ts`
Fields: `userId` (unique), `registeredBy: {id, model: Admin|FleetManager}` (immutable — records who originally onboarded), `currentFleetManagerId` (→ FleetManager, **mutable**, canonical current assignment — distinct from `registeredBy`), `role`, `email` (unique), `status`, `isDeleted`, `isUpdateLocked`, `personalInfo`, `legalStatus`, `bankDetails`, `vehicleInfo`, `criminalRecord`, `workPreferences`, `operationalData: {currentStatus (IDLE|OFFLINE|ON_DELIVERY), assignmentZoneId → Zone, currentZoneId → Zone, currentOrderId → Order, capacity, isWorking, lastActivityAt, totals}`, `documents`, `approvedBy`/`rejectedBy`/`blockedBy` (→ Admin), `rating`.
Indexes: compound `{isDeleted:1, status:1, 'operationalData.currentStatus':1, currentSessionLocation:'2dsphere'}` (equality fields lead the geo key, for efficient `$geoNear` dispatch search); `{'registeredBy.id':1}`; `{currentFleetManagerId:1}`; `{'rating.average':-1}`.
Soft delete: yes.
Known code issue: `operationalData.assignmentZoneId`/`currentZoneId` exist on the schema but are never populated/read by dispatch logic (aspirational fields, same pattern as `Zone` itself — see [`../03-modules/delivery-and-dispatch.md`](../03-modules/delivery-and-dispatch.md)).

### Product — `src/app/modules/Product/product.model.ts`
Fields: `productId` (unique), `vendorId` (→ Vendor), `sku` (unique), localized `name`/`description`, `isDeleted`, `isApproved`, `approvedBy` (→ Admin), `category` (→ ProductCategory, required, single — must be owned by the product's own vendor; `additionalCategories` was removed 2026-08-29), `subCategory`, `brand`, `variations[]` (embedded, each option with its own `sku`/`price`/`stock`), `addonGroups[]` (→ AddonGroup, many-to-many), `pricing: {taxId → Tax, taxRate, discount, discountType}`, `stock: {quantity, availabilityStatus, hasVariations}` (undefined for RESTAURANT-type vendors — see [`../03-modules/product-and-catalog.md`](../03-modules/product-and-catalog.md)), `images[]`, `rating`, `meta: {isFeatured, status: ACTIVE|INACTIVE|DELETED, origin}`.
Indexes: unique on `productId`, `sku` (schema-level); `{category:1}`.
Soft delete: yes (`isDeleted`), plus a parallel `meta.status` including `DELETED`.
Side effects: `post('save')`/`post('findOneAndUpdate')`/`post('findOneAndDelete')`/`post('deleteOne')` hooks dynamically import and trigger Meilisearch sync.
Virtuals (computed, not stored): `pricing.finalPrice`, `discountAmount`, `taxAmount`, `basePrice`.

### BusinessCategory / Cuisine — `src/app/modules/Category/category.model.ts` (one file, two collections)
- `BusinessCategory`: `name` (localized), `slug` (unique), `icon`, `isActive`, `isDeleted`. In practice exactly two values: `RESTAURANT`/`STORE`. Unique index on `{name.en, name.pt}`.
- `Cuisine`: `name`, `slug` (unique), `imageUrl`, `isActive`, `isDeleted` — a flat, independent tag list (e.g. "Italian"), not linked to BusinessCategory/ProductCategory; used only for `Vendor.businessDetails.restaurantCuisineType`.
Soft delete: yes on both.

### ProductCategory — `src/app/modules/ProductCategory/productCategory.model.ts` (standalone module since 2026-08-29, mounted at `/api/v1/product-categories`)
- **Vendor-owned.** `name` (localized, stored upper-cased), `slug` (derived from `name.en`), `vendorId` (→ Vendor, required — the owner; a SUB_VENDOR branch owns its own), `isActive`, `isDeleted`. No `businessCategoryId` (business type is implied by the owning vendor), no `icon`, and no `description` — just name + slug + active flag (unlike BusinessCategory/Cuisine, which keep an image). Indexes: `{vendorId:1, isActive:1, isDeleted:1}`; **compound-unique** on `{vendorId:1, 'name.en':1}` and `{vendorId:1, slug:1}` (uniqueness is per-vendor, not global). Mongoose model name is still `ProductCategory` (all `ref: 'ProductCategory'` populates unaffected by the module move). Writes are `VENDOR`/`SUB_VENDOR` on their own records only; `ADMIN`/`SUPER_ADMIN` have read-only oversight.
Soft delete: yes.

### AddonGroup — `src/app/modules/Add-Ons/addOns.model.ts`
Fields: `vendorId` (→ Vendor), `title` (localized), `minSelectable`, `maxSelectable`, `options[]` (`name`, `sku`, `price`, `tax` → Tax, `isActive`), `isActive`, `isDeleted`.
Indexes: `{'options.sku':1}` unique+sparse (global uniqueness across all vendors' addon options).
Soft delete: yes.
Note: each addon option carries its own independent `tax` reference, populated live on read — unlike `Product.pricing.taxRate`, which snapshots the rate at write time.

### Tax — `src/app/modules/Tax/tax.model.ts`
Fields: `taxName`/`description` (localized), `taxCode` (`NOR|INT|RED|ISE`), `taxRate` (constrained enum `0|6|13|23` — Portuguese VAT/IVA rates), `countryID` (default `PRT`), `TaxRegionID`, `taxGroupID` (default `IVA`), `taxExemptionCode`, `taxExemptionReason` (localized), `isActive`, `isDeleted`.
Soft delete: yes.
Schema-level compliance rule: `pre('save')`/`pre('findOneAndUpdate')` reject a `taxRate: 0` document unless it has both a non-empty `taxExemptionCode` and a localized `taxExemptionReason` — enforced even against direct DB writes, not just app-layer validation.
Referenced from: `Product.pricing.taxId`, `AddonGroup.options[].tax`, `Ingredient.tax`.

### RestrictedItems — `src/app/modules/RestrictedItems/restrictedItems.model.ts`
Fields: `name`, `reason`, `category` (`TOBACCO|ALCOHOL|ADULT_CONTENT|DANGEROUS_GOODS|OTHER`), `isDeleted`. Standalone — no other collection references it, and no code path (`Product`, `Cart`, `Order`) cross-checks against it. Confirmed unenforced. See [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).

### Ingredient — `src/app/modules/Ingredients/ingredients.model.ts`
Fields: `name`, `category`, `sku` (unique), `price`, `tax` (→ Tax), `unit` (kg|g|litre|ml|piece|packet|box), `stock`, `totalAddedQuantity`, `lowStockAlert` (default 5), `minOrder` (default 1), `image`, `status` (available|out-of-stock), `shelfLifeDays`, `bulkDiscount[]` (`minQty`, `discountPrice`), `isDeleted`.
Indexes: field-level index on `category`; text index on `name`/`description`/`sku`.
Soft delete: yes.

### IngredientOrder — `src/app/modules/Ingredient-Order/ing-order.model.ts`
A B2B side-channel (vendor buys raw ingredients from the platform), separate from the customer-facing Order flow. Fields: `orderId` (unique, sparse), `vendorId` (→ Vendor), `adminId` (→ Admin), `orderDetails[]` (`ingredientId` → Ingredient, price/unit/tax snapshot), `deliveryAddress`, `delivery`, `orderCalculation`, `grandTotal`, `paymentMethod`, `orderStatus` (`PENDING|CONFIRMED|SHIPPED|DELIVERED`, sequential only — no skipping/reversal), `paymentStatus` (`PROCESSING|PAID`), `statusHistory`, `transactionId`, `isDeleted`.
Soft delete: yes — and enforced via a global `pre(/^find/)` query middleware auto-filtering `isDeleted: {$ne: true}` on every find, stronger than most modules' manual-filter pattern.

### Cart — `src/app/modules/Cart/cart.model.ts`
One document per customer. Fields: `customerId` (→ Customer), `items[]` (`productId` → Product, `vendorId` → Vendor, `addons[]` with tax snapshot, `isActive`, `lastActivityAt`, `isNotified`), `totalItems`, `totalQuantity`, `cartCalculation`, `isDeleted`.
Soft delete: yes.

### CheckoutSummary — `src/app/modules/Checkout/checkout.model.ts`
The pricing/quoting snapshot between Cart and Order. Fields: `customerId` (→ Customer), `vendorId` (→ Vendor), `fulfillmentType`, `pickupTime`, `items[]` (full pricing/commission/payout snapshot per item, `addons[]`, `offer.offerApplied.bogoSnapshot.productId` → Product), `orderCalculation`, `delivery`, `payoutSummary`, `deliveryAddress`, `paymentStatus`/`paymentMethod`, `transactionId`, `gatewayPaymentToken`, `orderId` (→ Order, set once converted), `isConvertedToOrder`.
Indexes: `{customerId:1, isConvertedToOrder:1}`.
Soft delete: none.

### Order — `src/app/modules/Order/order.model.ts`
The core transaction record. Fields: `orderId` (unique), `customerId` (→ Customer), `vendorId` (→ Vendor), `deliveryPartnerId` (→ DeliveryPartner, nullable), `deliveryPartnerCancelReason`, `fulfillmentType`, `pickup: {code (select:false by default), verifiedBy}`, `deliveryOtp: {code (select:false by default), attempts, verifiedBy}` (DELIVERY orders only — the rider-collected handoff code, generated on `PICKED_UP`), `items[]` (`productId` → Product, full pricing/commission snapshot), `orderCalculation`, `delivery`, `payoutSummary`, `offer.offerApplied`, `paymentMethod`/`paymentStatus`, `transactionId` (unique, sparse), `isPaid`, `orderStatus` (15 states), `statusHistory[]`, `cancelReason`/`rejectReason`, `refundStatus`, `dispatchPartnerPool[]`, `dispatchExpiresAt`, `deliveryAddress` (conditionally required for `DELIVERY` fulfillment via a schema-level validator), `pickupAddress`, `preparationTime`, `ratingStatus`, `isRated`, `invoiceSync` (Pasta Digital fiscal fields: `isSynced`, `invoiceNo`, `atcud`, `signature`), `isDeleted`.
Indexes: `{orderStatus:1, deliveryPartnerId:1, dispatchPartnerPool:1}` partial on `orderStatus:'DISPATCHING'`; `{customerId:1, createdAt:-1}`; `{vendorId:1, 'items.productId':1}`; `{orderStatus:1, dispatchExpiresAt:1}` partial on `DISPATCHING`; `{deliveryPartnerId:1, orderStatus:1, createdAt:-1}`; `{fulfillmentType:1, orderStatus:1, 'pickup.readyAt':1}`; `{'items.productId':1}`; `{createdAt:-1}`.
Soft delete: yes.
**Known schema issue**: `statusHistory[].updatedBy` and `pickup.verifiedBy` ref a `'User'` model name that does not correspond to any actual collection in this codebase — likely a leftover from an earlier unified-user design. Not currently causing errors (populate on this field would simply return nothing), but worth flagging if extending this area.

### Offer — `src/app/modules/Offer/offer.model.ts`
Fields: `title`/`description` (localized), `offerType` (`PERCENT|FLAT|FREE_DELIVERY|BOGO`), `isAutoApply`, `code` (unique+sparse, partial), `adminId` (→ Admin), `isGlobal`, `vendorId` (→ Vendor), `discountValue`, `maxDiscountAmount`, `bogo: {buyProductId → Product, buyCategoryId → ProductCategory, getProductId → Product}`, `validFrom`/`expiresAt`, `minOrderAmount`, `applicableCategories[]` → ProductCategory, `applicableProducts[]` → Product, `maxUsageCount`, `usageCount`, `userUsageLimit`, `perUserUsage` (Map, atomic per-customer redemption counter), `isActive`, `isDeleted`.
Indexes: `{isGlobal:1, isActive:1}`; `{vendorId:1, isActive:1}`; `{code:1, isActive:1}`; `{isActive:1, isDeleted:1, expiresAt:1}`; plus unique+sparse+partial on `code`.
Soft delete: yes.

### Coupon — `src/app/modules/Coupon/coupon.model.ts`
Fields: `userId` (polymorphic `refPath: userModel`), `userModel` (`Customer|Vendor|DeliveryPartner|FleetManager|Admin`), `code` (unique), `type` (`FREE_MEAL|FREE_DELIVERY`), `isUsed`, `expiryDate`, `remarks`.
Indexes: `{userId:1, isUsed:1}`.
No HTTP route surface — model/interface only, written to solely by the Referral flow, and **never read back for redemption anywhere in the codebase**. See [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).

### PaymentToken — `src/app/modules/Payment-Token/payment-token.model.ts`
Fields: `customerId` (→ Customer), `tokenId` (REDUNIQ's token id), `gatewayRef`, `cardBrand` (`VISA|MASTERCARD|AMEX|OTHER`), `last4`, `expiryDate`, `cardHolderName`, `isDefault`, `isActive`. Never stores PAN/CVV.
Indexes: `{customerId:1, tokenId:1}` unique; `{customerId:1, isActive:1}`; `{customerId:1, cardBrand:1, last4:1, expiryDate:1}` unique, partial on `isActive:true` (prevents duplicate active saved-card entries for the same physical card).
Soft delete: soft-disable via `isActive:false`, not a dedicated field.

### Payout — `src/app/modules/Payout/payout.model.ts`
Fields: `payoutId` (unique), `userId` (polymorphic → `Vendor|DeliveryPartner|FleetManager`), `senderId` (polymorphic → `Admin|FleetManager`), `startDate`/`endDate`/`paymentDate`, `amount`, `status` (`PENDING|PROCESSING|PAID`), `paymentMethod` (`BANK_TRANSFER|MOBILE_BANKING|CASH`), `bankDetails`, `bankReferenceId`, `payoutProof`, `remarks`, `failedAt`/`failedReason`, `retryAt`/`retryRemarks`.
Indexes: `{userId:1, status:1}` unique, partial on `status: 'PENDING'` — closes a create-time TOCTOU race so a user can't have two pending payouts simultaneously. `PROCESSING` is deliberately excluded from the partial index (a transient, transaction-scoped state).
Soft delete: none.

### Wallet — `src/app/modules/Wallet/wallet.model.ts`
Fields: `walletId` (unique), `userId` (polymorphic, unique — one wallet per user), `userModel` (`Admin|Customer|Vendor|FleetManager|DeliveryPartner`), `lastSettlementDate`, `currentBalance`, `lockedBalance` (reserved against in-flight payout), `lifetimeEarnings`, `currentTaxLiability`, `lifetimeTaxProcessed`.
Indexes: `userId` unique.
No create/update HTTP endpoints — entirely written to from other modules' service code (primarily the order-completion BullMQ worker) and lazily upserted on first earning. Read-only via REST (`GET /wallets`, `/me`, `/:walletId`).

### DeliGoBalance — `src/app/modules/DeliGo_Balance/deliGoBalance.model.ts`
Fields: `userId` (polymorphic, unique), `userModel` (`Customer|Vendor|DeliveryPartner|FleetManager`), `totalBalance` (min 0), `pendingBalance`, `totalEarned`, `status` (`ACTIVE|SUSPENDED`).
No HTTP surface at all — controller/service are empty files and the route file is not even mounted in `src/app/routes/index.ts`. Written to only by `Referral` (rider welcome bonus, milestone `CASHBACK`/`CREDIT` rewards). No documented relationship to `Wallet`. See [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).

### Points / PointsLog — `src/app/modules/Points/points.model.ts`
- `Points` (running balance): `userId: {id (refPath userId.model), model}`, `currentPoints`, `totalEarned`, `totalSpent`, `expiryDate`. Unique on `{userId.id, userId.model}`.
- `PointsLog` (immutable ledger): `userId`, `points`, `transactionType` (`EARN|REDEEM|REFERRAL_BONUS|REFUND|ADJUSTMENT|FAILED_LOG|OTHER`), `referenceId` (polymorphic per `onModel`), `onModel` (`Order|Referral|RewardClaim` — **`RewardClaim` has no corresponding collection anywhere in the codebase**, an aspirational/unbuilt enum value), `description`.
Indexes: `PointsLog` has `{'userId.id':1, referenceId:1, transactionType:1}` unique, partial on `transactionType:'EARN'` — the actual mechanism preventing double-crediting the same order (an app-level pre-check alone wouldn't close the race).
Soft delete: none.

### Referral — `src/app/modules/Referral/referral.model.ts`
Fields: `referrerId` (polymorphic), `referredId` (polymorphic, unique — each referred user can only be referred once), `referrerModel`/`referredModel` (`Customer|Vendor|DeliveryPartner`), `status` (`PENDING|COMPLETED|EXPIRED`), `remarks`, `isRewardDistributed`, `referenceOrderId` (→ Order), `distributedAt`.
Indexes: `{referrerId:1, status:1}`; `referredId` unique.
Soft delete: none.

### Transaction — `src/app/modules/Transaction/transaction.model.ts`
Immutable financial ledger (no update/delete HTTP surface). Fields: `transactionId` (unique), `orderId` (→ Order, optional), `payoutId` (→ Payout, optional), `userId` (polymorphic → `Customer|Vendor|FleetManager|DeliveryPartner|Admin`), `baseAmount`, `taxAmount`, `totalAmount`, `type` (13 values: `ORDER_PAYMENT, VENDOR_EARNING, FLEET_EARNING, DELIVERY_PARTNER_EARNING, VENDOR_SETTLEMENT, FLEET_SETTLEMENT, DELIVERY_PARTNER_SETTLEMENT, PLATFORM_COMMISSION, INGREDIENT_PURCHASE, REFERRAL_BONUS, PLATFORM_TAX_COLLECTION, PLATFORM_SERVICE_CHARGE, REFUND`), `status` (`PENDING|SUCCESS|FAILED`), `paymentMethod`, `remarks`, `processedBy` (polymorphic → `Admin|FleetManager`).
Indexes: `{userId:1, type:1}`; `{userId:1, createdAt:-1}`; `{userId:1, userModel:1, type:1, status:1, createdAt:-1}`.
Soft delete: none (append-only by design).

### GlobalSettings — `src/app/modules/GlobalSetting/globalSetting.model.ts`
Singleton (`GlobalSettingsSchema.index({}, {unique:true})` — enforces exactly one document ever). Sections: `delivery` (`baseCharge`, `chargePerKm`, `minCharge`, `maxCharge`, `freeAbove`, `maxDistanceKm`, `vatRate`), `ingredientsOrder` (`deliveryChargeInsideLisbon`, `deliveryChargeOutsideLisbon`, `vatRate`), `commission` (`platformPercent`, `platformVatRate`, `fleetManagerPercent`, `serviceCharge`), `order` (`nearestVendorRadiusKm`, `cancelTimeLimitMinutes`), `rewards` (`customerPointsPerEuro`, `riderPointsPerDelivery`, `referralPoints`, `newRiderWelcomeBonus`, `pointsExpiryDays`, `customerReferralMilestones[]`), `payout` (`autoGenerate`, `payoutDays[]`, `minPayoutAmount`, `payoutWindowDays`), `agreement` (`deligoSignatureUrl`, `deligoSignatoryName`, `deligoSignatoryRole` — the default DeliGo signatory applied to every Vendor Agreement's DeliGo signature slot, see [`../03-modules/vendor-agreement.md`](../03-modules/vendor-agreement.md)), `meta.updatedBy` (→ Admin).
**Known interface/schema drift**: `globalSetting.interface.ts` (`TGlobalSettings`) omits `delivery.minCharge/maxCharge/freeAbove/maxDistanceKm` and `ingredientsOrder.vatRate`, all of which exist and are actively used in the actual Mongoose schema — TypeScript consumers of the interface have no compile-time visibility into these real fields.

### Zone — `src/app/modules/Zone/zone.model.ts`
Fields: `zoneId` (unique), `district`, `zoneName`, `boundary` (GeoJSON Polygon, required), `isOperational`, `minDeliveryFee` (default 2.0), `maxDeliveryDistanceKm` (default 7.0), `isDeleted`.
Indexes: `{boundary: '2dsphere'}`.
Soft delete: yes.
Confirmed disconnected: `minDeliveryFee`/`maxDeliveryDistanceKm` exist but are not consulted by checkout or dispatch code anywhere in the codebase — Zone is a pure geofencing/admin catalog with no live pricing or dispatch consumer. See [`../03-modules/delivery-and-dispatch.md`](../03-modules/delivery-and-dispatch.md).

### Rating — `src/app/modules/Rating/rating.model.ts`
Fields: `ratingType` (`DELIVERY_PARTNER|PRODUCT|VENDOR`), `rating` (1-5), `sentiment` (auto-computed pre-save), `review`, `reviewerId`/`reviewerModel` (polymorphic → `Customer|Vendor|DeliveryPartner`), `targetId`/`targetModel` (polymorphic → `Customer|Vendor|DeliveryPartner|Product`), `productId` (→ Product, optional secondary ref), `orderId` (→ Order, required), `subRatings` (`foodQuality`, `packaging`, `deliverySpeed`, `riderBehavior`), `tags[]`.
Indexes: field-level on `ratingType`, `sentiment`, `orderId`; compound `{targetId:1, ratingType:1}` and `{createdAt:-1}`.
Soft delete: none.
No DB-level duplicate guard for one-rating-per-order-per-reviewer — enforced only by an app-level pre-check, unlike Payout/PointsLog's partial unique indexes.

### Notification — `src/app/modules/Notification/notification.model.ts`
Fields: `receiverId` (plain string, not an ObjectId ref), `receiverRole`, `title`, `message`, `data` (Mixed), `type` (`ORDER, OFFER, SYSTEM, PAYOUT, ACCOUNT, PAYOUT_ALERT, TRANSACTION, PROMOTIONAL, STOCK_ALERT, OTHER`), `isRead`, `isDeleted`.
Soft delete: yes.

### Sos — `src/app/modules/Sos/sos.model.ts`
Fields: `userId: {id (polymorphic), model: Vendor|FleetManager|DeliveryPartner}`, `orderId` (→ Order, nullable), `role`, `status` (`ACTIVE|INVESTIGATING|RESOLVED|FALSE_ALARM`), `userNote` (max 200 chars), `issueTags[]` (`Accident|Medical Emergency|Fire|Crime|Natural Disaster|Other`), `location` (GeoJSON Point, required), `deviceSnapshot`, `resolvedBy` (→ Admin), `resolvedAt`.
Indexes: `{location: '2dsphere'}`.
Soft delete: none. `RESOLVED` status is terminal/locked.

### SupportTicket / SupportMessage / Counter — `src/app/modules/Support/support.model.ts`
- `SupportTicket`: `ticketId` (unique), `userId`/`userModel` (polymorphic → `Admin|Customer|Vendor|FleetManager|DeliveryPartner`), `activeHandler` (`AI|AGENT|NONE`, defaults `AI`), `assignedAdminId` (→ Admin), `status` (`OPEN|IN_PROGRESS|CLOSED`), `category` (`ORDER_ISSUE|PAYMENT|IVA_INVOICE|TECHNICAL|GENERAL`), `referenceOrderId` (→ Order), `lastMessage`/`lastMessageSender`/`lastMessageTime`, `unreadCount` (Map), `closedAt`/`closedBy` (→ Admin).
- `SupportMessage`: `ticketId` (string — a value match against `SupportTicket.ticketId`, not a Mongoose ref), `senderId` (string), `senderRole`, `message`, `messageType` (`TEXT|IMAGE|AUDIO|LOCATION|SYSTEM`), `attachments[]`, `readBy` (Map).
- `Counter`: generic auto-increment sequence helper (`id`, `seq`), not itself a business entity.
Soft delete: none on any of the three.
Note: `activeHandler: 'AI'` and a typed `aiMetadata` field are unimplemented scaffolding — no code anywhere performs automated/AI ticket handling; a ticket simply waits until a human admin's first reply flips it to `AGENT`.

### LoginHistory — `src/app/modules/LoginHistory/loginHistory.model.ts`
Fields: `userId` (→ AuthUser, optional — allows failed-login records with no resolved user), `email`, `userRole`, `ipAddress`, `city`/`country` (schema fields exist but are never populated — hardcoded `'Unknown'`, no geo-IP lookup implemented), `deviceType`, `browser` (in practice just echoes the client-supplied device name, not real UA parsing), `os` (hardcoded `'Unknown'` at every call site — no real OS detection implemented), `userAgent`, `status` (`SUCCESS|FAILED`), `failureReason`, `sessionId`, `loginAt`, `logoutAt`, `durationSec`.
Indexes: `{email:1, loginAt:-1}`; `{userId:1}`; `{sessionId:1}`.
Soft delete: none. Retention: indefinite (no TTL index).

### ActivityLog — `src/app/modules/ActivityLog/activityLog.model.ts`
Fields: `authUserId` (→ AuthUser), `userName`, `email`, `role`, `action`, `target`, `type` (`INFO|WARNING|DANGER`).
No indexes beyond default. Soft delete: none. Retention: indefinite (no TTL). Writes are fire-and-forget (not awaited by callers).

### ErrorLog — `src/app/modules/ErrorLog/errorLog.schema.ts`
Fields: `message`, `stack`, `statusCode` (default 500), `userId` (plain string, not a ref), `requestDetails: {method, url, frontendUrl, ip, body}` (body redacted for sensitive keys before persisting).
TTL: `createdAt` expires after 30 days.

### RequestLog / EmailLog — `src/app/modules/log/log.model.ts`, `emailLog.model.ts`
- `RequestLog`: `ip`, `method`, `path`, `userAgent`, `headers`, `timestamp` (TTL 7 days). **Confirmed never populated in the running app** — its populating middleware (`logIPToDB`) is commented out in `src/app.ts`. The collection, index, and middleware code all exist correctly; nothing invokes them. See [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).
- `EmailLog`: `to`, `subject`, `status` (`SUCCESS|FAILED`), `providerMessageId`, `providerResponse`, `errorMessage`/`errorCode`/`errorStack`. No TTL — retained indefinitely. Actively written on every outbound email attempt. Uses a defensive `mongoose.models.EmailLog || model(...)` guard, unique among all models in the codebase — suggests a possible duplicate-import risk elsewhere.

### Agreement — `src/app/modules/Agreement/agreement.model.ts`
1:N with Vendor (`vendorId` → Vendor, required — every Vendor gets exactly one `INITIAL_REGISTRATION` agreement plus any number of independent later agreements). Fields: `vendorId`, `agreementType` (backend-owned enum, currently one value: `INITIAL_REGISTRATION`), legal/company snapshot (`establishmentName`, `email`, `contactNumber`, `nif`, `commercialName`, `vatNumber`, `headOfficeAddress`, `zipCode`, `country`, `companyRepresentativeName`/`Role`, `companyIban`, `deligoRepresentativeName`/`Role` — a one-time copy, derived from the Vendor profile at creation for `INITIAL_REGISTRATION`, never a live reference), `draftPdfPath`, `establishmentSignaturePath`, `establishmentSignatureMethod` (`DRAWN|UPLOADED`), `agentSignaturePath` (set only at finalization, from `GlobalSettings.agreement`, never by the Vendor-facing sign step), `signedPdfPath` (regenerated twice — interim then final, overwritten in place), `status` (`UNSIGNED → VENDOR_SIGNED → SIGNED`), `posPaymentOption` (`THREE_INSTALLMENTS|MONTHLY_RENTAL`), `signedAt` (Vendor signed), `deligoSignedAt` (DeliGo signature applied), `emailedAt`, `createdBy` + `createdByModel` (`Admin|Vendor` — a Mongoose `refPath`, since a self-service Vendor can now be the creator, not just an Admin/Commercial).
Indexes: `{vendorId:1, agreementType:1}` unique, partial on `agreementType: 'INITIAL_REGISTRATION'` (at most one per vendor, ever — every other type unlimited); `{vendorId:1, status:1}`; `{vendorId:1, createdAt:-1}`; `{agreementType:1}`; `{status:1}`; `{createdBy:1}`; `{nif:1}`.
Soft delete: none.
Full lifecycle, the Vendor-profile derivation mapping, and the two-stage signing flow: [`../03-modules/vendor-agreement.md`](../03-modules/vendor-agreement.md).

### Sponsorship — `src/app/modules/Sponsorships/sponsorships.model.ts`
Fields: `sponsorName`, `sponsorType` (`Ads|Offer|Other`), `startDate`/`endDate`, `bannerImage`, `url`, `isActive`, `isDeleted`.
Soft delete: yes.

### Permission — `src/app/modules/Permission/permission.model.ts`
Fields: `name`, `action` (unique, enum-constrained to the 14-value catalog — see [`../02-authentication/permissions-and-rbac.md`](../02-authentication/permissions-and-rbac.md)), `module`, `displayName`, `description`, `isSystemDefined`, `isActive`, `createdBy`/`updatedBy` (→ Admin), `isDeleted`.
Note: this is a *catalog/metadata* collection. What's actually enforced at runtime is the flat `Admin.permissions: string[]` array — assigning a permission denormalizes the `action` code onto the target Admin document rather than storing a reference to this collection.

## Validation

Schema-level validators (Mongoose) enforce hard invariants like Tax's zero-rate exemption rule and Order's conditional `deliveryAddress` requirement. Request-shape validation is handled separately by Zod (`*.validation.ts` per module) — see [`../04-api-reference/endpoint-index.md`](../04-api-reference/endpoint-index.md).

## Edge Cases

- Several collections use polymorphic (`refPath`) relationships rather than a fixed `ref` — `.populate()` calls on these fields must specify the path dynamically; a hardcoded `ref` assumption will silently fail to populate for some documents.
- `Order.statusHistory[].updatedBy` / `pickup.verifiedBy` reference a non-existent `'User'` model — populate calls on these fields return nothing.
- `PointsLog.onModel` includes `'RewardClaim'`, a collection that does not exist in this codebase.

## Related Modules

[`relationships.md`](relationships.md) for the full cross-collection diagram; [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md) for the interface/schema drift and dead-field issues noted throughout this document.

## Source References

Every `src/app/modules/*/​*.model.ts` (and `ErrorLog/errorLog.schema.ts`), cross-referenced with the corresponding `*.interface.ts` and `*.constant.ts` files.
