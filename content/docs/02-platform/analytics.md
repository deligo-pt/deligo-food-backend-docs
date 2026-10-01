---
title: Analytics
description: "The analytics module as implemented: the 36 read-only report endpoints grouped by audience (vendor and branch, fleet manager, delivery partner, admin), how each is scoped, which orders and money each one counts, how timeframes and time zones are resolved, and the inconsistencies between reports (most notably that completed pickup orders are not counted)."
order: 5
---

# Analytics

The analytics module is a set of **read-only report endpoints** under `/api/v1/analytics`.
There is no analytics collection: every request runs aggregations over `Order`,
`Transaction`, `Wallet`, `Customer`, `Vendor`, `DeliveryPartner`, `FleetManager`, `Product` and
`Offer` and returns a report shaped for a dashboard. This page explains what the reports
count and how they are scoped; it does not list every response field.

Paths are relative to `src/app/`; the module is `modules/Analytics/` (two services:
`analytics.service.ts` and `analyticsSecond.service.ts`). Statements come from the
committed code, read but not run, unless marked **Inferred** or **Unresolved**.
Uncommitted working-tree features are not described.

---

## At a glance

| Question | Answer |
| --- | --- |
| Endpoints | 36, all `GET`. 21 for `ADMIN` and `SUPER_ADMIN`, 10 for `VENDOR` and `SUB_VENDOR`, 3 for `FLEET_MANAGER`, 1 for `DELIVERY_PARTNER`, and `offer-analytics` for admins and vendors. |
| Permission actions | None. Any `ADMIN` can call every admin report. |
| Caching, storage | None. There is no Redis or stored report; every call aggregates live data. |
| Scope | Vendor, fleet and rider reports are scoped to the caller's own profile `_id`. Admin reports cover the whole platform. |
| What "completed" means | In almost every report: `orderStatus = DELIVERED`. See [the pickup gap](#mismatches-and-inconsistencies). |
| Notifications, logs | None. |

---

## Timeframes and time zones

**Report timeframes.** The six admin reports (`sales-report`, `order-report`,
`customer-report`, `vendor-report`, `fleet-manager-report`, `delivery-partner-report`)
accept `timeframe` (`last7days`, `last14days`, `last30days`, `last90days`, `last1year`,
`custom`), `fromDate` and `toDate` (`getReportTimeframe`). Rules:

- No `timeframe` and no `fromDate`: the **last 365 days**.
- `custom` with `fromDate`: from that date to `toDate`, or now.
- Any other value, including an unknown one: the last 7 days.
- The start is moved to local midnight. The bucket size follows the span: up to 14 days by day, up to 30 days in 3-day buckets, up to 90 in 9-day buckets, up to a year by month, up to two years in 2-month buckets, otherwise by year.

Other admin reports (`sales-analytics`, `customer-insights`, `top-vendors`, `peak-hours`,
`delivery-insights`, `delivery-partner-analytics`) take only `fromDate` and `toDate`.
`platform-earnings` takes `page` and `limit`, and `partner-performance-analytics` takes
`timeframe` and `sortBy`. The vendor, fleet, rider and dashboard reports take no
parameters, and their windows are fixed (for example "last 7 days", today, this week,
this month, the last six months).

**Time zones.** Vendor reports bucket days in the vendor's own `businessDetails.timezone`.
Fixed windows use `getLocalStartOfPeriod`, which builds "today at 00:00" from the platform
timezone's calendar date but parses it **without an offset**, so it is correct only when the
server's own timezone matches (**Inferred**); weeks start on Monday. `getReportTimeframe`
uses the server's local time.

---

## Vendor and branch reports (`VENDOR`, `SUB_VENDOR`)

Every vendor report uses the caller's profile `_id`, so a **branch sees only its own
numbers and a parent vendor does not see its branches' orders**, matching the order
visibility rule in [Vendors and Branches](../04-vendors/vendors-and-branches.md).

| Endpoint (`/analytics/...`) | What it reports | Orders counted |
| --- | --- | --- |
| `vendor-sales-analytics` | Total sales (sum of `payoutSummary.vendor.earningsWithoutTax`), a Sunday to Saturday trend, best and slowest day, top five items by quantity. Last 7 days. | `DELIVERED`, `isPaid` |
| `customer-insights` | Summary cards: customers, returning customers, top city, retention rate. | `DELIVERED` |
| `order-trend-insights` | Volume summary, daily volume, peak ordering times, category growth. | `DELIVERED` |
| `top-selling-analytics` | Top-selling items. | `DELIVERED` |
| `vendor-sales-report-analytics` | Total sales, order count, average order value, sales data. | see note |
| `vendor-customer-report` | Customer report (takes a query). | see note |
| `vendor/tax-report` and `vendor/tax-report-analytics` | Two tax reports: total sales, tax, net revenue, tax by category and add-on tax. | `DELIVERED` |
| `vendor/dashboard-analytics` | Product counts (total, active, inactive), order counts (total, `PENDING`, `DELIVERED`, `CANCELED`) and popular categories. | all non-deleted orders |
| `vendor/earnings-analytics` | Earnings cards built from the `VENDOR_EARNING` **transactions** (today, week, month, total), the wallet's unpaid balance, order and product counts. | transactions, not orders |

"See note": those two reports' status rules are in their own aggregations and were not
traced line by line. `offer-analytics` is shared with admins, see below.

---

## Fleet manager and rider reports

| Endpoint | Roles | What it reports |
| --- | --- | --- |
| `fleet/dashboard-analytics` | `FLEET_MANAGER` | Cards (riders online now, deliveries today, availability rate), fleet composition, partner status (on delivery, waiting, offline) and top-rated drivers, for riders whose `currentFleetManagerId` is the caller. `DELIVERED` orders. |
| `partner-performance-analytics` | `FLEET_MANAGER` | Per-rider performance, with `sortBy` and `timeframe`, for the caller's riders. |
| `fleet/earning-analytics` | `FLEET_MANAGER` | Revenue, rider payable, net earnings, weekly and monthly earnings, current unpaid balance and a graph, from transactions and the wallet. |
| `partner/earning-analytics` | `DELIVERY_PARTNER` | Daily, weekly, monthly and total earnings and the unpaid balance, from transactions and the wallet. |

---

## Admin reports (`ADMIN`, `SUPER_ADMIN`)

| Group | Endpoints (`/analytics/admin/...` unless noted) | Notes |
| --- | --- | --- |
| Entity reports | `sales-report-analytics`, `order-report-analytics`, `customer-report-analytics`, `vendor-report-analytics`, `fleet-manager-report-analytics`, `delivery-partner-report-analytics` | Timeframe parameters above. Headline stats and trends: revenue, completed and canceled orders, average order value, status distributions, zone heat map, vehicle distribution. |
| Performance | `fleet-performance-analytics`, `fleet-performance-details-analytics/:fleetManagerId`, `delivery-partner-performance-analytics`, `delivery-partner-performance-details-analytics/:partnerUserId`, `vendor-performance-analytics`, `vendor-performance-analytics/:vendorUserId` | Lists are paginated (`meta`). Detail routes take the fleet manager's, rider's or vendor's `userId`. |
| Platform insight | `sales-analytics`, `customer-insights`, `top-vendors`, `peak-hours`, `delivery-insights`, `delivery-partner-analytics`, `all-customers-analytics` | `fromDate` and `toDate`. Churn, lifetime value, daily, weekly and monthly active users, peak hours and meal-time comparison, delivery times, late and rejected percentages, rider idle time. |
| Money | `platform-earnings` | Revenue and platform commission (this week, this month, total) from `DELIVERED` orders and transactions, paginated. |
| Dashboard | `dashboard-analytics` | Counts of customers, vendors, fleet managers, riders, products and orders (total, `PENDING`, `DELIVERED`, `CANCELED`), popular categories and the three newest orders. The customer, vendor, fleet manager, rider and order counts do not filter out soft-deleted rows; only the product count does. |
| Offers | `/analytics/offer-analytics` | Shared with vendors. See below. |

**Offer analytics.** Counts offers (total, currently active) and **orders that applied an
offer** (`offer.isApplied`, any status except `CANCELED`, so `REJECTED` and in-progress
orders count), with redemptions, the summed `totalOfferDiscount` as revenue impact, a
seven-day usage series, usage by type and top offers. A vendor or branch sees only its own
offers and orders; an admin sees all. Offer behavior itself is in [Offers](../09-offers-and-coupons/offers.md).

---

## What the money figures come from

| Figure | Source |
| --- | --- |
| Vendor sales | The order snapshot (`payoutSummary.vendor.earningsWithoutTax`) of `DELIVERED` paid orders. |
| Vendor, fleet and rider earnings cards | `Transaction` rows of the matching earning type, plus an "unpaid" figure that is the wallet's `currentBalance` (it still includes any amount locked by a pending payout). These rows exist for every settled order, including pickup and `NO_SHOW` ones. |
| Platform commission | Order snapshot `deliGoCommission` and the platform `Transaction` rows. |

Wallet and ledger semantics are in
[Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md).

---

## Mismatches and inconsistencies

1. **Completed pickup orders are not counted.** No analytics code refers to `PICKED_UP_BY_CUSTOMER`. Every report that filters on "completed" uses `DELIVERED` only, so sales, customer, trend, tax and dashboard reports leave out self-pickup orders that were collected. The earnings cards, built from transactions, do include them. A vendor's sales total and its earnings total can therefore differ.
2. **`NO_SHOW` is counted in earnings but not in sales.** The settlement worker pays a `NO_SHOW` order, so its `VENDOR_EARNING` row appears in earnings reports, while sales reports exclude it.
3. **"Canceled" is narrow in places.** The admin sales report counts only `CANCELED`; `REJECTED` orders are not in its cancelled figure, while the delivery insights count both as failed.
4. **Two tax reports for vendors** (`vendor/tax-report` and `vendor/tax-report-analytics`) and two sales report shapes exist, with different names and result shapes.
5. **Admin reports need no permission action**, unlike `CAN_MANAGE_ACTIVITY_LOGS` or `CAN_VIEW_ANALYTICS`. The permission `CAN_VIEW_ANALYTICS` (and `CAN_VIEW_DASHBOARD`) exists but nothing enforces it.
6. **Time handling is not uniformly time-zone aware** (see above).
7. **Every call re-aggregates** with no cache, and the two services total about 7,100 lines of aggregation code. Cost under load was not measured.

---

## Unverified or inferred behavior

- This page is based on the route roles, the base `$match` of each aggregation, the helper code and the response shapes. Individual `$group` stages, rounding and every response field were **not** traced.
- Nothing was executed. The pickup gap (#1) is established by the absence of the status in the code and by the `DELIVERED` filters, not by a run against data.
- The two "see note" vendor reports were not traced for status rules.

---

## Related documentation

- [Payouts, Wallets and Transactions](../10-payments/payouts-wallets-transactions.md): the wallet and ledger data behind the earnings cards.
- [Order Lifecycle](../03-orders/order-lifecycle.md): the statuses the reports filter on.
- [Cancellations, Refunds and Settlement](../03-orders/cancellations-refunds-settlement.md#settlement): when earnings rows are written.
- [Offers](../09-offers-and-coupons/offers.md): the offer data reported by `offer-analytics`.
- [Authorization](../03-identity-access/authorization.md): roles and permission actions.
