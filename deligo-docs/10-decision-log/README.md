# Decision Log

## Purpose

This log records significant architectural and business-rule decisions for the Deligo backend — not just *what* was built, but *why* one approach was chosen over the alternatives. It exists so a future engineer questioning "why is this built this way?" can find the reasoning instead of re-deriving or re-litigating it.

## Source of truth and honesty rule

**Do not fabricate historical decisions.** A decision record should only be created when the context, problem, and reasoning can be confirmed — either directly from the person who made the call, from a PR/commit description that explains the reasoning, or from direct project knowledge at the time of the decision. If the *reasoning* behind an existing piece of architecture cannot be confirmed (only the resulting code can be observed), do not write a decision record asserting a rationale — instead note the observation in `08-known-gaps/technical-debt-and-todos.md` or the relevant module doc as "design as observed, rationale not confirmed."

This document currently contains **no historical decision records** — reconstructing rationale retroactively for existing architecture (e.g. why `AuthUser`/profile is two-tier, why a branch is modeled as a `Vendor` with `role: SUB_VENDOR` rather than a dedicated `Branch` model) was out of scope for the initial documentation pass, since the actual motivations were not available to confirm. Some of these are documented as *observed architecture* in `03-modules/vendor-and-branches.md` and `01-overview/architecture-overview.md` without claiming a decision rationale. Start logging confirmed decisions from here forward.

## Entry format

Add one entry per decision, in its own dated section:

```markdown
### YYYY-MM-DD — <Decision Title>

Status: Proposed | Accepted | Superseded by <link> | Deprecated
Context: <what situation prompted this decision>
Problem: <the specific question/tension being resolved>
Decision: <what was decided, stated plainly>
Reason: <why this option, over the alternatives>
Alternatives: <other options considered, and why they were rejected>
Consequences: <what this makes easier, harder, or what tradeoffs it accepts>
Affected Modules: <e.g. Vendor, Order, Auth>
Source References: <file paths, PR links, or commit SHAs backing this record>
```

## Guidance for contributors

- Write the record close to when the decision is made — motivations are hardest to reconstruct honestly after the fact.
- A decision record is not a design proposal — capture what was actually decided and (ideally) implemented, referencing the code that resulted.
- If a later decision reverses or replaces an earlier one, don't delete the old record — mark its `Status` as `Superseded by <new decision>` and link forward, so the history of reasoning stays intact.
- Prefer a small number of high-signal records (things a new engineer would genuinely wonder about) over logging every minor choice.
