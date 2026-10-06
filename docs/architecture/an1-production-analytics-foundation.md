# AN1 — Production Analytics Foundation

## Objective

Create a privacy-conscious production analytics baseline for Smart Steel Sales so launch decisions can use real visitor, acquisition and product-funnel evidence instead of raw infrastructure request counts.

## Data sources

- Vercel Web Analytics: page views, visitors, routes, referrers, country, device and browser.
- Vercel custom events: product and conversion milestones.
- Existing Vercel Observability remains the source for infrastructure request counts, errors and runtime diagnostics.
- Google Analytics remains a separate consent-governed integration and is not required for AN1.

## Event contract

| Event | Meaning | Allowed metadata |
| --- | --- | --- |
| company_search | Public company lookup completed/failed | context, status, mode, results |
| company_claim_start | User starts claim flow from a claimable profile | context, claim_state |
| registration_account_created | Supabase account created successfully | flow |
| registration_submit | Company application submitted from validated form | flow, company_type, country |
| weight_calculation | User actively copies a calculated tube result | action, standard, family, has_target |
| weight_calculator_share | User copies a shareable calculator URL | standard, family |
| distinta_copy | Buyer copies a completed distinta | line_count |
| distinta_save | Buyer saves a private distinta | line_count |
| rfq_start | Saved distinta is converted into an RFQ Hub campaign | source, line_count |
| supplier_dispatch_complete | Direct supplier dispatch completes | source, supplier_count |
| rfq_dispatch_launch | Governed RFQ campaign launch completes | supplier_count, sent_count, failed_count, has_deadline |
| rfq_dispatch_retry | Governed retry completes | sent_count, failed_count |
| rfq_dispatch_reminder | Governed reminder run completes | sent_count, skipped_count, failed_count |

## Privacy guardrail

Analytics events MUST NOT contain:
- email addresses;
- supplier recipient addresses;
- company legal names or VAT IDs;
- RFQ IDs or claim references;
- RFQ message bodies;
- prices, target prices or quote values;
- free-text descriptions or uploaded document content.

Telemetry is best-effort. Analytics failures must never block authentication, registration, calculation, save, dispatch or RFQ workflows.

## Production activation

Code integration uses @vercel/analytics and the root Next.js Analytics component. Vercel Web Analytics must also be enabled for the steel-sales-ai project in the Vercel Analytics dashboard. Tracking begins after an enabled deployment is live.

## Acceptance

- npm test passes.
- npm run typecheck passes.
- npm run build passes.
- production deployment is READY.
- a real production pageview appears in Vercel Web Analytics after enablement.
- at least one safe custom event appears after an eligible user action on a plan that supports custom events.
