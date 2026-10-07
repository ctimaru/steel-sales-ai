# AN1.2 — Production Analytics Ingestion & Event Wiring

## Objective

Turn AN1.1 from a read-only dashboard into an end-to-end production analytics loop.

## Collection

Smart Steel Sales uses `@vercel/analytics@2.0.1`.

Pageviews are collected only on the public acquisition and utility surfaces. Dynamic identifiers, query strings and fragments are removed before a pageview is sent. Platform/staff/private application pageviews are not collected by the browser collector.

## Custom product events

Acquisition:
- `company_search`
- `company_claim_start`
- `registration_account_created`
- `registration_submit`

Activation:
- `weight_calculation`
- `distinta_save`
- `rfq_start`
- `rfq_dispatch_launch`

Server-side events are emitted only after the canonical operation succeeds. Analytics failures are non-blocking and never change the outcome of registration, distinta, RFQ creation or dispatch.

## Privacy contract

No event payload contains email addresses, VAT IDs, company names, RFQ text, supplier addresses, commercial prices or canonical entity identifiers.

## Diagnostics

AN1.1 exposes collector/API state:
- `token_missing`
- `api_error`
- `awaiting_data`
- `receiving`

An empty dataset is therefore distinguishable from a missing token or API failure.

## Operational dependency

The Vercel project must have Web Analytics enabled. The current ChatGPT Vercel connector does not have authorization for the `ctimaru-5113` scope, so project-level enablement must be verified with an authorized Vercel session.
