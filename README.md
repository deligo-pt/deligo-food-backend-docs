# Deligo Backend — Engineering Knowledge Base

## What this is

This is the internal engineering documentation for the Deligo food-delivery marketplace backend (`deligo-food-delivery-server`) — a Node.js/Express/TypeScript/MongoDB monolith. It's written for a backend developer joining the project who needs to understand what the system does, how it's built, and where its rough edges are, without having to reverse-engineer all of it from source alone.

This documentation lives in its own repository, `deligo-food-backend-docs`, separate from the `deligo-food-delivery-server` backend repository it describes. It was originally generated inside the backend repository and later split out; the backend repo no longer carries a copy.

## What it documents

- The overall architecture, module layout, and request lifecycle
- The 7-role account/authorization system, including a two-tier credentials/profile identity model
- Every major business module (vendor/branches, catalog, cart/checkout/order, delivery dispatch, payments/payouts, loyalty/referrals, support/safety, admin/settings)
- The full HTTP API surface and the centralized error/message system
- The MongoDB data model and cross-collection relationships
- External integrations (payment gateway, fiscal e-invoicing, push, email, SMS, maps, social login, search, storage)
- Deployment (three coexisting paths), cron jobs, and background queues
- Known technical debt, incomplete modules, and business-rule inconsistencies — confirmed, not speculative

## How it's organized

```
deligo-food-backend-docs/    (this repository's root)
├── 01-overview/          Start here — architecture, roles, glossary
├── 02-authentication/    Registration, login, sessions/tokens, RBAC
├── 03-modules/           One document per business domain, grouped by responsibility
├── 04-api-reference/     Full endpoint index + error/message-key reference
├── 05-data-model/        MongoDB collections and their relationships
├── 06-integrations/      External services — what, where, and failure behavior
├── 07-operations/        Environment variables, deployment, cron/background jobs
├── 08-known-gaps/        Confirmed technical debt, incomplete features, inconsistencies
├── 09-change-log/        Convention for logging future changes (empty until used)
└── 10-decision-log/      Convention for recording future architectural decisions (empty until used)
```

## How to navigate it

- **New to the codebase?** Read `01-overview/architecture-overview.md`, then `01-overview/role-model.md`, then skim `01-overview/glossary.md`.
- **Building against the API?** `04-api-reference/endpoint-index.md` for routes, `04-api-reference/error-codes.md` for what can go wrong.
- **Working on a specific feature?** Go straight to the relevant `03-modules/` document — each one cross-links to the auth, data-model, and integration docs it depends on.
- **Deploying or configuring the app?** `07-operations/` covers environment variables, all three deployment paths, and scheduled jobs.
- **Wondering "is this actually a bug or intentional?"** Check `08-known-gaps/technical-debt-and-todos.md` first — many surprising behaviors are already documented there with evidence.

## Documentation conventions

Every technical document follows the same section structure where applicable (Overview, Purpose, Architecture/Flow, Business Rules, API/Technical Details, Database Impact, Validation, Authorization, Edge Cases, Related Modules, Source References) — simple documents (like this one, or the change-log/decision-log conventions) omit sections that don't apply rather than forcing them. Mermaid diagrams are used for flows, dispatch mechanics, and relationships where a picture clarifies faster than prose.

Every non-trivial technical claim cites the actual repository file(s) it was verified against. Where a claim from the original architecture audit (`docs/architecture-audit.md`) could not be independently confirmed against current source, or where current code has diverged from an existing guide, that is called out explicitly rather than silently repeated.

## Change Log convention

See `09-change-log/README.md`. Going forward, notable changes (features, fixes, breaking changes) should be logged there in a structured format — **Git history remains the source of truth for what actually changed**; the change log exists to capture the "why" that a commit message alone often doesn't carry. No historical entries have been backfilled — this pass did not reconstruct history that couldn't be directly confirmed at documentation time.

## Decision Log convention

See `10-decision-log/README.md`. Going forward, significant architectural or business-rule decisions should be recorded there with context, alternatives considered, and consequences. No historical decision records have been fabricated — where this documentation set describes an architectural pattern (e.g. why a branch is modeled as a `Vendor` with `role: SUB_VENDOR`) without a confirmable rationale behind it, it is presented as **observed architecture**, not as a documented decision.

## Source-of-truth rules

- **The codebase is the primary source of truth.** Every claim in this documentation set was verified against actual source files at the time of writing (branch `test-development`), not assumed from the pre-existing architecture audit or prior guides.
- **`docs/architecture-audit.md`** (a prior read-only audit) was used as a planning baseline and cross-checked, not blindly trusted — several of its claims were independently re-verified, and a small number of discrepancies/refinements were found and are called out in the relevant module documents and in `08-known-gaps/technical-debt-and-todos.md`.
- **Five existing hand-written guides** in `docs/` (`order-flow-guide.md`, `vendor-branch-flow-guide.md`, `offers-integration-guide.md`, `customer-social-login-guide.md`, `deployment-guide.md`) were read in full and their content was integrated into this structure rather than rewritten from scratch — they were already high-quality, audience-targeted references. One stale claim was found and corrected (`cart-checkout-order.md`'s note on the auto-no-show cron, which shipped after `order-flow-guide.md` was written).
- **Anything that could not be confirmed from the current codebase is stated explicitly as such**, rather than inferred or invented. Search for "Not confirmed from the current codebase" or similar phrasing throughout this documentation set for those instances.
- **This documentation does not modify, and was never intended to modify, the Deligo backend source code.** It lives in this standalone repository (`deligo-food-backend-docs`), not inside `deligo-food-delivery-server` — see the Change Log (`09-change-log/README.md`) for when and how the split happened.

See `DOCUMENTATION-AUDIT.md` (this directory's sibling) for the full generation audit — files produced, source areas inspected, and items flagged for human review.
