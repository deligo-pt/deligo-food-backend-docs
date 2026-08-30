# Change Log

## Purpose

This log records *notable* changes to the Deligo backend going forward — new features, bug fixes, breaking changes — in a structured, greppable format. It is a curated summary for engineers who need to understand *why* something changed without reading every commit; it is **not** a replacement for Git.

## Source of truth

**Git history remains the source of truth for code changes.** `git log`, `git blame`, and the PR history on GitHub are always authoritative for exactly what changed, when, and by whom. This file exists to add the *why* and the *business context* that a commit message or diff often can't carry on its own — it is a curated index, not a mirror of `git log`.

Do not fabricate historical entries. An entry should only be added here if it can be confirmed against an actual commit, PR, or direct knowledge of the change at the time it happens. Retroactively reconstructing a full history from `git log` was out of scope for the initial documentation pass (see `../DOCUMENTATION-AUDIT.md`) — historical entries below start from the point logging actually began.

## Entries

### 2026-08-30 — Agreement domain made fully generic/party-agnostic (routes, fields, config-driven behavior)

Module: Agreement, Auth, Vendor, AuthUser
Type: BREAKING_CHANGE
Status: Shipped
Title: Agreement routes, fields, and internal service logic generalized from Vendor-only to a reusable, party-agnostic domain, ahead of adding Fleet Manager (or any future) agreement types. `POST/GET /agreements/vendor/:vendorId` → `POST/GET /agreements/party/:partyId`; `POST /agreements/sign/:agreementId` → `POST /agreements/:agreementId/sign`; `Agreement.vendorId` → `Agreement.partyId` + new `Agreement.partyModel`; `establishmentName`/`companyRepresentative*`/`companyIban`/`agentSignaturePath` → `partyLegalName`/`partyRepresentative*`/`partyIban`/`deligoSignaturePath`; `signatoryType: "VENDOR"` → `"SELF"`. New `agreement.config.ts` (`AGREEMENT_CONFIG`) and `agreement.snapshotBuilders.ts` centralize every per-agreement-type behavior.
Description: Two back-to-back passes, both pre-production so no backward-compatibility shims were kept. Pass 1 (fields): renamed every Vendor-flavored Agreement field to a generic party/DeliGo equivalent and introduced `AGREEMENT_CONFIG` — a registry keyed by `agreementType` declaring each type's party model, PDF template, POS/stamp requirements, singleton-per-party behavior, and whether DeliGo's signature applies immediately on signing or only after a separate admin approval. `createAgreementForVendor`/`getVendorAgreements`/`finalizeInitialAgreementForApprovedVendor` were renamed to `createAgreementForParty`/`getAgreementsForParty`/`finalizeAgreementForApprovedParty`, and every `agreementType === 'INITIAL_VENDOR_AGREEMENT'` branch in `agreement.service.ts` was replaced with a config lookup. Pass 2 (routes): the two remaining Vendor-shaped route paths were renamed to be party-agnostic, and `getAgreementsForParty` — the one function still hardcoding a `Vendor.findOne(...)` lookup, since it spans every agreement type for a party at once and can't derive a party model from a single `agreementType` — now resolves `:partyId` generically via `AuthUser` + the existing `ROLE_COLLECTION_MAP`, the same mechanism `auth.service.ts` already uses elsewhere. The `Vendor` model import was removed from `agreement.service.ts` entirely. No change to the actual Vendor registration→sign→approve→DeliGo-signature→final-PDF→email business flow or its behavior — this was purely an internal/API-shape genericization so that adding Fleet Manager (or POS Device, Addendum, Renewal, ...) later needs only a new `AGREEMENT_TYPE` value, an `AGREEMENT_CONFIG` entry, a snapshot builder if the party model differs, a template, and (for a new self-service role) one role added to the existing `auth(...)` route allowlists — never a new route, a new Agreement field, or new service branching.
Technical Changes:
- Routes (`agreement.route.ts`): `/vendor/:vendorId` (POST + GET) → `/party/:partyId`; `/sign/:agreementId` → `/:agreementId/sign`. `auth(...)` allowlists unchanged (`VENDOR`, `ADMIN`, `SUPER_ADMIN` + `CAN_MANAGE_AGREEMENTS`).
- `agreement.interface.ts`/`.model.ts`: `vendorId` → `partyId` (now `refPath: 'partyModel'` instead of a static `ref: 'Vendor'`) + new required `partyModel: string` field (no Mongoose `enum` restriction, by design — `AGREEMENT_CONFIG` is the single source of truth for valid party models). `establishmentName` → `partyLegalName`; `establishmentSignaturePath/Method/StampPath/SignatoryType` → `partySignaturePath/Method/StampPath/SignatoryType`; `companyRepresentativeName/Role` → `partyRepresentativeName/Role`; `companyIban` → `partyIban`; `agentSignaturePath` → `deligoSignaturePath`. `ESTABLISHMENT_SIGNATORY_TYPE` → `PARTY_SIGNATORY_TYPE` with `VENDOR` renamed to `SELF`; `ESTABLISHMENT_SIGNATURE_METHOD` → `PARTY_SIGNATURE_METHOD`. Unique partial index moved from `{vendorId, agreementType}` to `{partyId, agreementType}` (partial filter still pinned to the literal `INITIAL_VENDOR_AGREEMENT` value — MongoDB partial filters don't support `$in`, so a second singleton-per-party type will need its own index).
- New `agreement.config.ts`: `AGREEMENT_CONFIG` registry (`partyModel`, `partyLookupField`, `selfAccessRole`, `template`, `requiresPosPayment`, `requiresPartyStamp`, `autoDeriveSnapshotFromParty`, `singletonPerParty`, `finalizeOn`, `buildSnapshot`), one entry today (`INITIAL_VENDOR_AGREEMENT`). New `agreement.snapshotBuilders.ts`: `buildVendorAgreementSnapshot` (moved out of the service, unchanged logic) + an unused-today `buildManualAgreementSnapshot` seam for a type that doesn't auto-derive from a party record.
- `agreement.service.ts`: `createAgreementForVendor` → `createAgreementForParty`, now resolves the party model via `mongoose.model(AGREEMENT_CONFIG[agreementType].partyModel)` instead of a hardcoded `Vendor` import. `getVendorAgreements` → `getAgreementsForParty`, rewritten to resolve `:partyId` via `AuthUser.findOne({userId}) → .role/.profileId → ROLE_COLLECTION_MAP[role]` instead of `Vendor.findOne(...)`; the `Vendor` import was removed from this file entirely. `finalizeInitialAgreementForApprovedVendor` → `finalizeAgreementForApprovedParty(partyId, agreementType)`, now generic (caller supplies the type). `assertVendorSelfAccess` → `assertPartySelfAccess(party, currentUser, selfAccessRole)`; `ownershipFilterFor`/`assertOwnership` now derive the relevant role from `AGREEMENT_CONFIG[...].selfAccessRole` (or, for the history endpoint, the resolved party's own role) instead of a literal `'VENDOR'` string.
- `agreement.validation.ts`: request-body fields renamed to match (`partyLegalName`, `partyRepresentativeName/Role`, `partyIban`, `partySignatureMethod`, `partySignature`, `partyStamp`). `createAgreementValidationSchema`'s snapshot-field requiredness now reads `AGREEMENT_CONFIG[agreementType].autoDeriveSnapshotFromParty` instead of comparing against a literal type. `signAgreementValidationSchema`'s `posPaymentOption` is now optional at the schema level (format-checked only when present) — actual requiredness moved to `agreement.service.ts#signAgreement`, driven by `AGREEMENT_CONFIG[...].requiresPosPayment`, since the target Agreement's type isn't known until the service loads it.
- `agreement.pdf.service.ts`: template lookup now reads `AGREEMENT_CONFIG[agreementType].template` instead of its own separate `AGREEMENT_TEMPLATE_MAP`. PDF-data field names renamed to match (`partyLegalName`, `partyRepresentativeName/Role`, `partyIban`, `partySignatoryType`, `deligoSignatoryName/Role`, `deligoSignature`, `deligoStamp`, `partySignature`, `partyStamp`, `partySignedAt`).
- `views/agreement.template.hbs`: every Handlebars variable renamed to match the fields above (`{{establishmentName}}` → `{{partyLegalName}}`, etc.) — legal text/wording/layout unchanged.
- `auth.service.ts`: the two `Agreement.findOne(...)` queries in `submitForApproval`/`approvedOrRejectedUser` updated to `partyId`/`partySignaturePath`; the fire-and-forget finalize call now reads `AgreementService.finalizeAgreementForApprovedParty(submittedProfile._id, AGREEMENT_TYPE.INITIAL_VENDOR_AGREEMENT)`.
- `vendor.service.ts` (`resolveAgreementCoverage`, branch listing's inline equivalent): `Agreement.findOne(...)` queries updated to `partyId`; the Sub-Vendor-facing `coveredByAgreement.vendorId` output field name deliberately **not** renamed (it's a Vendor/Sub-Vendor-only computed field describing "which Vendor's agreement covers you," unrelated to the Agreement module's own generic `partyId`).
- `helpers/sendAgreementSignedEmail.ts` + `views/agreement-signed.template.hbs`: `establishmentName` → `partyLegalName`.
- `openapi.json`: `/agreements/sign/{agreementId}` path key renamed to `/agreements/{agreementId}/sign` (this section of the spec was already stale on other axes — missing the party create/list routes, current field names, and three phantom OTP-flow paths that don't exist in code — out of scope for this pass, flagged for a future dedicated fix).
- `postman/Agreement.postman_collection.json`: fully updated to the new routes/field names; collection/request descriptions now explain that `agreementType` drives `AGREEMENT_CONFIG`-based behavior server-side.
- In-repo `docs/agreement-signing-guide.md`: route strings updated; a superseded-content banner added pointing at this document as the source of truth, since that file's field names predate even the previous entry below and a full rewrite was out of scope here.
Commit: n/a (uncommitted at time of writing)
Pull Request: n/a
Breaking Change: Yes — every route path, most Agreement request/response field names, and the `signatoryType` self-signing value changed. No client was live against these yet (pre-production), so no compatibility shim was added; any in-progress client work must be updated to the new paths/field names in this same entry.
Related Documentation: `../03-modules/vendor-agreement.md` (rewritten with an explicit OLD/NEW evolution section), `../03-modules/admin-and-settings.md`, `../02-authentication/registration-and-onboarding.md`, `../05-data-model/collections-reference.md`, `../04-api-reference/error-codes.md`

### 2026-08-30 — Vendor Agreement hardened: hard approval-ordering gates, optional company stamp, signatory choice moved to Agreement creation, idempotent re-open

Module: Agreement, Auth, GlobalSetting
Type: BREAKING_CHANGE
Status: Shipped
Title: `INITIAL_REGISTRATION` renamed to `INITIAL_VENDOR_AGREEMENT`; `vatNumber` removed; `establishmentStamp` added (optional, always a RustFS URL); `signatoryType` (Vendor vs. Authorized Representative) decided at `POST /agreements/vendor/:vendorId` instead of at signing; re-opening an existing Agreement is now idempotent (200 create/load) instead of a hard `409`; Vendor approval (`PATCH /auth/:userId/approved-rejected-user`) now hard-fails instead of silently degrading when preconditions aren't met; the post-approval PDF/email finalization no longer blocks the approval response.
Description: Building on the 2026-08-26 Agreement rebuild, this pass closed several gaps found in review. (1) The signatory decision — does the Vendor sign personally, or does an Authorized Representative sign on the company's behalf — is now captured once, at Agreement-creation time (`signatoryType`, required), rather than being inferred later; the PDF's "Cargo" (role) row is shown only for the Authorized Representative case. (2) `establishmentStamp` was added as an optional company-stamp image, always submitted as an already-uploaded RustFS URL regardless of how the signature itself was captured. (3) `Número de IVA`/`vatNumber` was removed from the model, validation, and PDF entirely — it was never populated from anywhere. (4) Re-calling `POST /agreements/vendor/:vendorId` for an Agreement that already exists used to `409`; it now returns the existing (or, if still `UNSIGNED` and the signatory choice changed, updated) Agreement instead, removing a class of frontend error-handling that previously had no real recovery path other than falling back to a GET. (5) `PATCH /auth/:userId/approved-rejected-user` previously let a Vendor be approved regardless of submission/signing order, and silently left the Agreement stuck at `VENDOR_SIGNED` forever if the platform-wide DeliGo default signatory wasn't configured — approval would still report success either way. It now hard-fails the approval call itself (`VENDOR_NOT_SUBMITTED_FOR_APPROVAL`, `VENDOR_AGREEMENT_NOT_SIGNED_FOR_APPROVAL`, `DELIGO_DEFAULT_SIGNATORY_NOT_CONFIGURED_FOR_APPROVAL`) before any status changes are made. (6) The PDF-finalization step triggered by a successful approval (Puppeteer render + RustFS upload + email — several seconds of work) was previously awaited inline, making every Vendor approval call slow; it is now fire-and-forget, same best-effort error handling as before, just no longer blocking the HTTP response.
Technical Changes:
- `AGREEMENT_TYPE.INITIAL_REGISTRATION` → `AGREEMENT_TYPE.INITIAL_VENDOR_AGREEMENT` (`agreement.interface.ts`), propagated through every reference across `agreement.service.ts`, `agreement.validation.ts`, `auth.service.ts`.
- `buildInitialAgreementSnapshotFromVendor`: `establishmentName` now derives from `Vendor.name.{firstName,lastName}` (the Vendor's own personal name, not the business name); `commercialName` now derives from `Vendor.businessDetails.businessName` and is required (previously unset, optional). `vatNumber` removed from `TAgreement`, the schema, validation, PDF data, and the Handlebars template.
- `Agreement.establishmentStampPath` (nullable) + `establishmentSignatoryType: 'VENDOR' | 'AUTHORIZED_REPRESENTATIVE'` added to the model. `createAgreementValidationSchema` now always requires `signatoryType`, and requires `companyRepresentativeName`/`companyRepresentativeRole` when it's `AUTHORIZED_REPRESENTATIVE`. `signAgreementValidationSchema`'s `establishmentSignature` branches format by `establishmentSignatureMethod` (base64 for `DRAWN`, a same-bucket RustFS URL for `UPLOADED`); `establishmentStamp` is optional and, when present, always validated as a same-bucket RustFS URL regardless of method.
- `createAgreementForVendor`'s duplicate-key catch: returns the existing Agreement as-is if already signed or if the signatory fields are unchanged; updates `establishmentSignatoryType`/`companyRepresentativeName`/`companyRepresentativeRole` in place and returns the updated document if they changed; only re-throws `409 AGREEMENT_TYPE_ALREADY_EXISTS` for non-`INITIAL_VENDOR_AGREEMENT` types or an unrecoverable lookup failure.
- `GlobalSettings.agreement.deligoCompanyStampUrl` added alongside the existing `deligoSignatureUrl`/`deligoSignatoryName`/`deligoSignatoryRole` (optional — not part of the approval gate below).
- `auth.service.ts#approvedOrRejectedUser`, scoped to `role === 'VENDOR' && targetAuthStatus === 'APPROVED'` only: added three sequential preconditions (`authUser.status === 'SUBMITTED'`; an `Agreement` at `VENDOR_SIGNED` with `posPaymentOption`/`establishmentSignaturePath` set; `GlobalSettings.agreement`'s signature/name/role all set) before the status-change transaction runs. The subsequent call to `AgreementService.finalizeInitialAgreementForApprovedVendor` was changed from `await`ed to fire-and-forget (`.catch(...)` instead of `try { await } catch`) — same best-effort semantics, no longer blocking.
- Three new `auth.messages.ts` keys: `VENDOR_NOT_SUBMITTED_FOR_APPROVAL`, `VENDOR_AGREEMENT_NOT_SIGNED_FOR_APPROVAL`, `DELIGO_DEFAULT_SIGNATORY_NOT_CONFIGURED_FOR_APPROVAL`.
- `views/agreement.template.hbs` / `agreement.pdf.service.ts`: signature/stamp images now fetched and inlined as base64 data-URIs before Handlebars compiles (`resolveImageAsDataUri`) instead of leaving Chromium to fetch them at print time (fixed signatures intermittently rendering blank); running header/footer margins trimmed (32mm/28mm → 19mm/16mm) and section/heading spacing retuned so the document holds a stable 5-page layout with the "Cargo" row conditional on `establishmentSignatoryType` and the "Carimbo da Empresa" row conditional on `establishmentStamp` being present.
Commit: n/a (uncommitted at time of writing)
Pull Request: n/a
Breaking Change: Yes — any client still sending `agreementType: "INITIAL_REGISTRATION"` or reading/writing `vatNumber` will fail (`.strict()` validation / the value is simply never populated); `POST /agreements/vendor/:vendorId` now requires `signatoryType` in the body where it previously took none; re-opening an existing Agreement returns `200` instead of `409`, so any client-side "catch the 409 and GET instead" logic is now dead code (harmless, but no longer exercised); `PATCH /auth/:userId/approved-rejected-user` for a Vendor can now fail with three new `400` codes it previously never returned.
Related Documentation: `../03-modules/vendor-agreement.md`, `../03-modules/admin-and-settings.md`, `../02-authentication/registration-and-onboarding.md`, `../05-data-model/collections-reference.md`, `../04-api-reference/error-codes.md`

### 2026-08-29 — ProductCategory is now vendor-owned; `Product.additionalCategories` removed

Module: Category, ProductCategory, Product, Offer, Vendor, Meilisearch, ActivityLog
Type: BREAKING_CHANGE
Status: Shipped
Title: `ProductCategory` moved from a global admin taxonomy to a per-vendor owned resource (`vendorId`) in its own standalone module at `/api/v1/product-categories`; `Product` now has exactly one `category`, which must belong to the same vendor; `Product.additionalCategories[]` deleted entirely
Description: `ProductCategory` was a platform-wide, admin-curated taxonomy keyed to a `BusinessCategory` (`businessCategoryId`); vendors could only read the slice matching their business type and all writes were `ADMIN`/`SUPER_ADMIN`. It is now vendor-owned: each vendor (a `SUB_VENDOR` branch included, as its own owner) creates, updates, activates/deactivates and deletes its own flat list of categories — these are that vendor's customer-facing product groups. Admins keep read-only oversight of every vendor's categories but cannot mutate them. `BusinessCategory` is unchanged (still admin-managed). A `Product` now carries a single `category` that must be owned by the product's vendor; the additive `additionalCategories[]` multi-tag field (added 2026-08-24) was removed everywhere.
Technical Changes:
- `ProductCategory`: `businessCategoryId` → removed; `vendorId` (required, `ref 'Vendor'`) added. `icon` and `description` fields removed entirely — a ProductCategory is now just a localized `name` + `slug` + `isActive`, so its create/update routes drop `multerUpload`/`parseBody` and take plain JSON (BusinessCategory/Cuisine keep their images). Global unique indexes on `slug` and `name.en` replaced by compound-unique `{vendorId, 'name.en'}` and `{vendorId, slug}`; `{isActive,isDeleted}` widened to `{vendorId,isActive,isDeleted}` — `category.interface.ts`, `category.model.ts`, `category.validation.ts`, `category.route.ts`.
- `productCategory.service.ts` rewritten for ownership: create stamps `vendorId` from the caller (403 `VENDOR_NOT_APPROVED` if not approved) and dedupes `name.en` per-vendor; update/soft-delete/permanent-delete are scoped `{_id, vendorId: caller}` (404 otherwise). `getAllProductCategories`: admin unrestricted (optional `?vendorId=`), vendor → own, **customer → `?vendorId=` required (`400 VENDOR_ID_REQUIRED`)**, active-only. `getAllProductCategoriesPublic` requires `?vendorId=`. `productCategory.messages.ts`: `INVALID_BUSINESS_CATEGORY` removed, `VENDOR_ID_REQUIRED` added.
- Routes: productCategory `POST`/`PATCH`/`DELETE soft-delete`/`DELETE permanent-delete` → `auth('VENDOR','SUB_VENDOR')` (were `ADMIN`/`SUPER_ADMIN`). GET list/single role sets unchanged.
- **Standalone module**: all ProductCategory code was extracted from `src/app/modules/Category/` into its own `src/app/modules/ProductCategory/` module (`productCategory.{interface,model,validation,route,service,controller,messages,constant,utils}.ts`) and mounted at **`/api/v1/product-categories`** instead of `/api/v1/categories/productCategory`. The `ProductCategory` mongoose model name is unchanged, so all `ref: 'ProductCategory'` populates keep working. `Category/` now holds only BusinessCategory + Cuisine; `CategoryValidation` lost its productCategory schemas; `errors/messages.ts` re-points the `productCategoryMessages` import. In-module route paths simplified (`/`, `/:id`, `/open`, `/open/:id`, `/soft-delete/:id`, `/permanent-delete/:id`).
- `Product`: `additionalCategories` removed from `product.interface.ts`, `product.model.ts` (field + `{additionalCategories:1}` index), `product.validation.ts` (create + update). `CreateProductUtils.validateAdditionalCategories`/`assertCategoryBelongsToBusinessType`/`validateCategory` replaced by `validateCategoryOwnership` (category must exist, be live, and `category.vendorId === product's vendor` → `403 CATEGORY_NOT_OWNED_BY_VENDOR`); re-checked in `updateProduct.utils.prepareUpdateData` whenever `category` changes. Message `CATEGORY_NOT_UNDER_BUSINESS_TYPE` → `CATEGORY_NOT_OWNED_BY_VENDOR`.
- `copyProductToBranch`: no longer copies `additionalCategories`; resolves the branch's own category by `slug` and clones the source category under the branch's `vendorId` if absent.
- `?category=<id>` product filters (`product.service.ts`), BOGO `buyCategoryId` (`offer.utils.ts`), customer "browse vendors by category" (`vendor.service.ts`, both twins), and Meilisearch `categoryIds` (`meilisearch.utils.ts`) all match the single `category` field now (no `$or`). `categoryIds` stays an array (length 1) so the Meili filterable attribute/filter are unchanged — existing docs need `npm run meili:migrate`.
- Response localization (`localizeProductData`) and `getPopulateOptions` lost their `additionalCategories` / `productCategoryAdditional` handling; `getOutOfStockAlerts` select/populate trimmed.
- Dead `ActivityAction.MENU_PERMANENTLY_DELETED` / `ActivityEntityType.MENU` constants removed (leftovers from the earlier Menu module removal).
- **In-use guard on delete**: `softDeleteProductCategory` and `permanentDeleteProductCategory` now call `assertNoProductsUnderCategory` — if any non-deleted `Product` has `category` pointing at the target, the delete is refused with `409 PRODUCT_CATEGORY_HAS_PRODUCTS` (new message key). Still no cascade; the vendor must move/delete those products first. `analyticsSecond.service.ts` category populate trimmed (`select: 'name'` — `icon` no longer exists).
Commit: n/a (uncommitted at time of writing)
Pull Request: n/a
Breaking Change: Yes — the productCategory endpoints moved from `/api/v1/categories/productCategory/*` to `/api/v1/product-categories/*` (path segment `productCategory` dropped); `businessCategoryId`, `icon`/`file` and `description` are no longer accepted on productCategory create/update (now plain JSON, not multipart); productCategory writes now require a `VENDOR`/`SUB_VENDOR` token (admin writes return 403); customer/public productCategory listing requires `?vendorId=`; any client sending `additionalCategories` on a product payload will get a `.strict()` 400. Existing `ProductCategory` documents have no `vendorId` and must be reseeded per-vendor (no migration was run — test-development data treated as disposable).
Related Documentation: `../03-modules/product-and-catalog.md`, `../03-modules/vendor-and-branches.md`, `../03-modules/cart-checkout-order.md`, `../05-data-model/collections-reference.md`, `../05-data-model/relationships.md`, `../06-integrations/external-services.md`, `../04-api-reference/endpoint-index.md`, `../10-decision-log/README.md`

### 2026-08-26 — Vendor Agreement rebuilt as a 1:N, two-stage-signed step inside the existing Vendor Registration flow

Module: Agreement, Auth, Vendor, GlobalSetting
Type: BREAKING_CHANGE
Status: Shipped
Title: Agreement is now `Vendor.vendorId`-linked (1:N), created lazily inside registration/onboarding, auto-derived from the Vendor profile, and signed in two stages (Vendor, then a global default DeliGo signatory)
Description: The Agreement module previously described in some documents (a standalone, OTP-verified, 1:1-with-Vendor flow keyed on a manually-entered `agreementCode`/unique `email`, with its own `PENDING_VERIFICATION → VERIFIED → DRAFT → SIGNED → EMAILED` lifecycle) has been fully replaced. A Vendor now has a 1:N relationship with Agreement (`Agreement.vendorId → Vendor._id`) — one mandatory `INITIAL_REGISTRATION` agreement, plus any number of independent later agreements. The Agreement step is inserted into the *existing, unchanged* Vendor Registration/Onboarding flow (email+password → OTP → details update → documents update → **Agreement step** → submit → admin approval) rather than being a separate flow, and it is created lazily when the step is opened — never eagerly at registration/onboarding start. Opening it takes no legal/company form fields: the entire snapshot is derived server-side from the Vendor's own already-submitted profile. The only two inputs actually collected at this step are the POS payment option and the Vendor's signature (drawn or uploaded). Signing itself is two-stage: the Vendor signs first (`VENDOR_SIGNED`), then, on Vendor approval, a single global default DeliGo authorized signatory (configured once in `GlobalSettings`, never derived from whichever Admin approves) is applied and the final PDF is generated and emailed (`SIGNED`).
Technical Changes:
- `Agreement.vendorId` (required, 1:N), `agreementType` (backend-owned enum), `status: UNSIGNED → VENDOR_SIGNED → SIGNED` replace the old 1:1/`agreementCode`/5-state model. `createdBy` is now a `refPath` (`createdByModel: Admin|Vendor`) — a self-service Vendor can create/own their own Agreement, not just an Admin.
- `buildInitialAgreementSnapshotFromVendor` (`agreement.service.ts`) derives `establishmentName`/`nif`/`contactNumber`/`email`/`headOfficeAddress`/`zipCode`/`country`/`companyIban`/`companyRepresentativeName` from `Vendor.businessDetails`/`contactNumber`/`email`/`businessLocation`/`bankDetails`/`name` at creation time only (a one-time copy, never a live reference). `400 VENDOR_PROFILE_INCOMPLETE_FOR_AGREEMENT` if the Vendor's Details-update step wasn't completed first.
- `establishmentSignatureMethod: DRAWN | UPLOADED` added — both send the same base64 data-URI field (`establishmentSignature`), so there is no way to submit two signatures; validated up to 5MB, PNG/JPG/JPEG/WEBP.
- `GlobalSettings.agreement.{deligoSignatureUrl, deligoSignatoryName, deligoSignatoryRole}` — the one global default DeliGo signatory, reusing the existing platform-wide settings singleton rather than a new collection.
- `POST /agreements/vendor/:vendorId`, `GET /agreements/vendor/:vendorId`, `POST /agreements/sign/:agreementId`, `GET /agreements/:agreementId` now admit `VENDOR` as a caller (self-service), scoped server-side to the caller's own account (`assertVendorSelfAccess`/`assertOwnership` in `agreement.service.ts`) — previously `ADMIN`/`SUPER_ADMIN`-only.
- `Auth.onboardUser`/`registerOnboardingValidationSchema` no longer create an Agreement or accept its legal/company fields — fully decoupled from Vendor account creation. `Auth.submitForApproval` (for `role: VENDOR` only) gates on `Agreement.status: VENDOR_SIGNED` + a selected POS option; `Auth`'s approval hook triggers Agreement finalization (best-effort, non-blocking).
- Removed entirely: `agreementCode` and its generator, `Agreement.email` uniqueness, `isEmailVerified`/`emailVerifiedAt` on Agreement, the Agreement-specific OTP flow (`/initiate`, `/verify-otp`, `/resend-otp`), `getAgreementByCode`.
Commit: n/a (uncommitted at time of writing)
Pull Request: n/a
Breaking Change: Yes — any client integrated against the old `/agreements/initiate`/`/verify-otp`/`/resend-otp`/`agreementCode` flow, or against `Vendor.agreementId`, will fail entirely; those endpoints and fields no longer exist. `POST /auth/register/onboard` for `role: VENDOR` no longer accepts or requires Agreement snapshot fields in its body.
Related Documentation: `../03-modules/vendor-agreement.md` (new), `../02-authentication/registration-and-onboarding.md`, `../03-modules/vendor-and-branches.md`, `../03-modules/admin-and-settings.md`, `../05-data-model/collections-reference.md`, `../05-data-model/relationships.md`, `../04-api-reference/endpoint-index.md`, `../04-api-reference/error-codes.md`, `../01-overview/role-model.md`, `../10-decision-log/README.md`

### 2026-08-24 — Products can now be tagged into additional categories, on top of one required primary category

Module: Product, Offer, Vendor, Meilisearch
Type: FEATURE
Status: Shipped
Title: `Product.additionalCategories[]` added for multi-category discoverability, alongside the unchanged required `category` field
Description: Previously a product had exactly one category (`Product.category`, required `ProductCategory` ref) and was only discoverable/filterable/BOGO-matchable under that single category. Vendors can now optionally tag a product into up to 5 additional categories (e.g. primary `Burgers` + additional `[Combos, Meals]`) to improve browse/search discoverability, while the primary `category` stays the required field driving SKU generation and the `copy-to-branch` business-type check.
Technical Changes:
- Added `Product.additionalCategories: ProductCategory[]` (optional, default `[]`, max 5, same business-type rule as `category`) — `product.interface.ts`, `product.model.ts` (+ new indexes on `category` and `additionalCategories`), `product.validation.ts`.
- `CreateProductUtils.validateAdditionalCategories` (`createProduct.utils.ts`) validates existence, business-type match, and dedupes against the primary category and itself; reused by `updateProduct.utils.ts`'s `prepareUpdateData` for updates.
- `copyProductToBranch` copies `additionalCategories` too, re-validated against the **target** branch's business type; entries that don't match are dropped silently rather than blocking the copy (unlike the primary `category`, which still hard-fails the whole copy).
- `GET /products` / `GET /products/open` `?category=<id>` filter, BOGO's `buyCategoryId` trigger (`Offer/offer.utils.ts`), and the customer "browse vendors by category" filter + per-vendor category badges (`Vendor/vendor.service.ts`, both `getAllVendorsForCustomer` and its `...Public` twin) now all match a product's primary category **OR** any additional category (`$or`), not primary only.
- Meilisearch: new `categoryIds` filterable field (primary + all additional ids, `buildFoodSearchDocument` in `meilisearch.utils.ts`) added to `FOOD_INDEX_SETTINGS.filterableAttributes`; `GET /search` gained a new `?category=<id>` query param wired through `meilisearch.controller.ts` → `meilisearch.service.ts`.
- Response localization (`localizeProductData`, `product.utils.ts`) and all `category` populate call sites extended to also populate/localize `additionalCategories`.
- Deliberately **not** extended: Analytics "popular category" / category-performance aggregations (`Analytics/analytics.service.ts`, `analyticsSecond.service.ts`) — still `$lookup` on primary `category` only. See Decision Log.
Commit: n/a (uncommitted at time of writing)
Pull Request: n/a
Breaking Change: No — `category` is unchanged (still required, same shape); `additionalCategories` is purely additive and optional on both create and update payloads. Existing clients that never send it are unaffected.
Related Documentation: `../03-modules/product-and-catalog.md`, `../03-modules/cart-checkout-order.md`, `../03-modules/vendor-and-branches.md`, `../05-data-model/collections-reference.md`, `../05-data-model/relationships.md`, `../06-integrations/external-services.md`, `../10-decision-log/README.md`

### 2026-08-20 — Delivery handoff now requires a customer-supplied OTP, replacing the proof-photo requirement

Module: Order
Type: BREAKING_CHANGE
Status: Shipped
Title: Delivery-partner `DELIVERED` transition gated on a rider-entered OTP instead of `deliveryProofImage`
Description: Previously, a delivery partner could mark a `DELIVERY`-fulfillment order `DELIVERED` by uploading any photo as "proof" — no check that the order actually reached the intended customer. This is replaced with a handoff OTP, mirroring the existing self-pickup counter-code pattern: a 6-digit code is generated and pushed to the customer when the rider transitions the order to `PICKED_UP`; the customer reads it off the push notification (or `GET /:orderId`) and hands it to the rider on arrival; the rider must submit the matching code to complete the `DELIVERED` transition. `deliveryProofImage` was removed entirely — the schema field and the requirement no longer exist.
Technical Changes:
- Added `deliveryOtp: {code (select:false), generatedAt, attempts, verifiedAt, verifiedBy}` to the `Order` schema (`order.model.ts`, `order.interface.ts`).
- `generateDeliveryOtp()` (`order.utils.ts`) — 6-digit code via `crypto.randomInt`, same generation approach as the existing `generatePickupCode()`.
- `updateOrderStatusByDeliveryPartner` (`order.service.ts`): on `PICKED_UP`, generates and stores the OTP, then pushes `DELIVERY_OTP_TO_CUSTOMER` to the customer; on `DELIVERED`, verifies the submitted `otp` against the stored code *before* the status write and before the `orderQueue` payout/wallet side effects fire — wrong code increments `deliveryOtp.attempts` and throws `401 INVALID_DELIVERY_OTP`; 5th wrong attempt throws `403 DELIVERY_OTP_MAX_ATTEMPTS_EXCEEDED`; no OTP ever generated throws `400 DELIVERY_OTP_NOT_GENERATED`.
- `order.validation.ts`: `updateOrderStatusByDeliveryPartnerValidationSchema` now requires a 6-digit `otp` (not `deliveryProofImage`) when `orderStatus: "DELIVERED"`.
- `getSingleOrder` re-selects `+deliveryOtp.code` for the order's own customer, same as it already does for `pickup.code`.
- Removed `delivery.deliveryProofImage` from the `Order` schema/interface and the now-dead `DELIVERY_PROOF_IMAGE_REQUIRED` message key.
Commit: `deligo-food-delivery-server@8bcd1930`
Pull Request: n/a
Breaking Change: Yes — `PATCH /orders/:orderId/update-order-status` with `orderStatus: "DELIVERED"` now requires `otp` and no longer accepts/needs `deliveryProofImage`; any rider-app client still sending only `deliveryProofImage` will fail validation. No delivery-completion photo is captured or stored anymore.
Related Documentation: `../03-modules/cart-checkout-order.md`, `../04-api-reference/error-codes.md`, `../05-data-model/collections-reference.md`, `../10-decision-log/README.md`

### 2026-08-17 — Documentation split into its own repository

Module: Documentation / Repository Structure
Type: REFACTOR
Status: Shipped
Title: `deligo-docs` moved out of the backend repository into `deligo-food-backend-docs`
Description: This documentation set was originally generated inside `deligo-food-delivery-server` under a `deligo-docs/` directory. It has been split into its own repository (`deligo-food-backend-docs`) so the docs can be versioned, reviewed, and shared independently of backend application code. No documentation content changed as part of the split — file contents are unchanged; only their location moved.
Technical Changes:
- All 28 files copied from `deligo-food-delivery-server/deligo-docs/` to the root of this repository, preserving directory structure.
- `deligo-food-delivery-server` commit `a26432fb` ("Remove outdated documentation files: environment variables, technical debt, change log, decision log, and documentation audit") deleted the in-repo `deligo-docs/` copy, completing the split — despite its message, this commit removed *duplicated* files, not outdated content; the backend repository's `docs/` directory (the original hand-written integration guides and `architecture-audit.md`) was not touched and remains in place.
- Self-referential paths that assumed co-location inside the backend repo were corrected in `README.md` and this file.
Commit: `deligo-food-delivery-server@a26432fb`
Pull Request: n/a
Breaking Change: No — no documentation content changed, only its repository location. Any external link or tooling that referenced `deligo-food-delivery-server/deligo-docs/...` directly will need to be updated to point at this repository instead.
Related Documentation: `README.md`

### 2026-08-17 — Fixed broken image uploads on Admin, Category, Delivery-Partner, Payout, and Sponsorships endpoints

Module: Admin, Category (Business/Product/Cuisine), Delivery-Partner, Payout, Sponsorships
Type: BUG_FIX
Status: Shipped
Title: Seven controllers now upload files to RustFS instead of persisting an unpopulated local path
Description: `multerUpload` (`src/app/config/multer.config.ts`) is configured with `multer.memoryStorage()`, which never populates `file.path` — only `file.buffer`. Seven upload-handling controllers were nonetheless reading `file?.path` and persisting that (`undefined`) as the stored image/document reference, so files submitted through these endpoints were never actually written to RustFS and no usable URL was saved. A new `resolveUploadedImageUrl` helper (`src/app/utils/storage.ts`) wraps the existing `uploadAndOptimizeImage` call and is now used in all seven call sites instead.
Technical Changes:
- Added `resolveUploadedImageUrl(file)` to `src/app/utils/storage.ts` — uploads `file.buffer` to RustFS via `uploadAndOptimizeImage` and returns the resulting URL, or `null`/`undefined` if no file was attached.
- `Admin.adminDocImageUpload`, `Delivery-Partner.deliveryPartnerDocImageUpload` — doc-image upload now resolves and persists a real RustFS URL.
- `Category.businessCategory` (`createBusinessCategory`, `updateBusinessCategory`), `Category.productCategory` (`createProductCategory`, `updateProductCategory`), `Category.cuisineCategory` (`createCuisine`, `updateCuisine`) — category images now upload correctly instead of storing an undefined path.
- `Payout.finalizeSettlement` — `payoutProof` now resolves to an actual uploaded URL.
- `Sponsorships` (`createSponsorship`, `updateSponsorship`) — `bannerImage` now resolves to an actual uploaded URL.
Commit: `deligo-food-delivery-server@e6d2e719`
Pull Request: n/a
Breaking Change: No — corrects broken behavior; no API shape change. Any records created through these endpoints prior to this fix will have an empty/undefined image reference and are not backfilled by this change.
Related Documentation: `../06-integrations/external-services.md`

## Entry format

Add one entry per notable change, newest first, using this template:

```markdown
### YYYY-MM-DD — <Short Title>

Module: <e.g. Order, Vendor, Auth>
Type: FEATURE | BUG_FIX | CHANGE | REFACTOR | SECURITY | BREAKING_CHANGE
Status: Shipped | In Progress | Reverted
Title: <one-line summary>
Description: <1-3 sentences — what changed and why, in plain language>
Technical Changes:
- <bullet list of the actual code/schema/API changes>
Commit: <commit SHA or range>
Pull Request: <PR link or number, if applicable>
Breaking Change: Yes/No — if yes, describe the migration/compatibility impact
Related Documentation: <links to affected deligo-docs pages>
```

## Allowed `Type` values

| Type | Meaning |
|---|---|
| `FEATURE` | New capability that didn't exist before |
| `BUG_FIX` | Corrects incorrect behavior |
| `CHANGE` | Behavior change that isn't strictly a bug fix (e.g. a business rule adjustment) |
| `REFACTOR` | No behavior change, internal code structure only |
| `SECURITY` | Fixes or hardens a security-relevant issue |
| `BREAKING_CHANGE` | Changes an existing API/contract in a way that requires consumers to update |

## Guidance for contributors

- Log changes at merge time, not months later — accuracy degrades fast otherwise.
- Prefer linking to the PR over duplicating its full description here.
- If a change touches a documented module (see `03-modules/`), update that module's doc *and* add a change-log entry — the module doc says "what is true now," this log says "what changed and when."
- Do not log purely cosmetic changes (formatting, comments, dependency bumps with no behavior change) unless they fix a real problem worth remembering.
