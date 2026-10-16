# CALC-INT3E.4 — International RFQ Conversion Analytics

## Contract
Four consented actions: handoff (validated calculator enqueue), bill_opened (including direct visits), email_copied (successful clipboard write), registration_click (a CTA click, **not** a completed signup).

Each action is named intl_rfq_<stage>_<locale> with locale EN/DE/FR/ES and one of four fixed stages. Only allowlisted system (eu/us/mixed/direct) and standard (en10210/en10219/geometric/api5l/astm-a53/astm-a106/astm-a500/mixed/unknown) categories are included as event properties. No personally identifying data, entered measurements, product free text, price, notes, customer data, RFQ IDs, session IDs, or query parameters are sent. Source norms remain procurement intent, not supplier certification.

## Consent and operations
No international custom events unless a current analytics consent record grants measurement. Blocked storage, unknown or expired consent fail closed; no retroactive events after opt-in. Existing consent UI now includes /de/, /fr/ and /es/ public paths.

Use the existing Vercel Web Analytics instrumenter and the same seven aggregated API requests; no new endpoints, databases, back-end writes, scheduled jobs, or service credentials. Superadmin product analytics reports four stages per language by counting the 16 fixed event names. The Italian public tool remains in the separate BD16 funnel.

## Interpretation constraints
These are aggregate event volumes, **not** uniquely identified customers, sequential cohorts, signup completions, or causal conversion rates. Direct bill arrivals can make bill_opened > handoff. A repeated email copy can count more than once. Consent can make collection incomplete. The existing country table is geographic page traffic, not a country-by-event RFQ funnel (not joined); do not infer country-specific RFQ conversion from it. The standard property is a validated source category at handoff and may be unknown for a direct bill visit.

Account-created attribution is intentionally deferred to a future reviewed, consent-safe first-party attribution flow. Existing v1/v2 browser contracts and copy-only public RFQ semantics are unchanged.

## Acceptance
- npm test, typecheck, Next build and relevant Chrome/mobile smoke.
- Privacy restrictions, EN/DE/FR/ES routes, EU/US/HSS handoff, source validation, successful copy only, CTA-click-only semantics.
- Existing seven Vercel analytics aggregation requests and truthful missing-token zero states.
- Protected CI success before merge; avoid manual redundant deployment.
