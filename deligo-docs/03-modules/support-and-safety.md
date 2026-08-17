# Support & Safety

## Overview

Covers customer/staff support ticketing (with real-time chat over Socket.IO), the SOS emergency-alert system, order/product/delivery-partner ratings, and the notification delivery system that underlies most other modules' user-facing alerts.

## Purpose

Explain how support tickets flow between users and admins, how SOS alerts reach dashboards, how ratings are structured, and how notifications actually get delivered.

## Support

Two collections: `SupportTicket` and `SupportMessage` (plus an unrelated generic `Counter` sequence-helper defined in the same file).

`SupportTicket`: `{ticketId, userId/userModel (polymorphic: Admin|Customer|Vendor|FleetManager|DeliveryPartner), activeHandler: AI|AGENT|NONE (default AI), assignedAdminId, status: OPEN|IN_PROGRESS|CLOSED, category: ORDER_ISSUE|PAYMENT|IVA_INVOICE|TECHNICAL|GENERAL, referenceOrderId, lastMessage/lastMessageSender/lastMessageTime, unreadCount (Map), closedAt/closedBy}`.

`SupportMessage`: `{ticketId (string value-match to SupportTicket.ticketId, not an ObjectId ref), senderId, senderRole, message, messageType: TEXT|IMAGE|AUDIO|LOCATION|SYSTEM, attachments, readBy (Map)}`.

### Flow

`getOrCreateActiveTicket()` finds a non-`CLOSED` ticket for the user or creates one (`activeHandler: 'AI'` by default) — an agent cannot silently create a ticket on a user's behalf if none exists. `createMessage()` restricts non-agents to messaging only on their own ticket (validated against `Order` ownership when `referenceOrderId` is present); the first agent reply auto-assigns `assignedAdminId` and flips the ticket to `IN_PROGRESS`/`activeHandler: 'AGENT'`. `unreadCount` uses a special `'ADMIN_GENERAL'` bucket before any agent claims the ticket, migrated to the specific admin's key on first claim.

**Delivery is primarily Socket.IO, not REST**: `src/app/lib/Socket/events/support.events.ts` implements `join-conversation`, `typing`, `send-message` (calls the same service function as the REST endpoint, then emits `new-message` to the ticket room plus `incoming-notification` to an admin-notifications room), `mark-read`, `close-conversation`, `leave-conversation`. The REST endpoints (`send-message`, `tickets`, `tickets/:id/messages`, `tickets/:id/read`, `tickets/:id/close`) exist as an HTTP fallback / admin-panel surface calling the identical service functions.

**Access control**: agents (`ADMIN`/`SUPER_ADMIN`) can view any ticket; every other role only their own.

### AI handler — unimplemented scaffolding

`activeHandler` defaults to `'AI'` and the interface types an `aiMetadata: {lastIntent, needsHuman}` field, but **no code anywhere reads or writes `aiMetadata`, and no automated response logic exists**. A ticket simply sits in the `'AI'` state — functionally indistinguishable from unhandled — until a human admin sends the first reply, which flips it to `'AGENT'`. See [`../08-known-gaps/technical-debt-and-todos.md`](../08-known-gaps/technical-debt-and-todos.md).

## SOS

Full dispatch-adjacent detail is in [`delivery-and-dispatch.md`](delivery-and-dispatch.md). In brief: `Sos` documents are geo-tagged (2dsphere-indexed `location`), triggerable by `ADMIN`/`DELIVERY_PARTNER`/`VENDOR`/`SUB_VENDOR`/`FLEET_MANAGER` staff (not `CUSTOMER`), require the trigger-er's own `currentSessionLocation` to already be set, and broadcast to a fixed `SOS_ALERTS_POOL` Socket.IO room. Status workflow (`ACTIVE → INVESTIGATING → RESOLVED|FALSE_ALARM`) is admin-only, and `RESOLVED` is terminal/locked.

## Rating

Unified model for three distinct targets — `DELIVERY_PARTNER`, `PRODUCT`, `VENDOR` — always anchored to an `orderId`. `sentiment` is auto-derived on save (`rating >= 4` → `POSITIVE`, `== 3` → `NEUTRAL`, else `NEGATIVE`). `subRatings` (`foodQuality`, `packaging`, `deliverySpeed`, `riderBehavior`) are all optional.

