# AN1.1 — Product Analytics Dashboard

## Objective

Bring Vercel Web Analytics traffic and AN1 custom events into the owner-only Platform Console.

## Route

`/platform/product-analytics`

Access is restricted through the existing Platform superadmin guard.

## Source

The dashboard reads the Vercel Web Analytics API for:
- page views and visitors;
- daily/hourly trend;
- top routes;
- referrers;
- countries;
- AN1 custom events.

## Refresh model

Vercel Web Analytics is near real-time. The Platform view refreshes every 60 seconds and offers a manual refresh button. Dashboard requests do not use an application cache.

## Reporting windows

- 24 hours: hourly trend
- 7 days: daily trend
- 30 days: daily trend

## Funnel views

Acquisition:
company search → claim start → account created → company registration submitted.

Activation:
weight calculator engagement → distinta saved → RFQ started → governed dispatch launched.

## Guardrails

The analytics access credential is server-side only. Product telemetry never sends company names, VAT IDs, email addresses, prices, RFQ text or recipient addresses.

Transactional source of truth remains Supabase and the canonical ledgers. Analytics is used for discovery, engagement and conversion evidence.
