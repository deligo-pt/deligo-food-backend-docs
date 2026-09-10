---
title: Conventions
description: The recurring patterns every module in the backend follows — structure, errors, responses, validation, querying, and localization.
order: 4
---

# Conventions

These patterns repeat across almost every module. Knowing them once means you
can read any feature quickly.

## Module structure

A feature is a folder under `src/app/modules/<Feature>/` with suffix-named
files. The dependency direction is one-way:

```
route  ->  controller  ->  service  ->  model
              |               |
           sendResponse    QueryBuilder / AppError / queues / integrations
```

| Layer | Rule |
| --- | --- |
| **route** | Only wiring: `auth(...)`, `validateRequest(...)`, then the controller. Router is exported and registered in `src/app/routes/index.ts`. |
| **controller** | No business logic. Reads `req.body` / `req.params` / `req.query` / `req.user` / `req.lang`, calls one service function, passes the result to `sendResponse`. Always wrapped in `catchAsync`. |
| **service** | Everything else: authorization nuances, validation beyond schema, persistence, transactions, side effects. Returns a plain object, never touches `res`. |
| **model** | Mongoose schema + `model<T>()`. Shared sub-schemas come from `src/app/constant/GlobalModel/`. |

Supporting files: `*.interface.ts`, `*.validation.ts`, `*.constant.ts`,
`*.messages.ts`, `*.pushMessages.ts`, `*.utils.ts`, `*.worker.ts`.

## Service return shape

Services return a descriptor that the controller forwards:

```ts
return {
  messageKey: 'DATA_LOAD_SUCCESS',              // key into the localized message map
  variables: { entity: 'Admins', isPlural: true }, // interpolation vars (optional)
  meta,                                          // pagination meta (optional)
  data,                                          // the payload
};
```

## Error handling

Throw `AppError`; never build an error response by hand.

```ts
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

throw new AppError(httpStatus.FORBIDDEN, 'COMMON_ACCESS_DENIED', {
  reason: 'You lack the required clearance to view this profile.',
});
```

`AppError(statusCode, errorKey, variables?, stack?, data?)`:

- `errorKey` is a **message key**, resolved and localized by the global handler.
- `variables` feed message-template interpolation only — they are never
  serialized into the response.
- `data` is an opt-in, frontend-safe structured payload attached to the
  response (used e.g. by `AGREEMENT_RESIGN_REQUIRED`).

`src/app/middlewares/globalErrorHandler.ts` is the single exit point. It
normalizes:

| Source | Handler |
| --- | --- |
| `ZodError` | `handleZodError` |
| Mongoose `ValidationError` / `CastError` | `handleValidationError` / `handleCastError` |
| Duplicate key (`code === 11000`) | `handleDuplicateError` |
| `multer.MulterError` | inline (`FILE_TOO_LARGE`, `FILE_COUNT_EXCEEDED`, …) |
| `AppError` | localized `errorKey` + optional `data` |
| Any other `Error` | falls back to `SOMETHING_WENT_WRONG` |

Extra behavior: any `statusCode >= 500` is written to the `ErrorLog` collection
with sensitive fields (`password`, `token`, `otp`, `nif`, card fields, …)
redacted; if the request left uploaded files behind, they are deleted from
RustFS.

## Response envelopes

**Success** — `src/app/utils/sendResponse.ts`:

```json
{ "success": true, "message": "Admins list loaded successfully.", "meta": { "page": 1, "limit": 10, "total": 42, "totalPage": 5 }, "data": [] }
```

`message` is the resolved `messageKey` (omitted when there is no key). `meta` is
present only for paginated lists.

**Error** — global handler:

```json
{ "success": false, "message": "…", "errorSources": [{ "path": "", "message": "…" }] }
```

`data` is included only when an `AppError` carried one. In
`NODE_ENV=development` the raw `err` and `stack` are appended.

## Validation

Request bodies are validated by Zod schemas in `*.validation.ts`, applied with
`validateRequest(schema)`. The schema wraps the payload under `body`:

```ts
export const createXValidationSchema = z.object({
  body: z.object({ /* ... */ }),
});
```

