# NET-CONNECT2E — Real Connection Activation

## What shipped
- Shared **recipient readiness** for both Network Free and Pro, derived from real active company/claim/recipient consent and block rules via the existing private P4 eligibility implementation.
- The read-only batch is bounded to 24 published canonical IDs. Only a real active company member may request it. Provisional discoveries never become invitation targets.
- Exact per-company statuses: **available**, **pending** (own outbound request), **connected** (own accepted outbound request), **unavailable** (including blocked/unknown). Blocking reasons, private contacts and recipient organization IDs are not returned.
- A compact discovery panel presents up to three truly available recipient profiles from the current page, not a dishonest global ranking. Original pagination, regional map and role relevance remain untouched.
- Free profile/connect route now use this real P4-equivalent readiness, removing a previous Pro-only eligibility read failure. Submitting a message still invokes the original NET-CONNECT1/P4 backend with full recipient ownership, rate-limit and anti-spam checks.
- Received requests now rank pending decisions first within the existing latest-50 query window. Explicit recipient decisions remain voluntary; no auto-message, auto-accept or automatic follow-up.

## Scope and anti-misrepresentation
This is **contactability at the read instant**, not a promise of response or verified supplier capability. A fresh validation happens during actual submission. All outages fail closed with an explicit unknown state. Company role controls prevent viewer submissions.

## Acceptance
New SQL guard checks, HP13 cross-tenant negative, required SQL gate, frontend source regression, Vercel preview, SEC1, Chrome QA and authenticated production follow-up. Apply SQL migration before Git main release, only after full required CI green.

## Next step
NET-CONNECT2F — Relevance & Reply Intelligence: only evidence-supported industry relevance, reply latency aggregated without revealing private contacts, human-in-the-loop follow-ups with consent.
