---
title: Saved Cards
description: "How saved cards are implemented: the PaymentToken model, the three ways a card token is created (standalone save, hosted-page save, none for other methods), listing and removing cards, what is stored and what is relayed to the gateway, how a saved token is charged, and the guards and inconsistencies around them."
order: 2
---

# Saved Cards

A customer can keep a card on file so a later checkout can be paid in one step. The
backend stores **only a gateway token and display metadata**, never the full card
number or the security code. This page covers that lifecycle; the payment itself is
described in [Payments](./payments.md#saved-card-flow).

Paths are relative to `src/app/`; the module is `modules/Payment-Token/`. Statements
come from the committed code unless marked **Inferred** (read from code, not run) or
**Executed** (a probe ran the real service code against a local fake gateway with the
database calls stubbed). Uncommitted working-tree features are not described.

---

## At a glance

| Question | Answer |
| --- | --- |
| Who | A `CUSTOMER`, for their own cards only. |
| Base path | `/api/v1/payment-tokens`. |
| Methods that can be saved | `CARD` only. MB WAY, Apple Pay, Google Pay and PayPal are never tokenized, and a `saveCard` request for them is ignored. |
| What is stored | `tokenId` (gateway token), brand, last 4 digits, expiry as `MM/YY`, holder name, default and active flags. |
| What is not stored | The card number and the security code. They are validated, forwarded to the gateway in memory and dropped. |
| Removal | A soft delete (`isActive: false`) after asking the gateway to disable the token. |
| Charging | `POST /payment/reduniq/pay-with-saved-token`; see [Payments](./payments.md#saved-card-flow). |

---

## Data model

`PaymentToken` (`payment-token.model.ts`), `timestamps: true`.

| Field | Notes |
| --- | --- |
| `customerId` | The `Customer` profile `_id`. |
| `tokenId` | The gateway's token id (`payToken.id`). Required. |
| `gatewayRef` | The reference sent on the tokenization call (`TOK-<nanoid10>` for a standalone save, the checkout summary id for a hosted-page save). |
| `cardBrand` | `VISA`, `MASTERCARD`, `AMEX` or `OTHER`. |
| `last4`, `expiryDate` | Display data. `expiryDate` is `MM/YY`. |
| `cardHolderName` | Optional. |
| `isDefault`, `isActive` | `isActive` is the soft-delete flag. |

Indexes: a unique `{ customerId, tokenId }`, `{ customerId, isActive }`, and a unique
`{ customerId, cardBrand, last4, expiryDate }` that applies to **active** cards only. The
last one means a customer cannot hold the same active card twice.

---

## Creating a card token

There are two sources. Both end in the same upsert.

### Standalone save

`POST /api/v1/payment-tokens/save-card`, `CUSTOMER`. Body (strict):
`card.holderName` (at least 2 characters), `card.number` (12 to 19 digits), `card.expMonth`
(`01` to `12`), `card.expYear` (4 digits), `card.secCode` (3 or 4 digits).

1. The brand is derived from the number (`4` is `VISA`, `51` to `55` and `2221` to `2720` are `MASTERCARD`, `34` and `37` are `AMEX`, anything else `OTHER`), together with the last 4 digits and the `MM/YY` expiry, **before** the raw fields are sent.
2. The service sends `createPaymentToken` (solution `113`, `payToken.action: 500`, `payToken.ref: TOK-<nanoid10>`, buyer name and email, and the card) to the gateway. The number and security code travel through the backend in memory only.
3. The gateway must answer with `result.code` `00000000` or `17000000000`, otherwise `400 CARD_TOKENIZATION_FAILED_BY_GATEWAY`. The token is read from `payToken.id`, `token.id` or a top-level `token` string; none of them gives `400 CARD_TOKEN_NOT_RECEIVED` (**Executed**).
4. The metadata is upserted (see below) and returned as `{ id, brand, last4, expiryDate, isDefault, label }`, for example `Visa ending in 1111`.
5. The controller writes an activity log entry `PAYMENT_TOKEN_CREATED` (type `INFO`, with `last4` only).

### Hosted-page save

`POST /payment/reduniq/create-payment-intent` with `paymentMethod: CARD` and `saveCard: true`
adds `payToken: { action: 500, ref: <summaryId> }` to `initPayment`; the customer types the card on the
gateway's page. After a **verified** payment, both the client confirmation (`create-order`) and the
webhook call `persistCardTokenFromGatewayResponse` for every `CARD` payment, whether or not `saveCard` was
requested. It saves only when the gateway reply contains a token id **and** card digits
(`card.suffix`, `card.last4` or the tail of `card.number`); otherwise it returns nothing, and a reply
without digits is logged. The brand is the gateway's `card.brand` upper-cased (`OTHER` when absent), and the
expiry comes from `expMonth` and `expYear` or `expiryDate`. Failures are only logged and never affect the order.

**Executed:** a brand the schema does not know (for example `maestro`) is passed on as `MAESTRO`, not mapped to
`OTHER`; **Inferred:** the enum then rejects the write, and the catch leaves only a log line. A reply without
brand or expiry is stored as `OTHER` with an empty expiry.

### The upsert

Both sources call `upsertPaymentToken`, keyed on **card identity** (customer, brand, last 4, expiry, active),
not on the token id, because the gateway issues a new token each time even for the same card.

- A new card is inserted; saving the same active card again **replaces** its `tokenId` and `gatewayRef` (and the holder name when given) instead of creating a duplicate.
- `isDefault` is set on insert only, and only when the customer has no active default yet (**Executed**: `true` for the first card, `false` when one exists).
- The previous token of a re-saved card is not disabled at the gateway (**Inferred**: no call is made).

---

## Listing and removing cards

| Endpoint | Behavior |
| --- | --- |
| `GET /payment-tokens` | The caller's **active** cards, default first then newest, as `{ id, brand, last4, expiryDate, isDefault, label, createdAt }`. The gateway token is never returned. |
| `PATCH /payment-tokens/:paymentTokenId/disable` | See below. |

Disabling a card:

1. The card must belong to the caller (`SAVED_CARD_NOT_FOUND`, 404) and be active (`SAVED_CARD_ALREADY_DISABLED`, 400). The gateway must be configured.
2. `disablePaymentToken` is sent with `payToken.action: 502`.
3. **Executed** outcomes: code `00000000` succeeds; `payToken.status` `'3'` (already inactive at the gateway) is treated as success; code `00100067` (not permitted for this merchant account) is logged and the card is disabled **locally only**; any other reply gives `400 SAVED_CARD_DISABLE_FAILED_BY_GATEWAY` and the card stays active.
4. Gateway transport errors become the usual 503 or `GATEWAY_ERROR`, and the card stays active.
5. The card is saved with `isActive: false` and `isDefault: false`, and the newest remaining active card, if any, becomes the default.
6. The controller writes `PAYMENT_TOKEN_REMOVED`.

There is no endpoint to choose a default card or to edit a card.

---

## Paying with a saved card

`pay-with-saved-token` takes a `paymentTokenId`, loads the card by `_id`, the caller's `customerId` and
`isActive: true`, and sends `tokenId` to the gateway (`doPaymentToken`, `payToken.action: 503`). The default flag
plays no part: the client names the card. The card's expiry date is not checked. The order is created in the same
request on success. Details, failure handling and the missing webhook backup are in [Payments](./payments.md#saved-card-flow).

---

## Guards and edge cases

| Situation | Behavior |
| --- | --- |
| Another customer's card id | Not found (the query includes `customerId`). |
| Disabled card used for payment | `SAVED_CARD_NOT_FOUND` (inactive cards are not matched). |
| Saving a card the customer already has | Replaces the token, no duplicate row. |
| Non-card payment methods | Never tokenized; `saveCard` is ignored. |
| Gateway says the disable is not permitted | The card disappears from the customer's list but the gateway token is left active. |
| Card data in logs | The service logs gateway replies on rejection (`console.error` of the response); it does not log the card fields it sent. A gateway reply that echoed card data would be logged (**Inferred**). |

---

## Mismatches and inconsistencies

1. **The backend handles the raw card number for standalone saves.** The number and security code pass through the API and the request body before reaching the gateway; only the hosted-page save keeps them off the backend. Nothing stores or logs them in the code read.
2. **Local disable can outrun the gateway.** On `00100067` the local card is deactivated while the gateway token stays valid.
3. **Re-saving does not revoke the old token.**
4. **Brand mapping is uneven.** The standalone save derives the brand from the number (unknown brands become `OTHER`); the hosted-page save trusts the gateway's brand string.
5. **`cardHolderName` and `gatewayRef` are not returned** by the list endpoint, and the schema's `required` on `expiryDate` does not stop an empty value from being written by the upsert path (upserts run without validators).
6. **No default management.** The default follows "first card" and "newest remaining card after a disable" only.

---

## Unverified or inferred behavior

- What the gateway returns for a hosted-page tokenization (field names, brand strings) is only as assumed by `persistCardTokenFromGatewayResponse`; the probes used shapes taken from the code.
- Whether the gateway accepts a token after the local card is disabled, and whether it rejects an expired card, is not in the code.
- The effect of an unknown brand string on the write is derived from the schema, not reproduced.

---

## Related documentation

- [Payments](./payments.md): the payment flows, verification and refunds.
- [Checkout and Order Creation](../03-orders/checkout-and-order-creation.md#payment): where the checkout summary starts a payment.
- [Authorization](../03-identity-access/authorization.md): roles and the auth middleware.