`validateRequest` runs `parseAsync` and **overwrites `req.body` with the parsed
result**, so controllers always see coerced, stripped data. Use
`validateRequestCookies` for cookie-based payloads (e.g. refresh token).

## QueryBuilder

List endpoints use `src/app/builder/QueryBuilder.ts` instead of hand-written
find chains. Canonical usage:

```ts
const qb = new QueryBuilder(Model.find(baseFilter), req.query)
  .search(ModelSearchableFields)  // case-insensitive regex OR over given fields
  .filter()                       // arbitrary equality filters from the query string
  .sort()                         // ?sortBy=field,-field   (default: -createdAt)
  .paginate()                     // ?page & ?limit         (default: page 1, limit 10)
  .fields();                      // ?fields=a,b,c projection

const meta = await qb.countTotal();  // { page, limit, total, totalPage }
const data = await qb.modelQuery;    // execute
```

Reserved query keys: `searchTerm`, `page`, `limit`, `sortBy`, `fields`.
`filter()` deliberately drops keys already constrained on the base query and
ignores nested-object values. `.lean()` is available for read-only paths.
Role-scoped lists set the base filter *before* handing the query to the builder
(e.g. a vendor only ever sees its own rows).

## Localization / message keys

- Every user-facing string is a key in a module's `*.messages.ts` map, shape
  `{ KEY: { en: string | (vars) => string, pt: ... } }`. All maps are merged
  into `src/app/errors/messages.ts` as `localizedMessages`, and `TMessageKey`
  is the union of every key.
- `parseLanguage` sets `req.lang` (`'en'` | `'pt'`, default `'en'`) from
  `Accept-Language`.
- `resolveLocalizedMessage(key, lang, vars)` picks `target[lang] ?? target.en`;
  if the value is a function it is called with `vars`. An unknown key resolves
  to the key string itself.
- Push and email copy live in `*.pushMessages.ts` / `views/*.hbs` and follow the
  same `en` / `pt` split.

## Authentication middleware usage

`auth()` is both the authN and authZ gate — see
[Architecture](./architecture.md) (*Per-route middleware pattern*) for the full
check list.

| Call | Meaning |
| --- | --- |
| `auth('CUSTOMER')` | Token required; role must be `CUSTOMER`. |
| `auth('VENDOR', 'SUB_VENDOR')` | Any of the listed roles. |
| `auth('ADMIN', 'SUPER_ADMIN', ['MANAGE_PAYOUTS'])` | Roles **plus** every listed permission present on the admin's `permissions[]` (only enforced for `role === 'ADMIN'`). |
| no `auth` | Public route (e.g. registration, login, the RedUniq webhook). |

After `auth`, `req.user` is the **role profile document** (from
`authUser.profileModel`), with `req.user.authUserId` set to the `AuthUser._id`.

## Other shared conventions

| Convention | Detail |
| --- | --- |
| Async wrapping | Route handlers and middleware use `catchAsync` so throws reach `globalErrorHandler`. |
| Passwords | `passwordPlugin` hashes on save when `password` is modified and strips `password` from every `toJSON` / `toObject`. Provides `isPasswordMatched`, `isJWTIssuedBeforePasswordChanged`. |
| Soft delete | Models carry `isDeleted: boolean`; queries filter `{ isDeleted: false }`. `auth` also rejects deleted accounts. |
| Generated IDs | `customNanoId(n)` over `A–Z0–9`; human-readable prefixes — users `C-/V-/SV-/D-/FM-/A-/SA-`, transactions `TXN-`, plus payout / ticket / referral generators. |
| Money math | `roundTo2` and helpers in `src/app/utils/mathProvider.ts`. |
| Multi-document writes | `mongoose.startSession()` + `session.startTransaction()` (registration, order creation, payouts, seeding). |
| Outbound calls | Always through a client in `src/app/lib/httpClients/` or `src/app/utils/`, wrapped in an `opossum` circuit breaker, often with `withRetry`. |
| Time | Platform time is `Europe/Lisbon`; date helpers live in `dateTimeProvider.ts` / `formatDateTime.ts`. |
