# Change Log

## Purpose

This log records *notable* changes to the Deligo backend going forward — new features, bug fixes, breaking changes — in a structured, greppable format. It is a curated summary for engineers who need to understand *why* something changed without reading every commit; it is **not** a replacement for Git.

## Source of truth

**Git history remains the source of truth for code changes.** `git log`, `git blame`, and the PR history on GitHub are always authoritative for exactly what changed, when, and by whom. This file exists to add the *why* and the *business context* that a commit message or diff often can't carry on its own — it is a curated index, not a mirror of `git log`.

Do not fabricate historical entries. An entry should only be added here if it can be confirmed against an actual commit, PR, or direct knowledge of the change at the time it happens. This document currently contains **no historical entries** — retroactively reconstructing a full history from `git log` was out of scope for the initial documentation pass (see `deligo-docs/DOCUMENTATION-AUDIT.md`). Start logging from here forward.

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