### Business rules

- One rating per `{orderId, reviewerId, ratingType}` combination — enforced only by an **application-level pre-check**, with **no corresponding database unique index** (unlike `Payout`/`PointsLog`, which use partial unique indexes for their equivalent duplicate-prevention needs). This leaves a narrow race-condition window for duplicate ratings under concurrent requests.
- Only the order's own customer may rate `PRODUCT`/`VENDOR`; only the order's assigned delivery partner may rate `DELIVERY_PARTNER`.
- `PRODUCT` ratings fan out to **one document per order line item** (`insertMany`).
- After rating, `Order.ratingStatus.{isProductRated, isVendorRated, isDeliveryRated}` flags update, and `Order.isRated = true` once all three are true.
- Aggregate stat recomputation lives in `rating.constant.ts` (a misleadingly named file — it contains functions, not constants): `calcAndUpdateDeliveryPartner`, `calcAndUpdateProduct`, `calcAndUpdateVendorAllProductStats` — a vendor's overall rating is computed as the average of all its products' ratings, not from a directly vendor-targeted rating collection.

## Notification

`{receiverId (plain string, not an ObjectId ref), receiverRole, title, message, data, type, isRead, isDeleted}`. `type` ∈ `ORDER, OFFER, SYSTEM, PAYOUT, ACCOUNT, PAYOUT_ALERT, TRANSACTION, PROMOTIONAL, STOCK_ALERT, OTHER`.

**Two delivery channels, both fire-and-forget** (`setImmediate`, detached from the triggering request):
1. **Push via Firebase Cloud Messaging** — reads FCM tokens off `AuthUser.loginDevices[].fcmToken`. Automatically cleans up stale tokens: on FCM errors indicating an unregistered/invalid token, the corresponding `fcmToken` is cleared from the device record.
2. **In-app/DB log** — persisted to the `Notification` collection for the `GET /notifications/my-notifications`/`GET /notifications/all` REST reads, with soft/permanent delete and read/unread tracking.

**Not delivered via Socket.IO** for general notifications — Socket.IO is reserved specifically for order tracking, rider live location, shop status, SOS, and support chat; the `Notification` module itself has no socket emit of its own.

`sendToUser()`/`sendToRole()` are the internal functions most other modules call into (Order worker, Payout, etc.). `POST /notifications/broadcast` (`ADMIN`/`SUPER_ADMIN`) supports `communicationType: EMAIL|PUSH|BOTH`, targets by role(s) and/or explicit user IDs, personalizes a `{name}` placeholder, and streams via a Mongo cursor for memory-safety at scale.

## Database Impact

See [`../05-data-model/collections-reference.md`](../05-data-model/collections-reference.md) for `SupportTicket`/`SupportMessage`, `Sos`, `Rating`, `Notification` field/index detail.

## Edge Cases

- `Rating`'s lack of a database-level duplicate guard is the one place in this document group where the codebase's usual pattern (app check + DB partial unique index) is not fully applied — worth flagging if working in this area.
- Because notification delivery is entirely fire-and-forget, a client cannot rely on an HTTP 200 response from an order/support action to mean the corresponding push notification has actually been sent.

## Related Modules

[`delivery-and-dispatch.md`](delivery-and-dispatch.md) for full SOS/dispatch integration, [`cart-checkout-order.md`](cart-checkout-order.md) for where ratings/notifications are triggered from order events, [`../06-integrations/external-services.md`](../06-integrations/external-services.md) for Firebase Cloud Messaging and Socket.IO configuration.

## Source References

- `src/app/modules/Support/support.model.ts`, `.service.ts`, `.route.ts`
- `src/app/lib/Socket/events/support.events.ts`
- `src/app/modules/Sos/sos.model.ts`, `.service.ts`
- `src/app/modules/Rating/rating.model.ts`, `.constant.ts` (aggregate-recompute functions), `.service.ts`
- `src/app/modules/Notification/notification.model.ts`, `.service.ts`
- `src/app/utils/sendPushNotification.ts`
