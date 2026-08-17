# Change Log

## Purpose

This log records *notable* changes to the Deligo backend going forward — new features, bug fixes, breaking changes — in a structured, greppable format. It is a curated summary for engineers who need to understand *why* something changed without reading every commit; it is **not** a replacement for Git.

## Source of truth

**Git history remains the source of truth for code changes.** `git log`, `git blame`, and the PR history on GitHub are always authoritative for exactly what changed, when, and by whom. This file exists to add the *why* and the *business context* that a commit message or diff often can't carry on its own — it is a curated index, not a mirror of `git log`.

Do not fabricate historical entries. An entry should only be added here if it can be confirmed against an actual commit, PR, or direct knowledge of the change at the time it happens. Retroactively reconstructing a full history from `git log` was out of scope for the initial documentation pass (see `../DOCUMENTATION-AUDIT.md`) — historical entries below start from the point logging actually began.

## Entries

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
