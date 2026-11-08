# NET-IT-CARP1.B — First 130 candidates / P3 handoff

Date: 2026-11-08. Tracking: https://github.com/ctimaru/steel-sales-ai/issues/1199

## Readback
- 142 sites selected from province-oriented first-party web search; 130 new private candidates after 12 conflicts/exclusions.
- 130 unique domains added to `private.network_web_research_seeds`; prior NET-IT-CARP1.A had 58, total 188 distinct private research domains.
- Each of 130 is `not_published`, `web_sourced_unverified`, `unclaimed`, with proposed role `processor_service_provider`.
- Published canonical IT count stays 278 (4 older pending_review).
- 0 new suppressed domains, 0 source-rights decisions covering these domains, 0 new public profiles, 0 frontend deployments.
- Legal identities, sites, addresses, VAT, actual role, tube usage and reusable publication rights NOT verified. `source_summary` areas are search areas only, not certified company locations. Root URLs must be tested before crawling.

## Ready-to-review operational plan
Use existing P3 worker + public RPC `p3_start_company_discovery_batch` on two prepared seed URL batches (100 and 30): `services/worker/data/net_it_carp1b_p3_review_batches_20261108.json`. These payloads have NOT been invoked.

Authorized Platform operator with `discovery.run`: test sites, launch P3, inspect candidates. Authorized review of source rights and personal data via `pa1_5_review_discovery_run_governance` and `pa1_5_review_discovery_candidate_governance`. Only after documented positive controls, use `p3_review_company_discovery` with `publish_new` and `discovery.publish` permission; read back the published state and flag unclaimed/unverified.

Do NOT use `netcov2_operator_batch_stage` for this processor cohort: underlying `netcov1_stage_core` accepts only end_user/trader_distributor. Do NOT use `netfast3_bulk_import` without an approved licensed/granted feed. Do not invent tube usage, product certifications, legal company status or evidence permissions from web search snippets.

Next expansion: repeat territorial acquisition in 100–250 batches; keep identity/rights holds separate and minimize checks to those actually needed for publication.