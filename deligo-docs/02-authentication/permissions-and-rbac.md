# Permissions & RBAC

## Overview

Deligo has two layers of authorization: coarse **role-based** access control (7 fixed roles, checked from the JWT-resolved `AuthUser`) and a finer **permission-based** layer that applies only to `ADMIN` (not `SUPER_ADMIN`, which bypasses it entirely).

## Purpose

Explain how `auth(...)` route guards work, what the 14-action permission catalog contains, and exactly how/when the permission check is enforced.

## Role check

Every protected route declares `auth(...roles)` (or `auth(...roles, [permissions])`). The `auth` middleware compares the JWT-resolved `role` against the route's allowed list; a mismatch throws `403 COMMON_ACCESS_DENIED`. See [`session-and-token-management.md`](session-and-token-management.md) for the full middleware pipeline.

## ADMIN permission catalog

`VALID_PERMISSION_ACTIONS` (`src/app/modules/Permission/permission.constant.ts`) — 14 actions:

```
CAN_VIEW_DASHBOARD
CAN_MANAGE_ADMINS
CAN_MANAGE_VENDORS
CAN_MANAGE_PARTNERS
CAN_MANAGE_FLEET
CAN_MANAGE_CUSTOMERS
CAN_MANAGE_ORDERS
CAN_MANAGE_PERMISSIONS
CAN_MANAGE_COUPONS
CAN_VIEW_ANALYTICS
CAN_MANAGE_SYSTEM_SETTINGS
CAN_MANAGE_AGREEMENTS
CAN_MANAGE_INGREDIENTS
CAN_MANAGE_ACTIVITY_LOGS
```

Only 4 of these 14 are actually wired to route guards today: `CAN_MANAGE_INGREDIENTS` (Ingredients module), `CAN_MANAGE_AGREEMENTS` (Agreement module), `CAN_MANAGE_PERMISSIONS` (Permission module itself), `CAN_MANAGE_ACTIVITY_LOGS` (ActivityLog module). `CAN_MANAGE_COUPONS` is defined but has no corresponding route to gate, since `Coupon` has no HTTP surface at all — see [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md). The remaining actions exist in the catalog but are not currently consulted by any route's `auth()` call, based on the endpoint index.

## Permission model vs. Admin.permissions

Two separate things:
- **`Permission` collection** (`src/app/modules/Permission/permission.model.ts`) — a *catalog/metadata* table: `{name, action (unique, one of the 14), module, displayName, description, isSystemDefined, isActive, createdBy/updatedBy → Admin, isDeleted}`. Full CRUD via `/permissions`.
- **`Admin.permissions: string[]`** — what's actually **enforced at runtime**. Assigning a permission to an admin (`PATCH /permissions/assign-permissions/:adminId`) resolves the given `Permission._id`s to their `action` codes and `$addToSet`s them directly onto the target `Admin` document — it denormalizes the code, it does not store a reference back to the `Permission` catalog document. `PATCH /permissions/revoke-permissions/:adminId` does the inverse (`$pull`).
- A brand-new admin (including the seeded super-admin, in principle) starts with `permissions: []` and must be explicitly granted actions.
- Every `/permissions/*` endpoint is itself gated `auth('SUPER_ADMIN', 'ADMIN', ['CAN_MANAGE_PERMISSIONS'])` — bootstrapping the very first permission grant requires either the seeded `SUPER_ADMIN` or an admin who already holds `CAN_MANAGE_PERMISSIONS`.

## The live permission check (`auth` middleware, step 11)

Quoted logic from `src/app/middlewares/auth.ts`:

```ts
if (role === 'ADMIN' && requiredPermissions.length > 0) {
  // Security: always check the DB's current permissions, never the
  // JWT-embedded snapshot from login time — otherwise a permission
  // revoked mid-session would stay in effect until the token expires.
  const adminPermissions = user.permissions || [];
  const hasEveryRequiredPermission = requiredPermissions.every(
    (permission) => adminPermissions.includes(permission),
  );
  if (!hasEveryRequiredPermission) {
    throw new AppError(httpStatus.FORBIDDEN, 'ADMIN_ACTION_PERMISSION_DENIED');
  }
}
```

Key facts confirmed directly from this code:
- The check is gated on `role === 'ADMIN'` **literally** — `SUPER_ADMIN` never enters this branch, regardless of what permissions a route requires. `SUPER_ADMIN` is a true, unconditional superuser with no way to be permission-restricted, even in principle, without a code change.
- The permissions checked (`user.permissions`) come from `user` — the profile document freshly queried in step 10 of the middleware, on **every single request**, never cached and never read from the JWT. A permission revoked mid-session takes effect on the very next request from that admin.
- Every route in the codebase that guards with a permission array also lists `SUPER_ADMIN` in its role list (e.g. `Permission`'s own routes: `auth('SUPER_ADMIN', 'ADMIN', [...])`) — so in practice, if a route required only `ADMIN` with a permission array and omitted `SUPER_ADMIN` from the role list, `SUPER_ADMIN` would actually fail the earlier role check (step 9) rather than skip the permission check via step 11's gate. This scenario doesn't currently occur in the codebase (every permission-gated route includes both roles).

## Business Rules

- `ADMIN`/`SUPER_ADMIN` share the `Admin` collection, differentiated only by the `role` field (`ROLE_COLLECTION_MAP`) — see [`../01-overview/role-model.md`](../01-overview/role-model.md).
- There is no partial/tiered `SUPER_ADMIN` — a single compromised `SUPER_ADMIN` credential is a full-system compromise with no granular containment, since the permission layer never applies to that role.

## Authorization

Summary table of which modules currently enforce a permission array (beyond role alone):

| Module | Required permission |
|---|---|
| Ingredients | `CAN_MANAGE_INGREDIENTS` |
| Agreement | `CAN_MANAGE_AGREEMENTS` |
| Permission | `CAN_MANAGE_PERMISSIONS` |
| ActivityLog | `CAN_MANAGE_ACTIVITY_LOGS` |

All other admin-restricted routes rely on role alone (`ADMIN`/`SUPER_ADMIN`) with no finer permission check — most of the 14-action catalog is currently aspirational relative to actual route enforcement.

## Edge Cases

- A newly onboarded `ADMIN` with zero assigned permissions can still access every route guarded by role alone (e.g. most `GET` list endpoints across modules) — the permission layer only restricts the specific routes listed above.
- Because the check re-queries the DB every request, high-permission-check-volume admin dashboards incur one extra document read per request beyond the base `auth` middleware's existing profile lookup (which already happens regardless, in step 10) — no additional query cost beyond what step 10 already does, since `user.permissions` is read off the same already-fetched document.

## Related Modules

[`session-and-token-management.md`](session-and-token-management.md) for the full middleware pipeline this check is step 11 of; [`../01-overview/role-model.md`](../01-overview/role-model.md) for the role hierarchy; [`../03-modules/admin-and-settings.md`](../03-modules/admin-and-settings.md) for the Admin/Permission modules' broader context.

## Source References

- `src/app/middlewares/auth.ts`
- `src/app/modules/Permission/permission.model.ts`, `permission.constant.ts`, `permission.service.ts`, `permission.route.ts`
- `src/app/modules/Admin/admin.model.ts`
