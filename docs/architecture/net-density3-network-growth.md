# NET-DENS3 — Source-backed company growth without per-company review
Date 2026-10-17.

## Measured impact, production
Before density sprint: 31 canonical + 77 provisional = 108.
First-party official manufacturing seed A: 19 inspected, 15 new, 4 already staged.
First-party seed B: 17 inspected, 12 new, 5 already staged.
After both: **31 canonical + 104 provisional = 135**, or **+27 actually discoverable**. Both bulk batches are persisted as `network_core_target_leads` and rendered by `private.netfast_discovered_records` with "Da confermare". Exact steel-tube procurement is unconfirmed; do not report these as registered companies, customers, RFQs or licensed relationships.

## Structural intervention
The old source-preserving `public.netcov1_seed_official_cohort` is bounded to 40 and aborts all on one invalid row. Add `public.netdensity3_seed_first_party` with 1-200 items and independently isolated per-record validation. Source-domain and evidence checks, statuses, idempotent canonical-domain dedup, restrictions on material and role are delegated to **the existing** `private.netcov1_stage_core`, rather than introducing a weaker duplicate path. A rejected row does not cancel the cohort. Service role only, invoker, no public or company write; no copied company-site prose or personal contacts. Return actual new/duplicate/invalid counts per source batch. Network Free/Pro receives new records dynamically; canonical profiles stay unchanged.

## Sources and next scale
One-time first-party manufacturer cohorts have official homepages stored individually in source columns. EIMA is solely a discovery reference: do not wholesale copy the fair's exhibitor DB.
The existing Wikidata CC0 source is approved and its live ingestion has added 32 entities but is category-sparse. Continue automatically in parallel. The existing CORDIS monthly Horizon research intake is code-ready, yet **source remains unreviewed** with zero redistribution grant; evidence from [CORDIS Legal](https://cordis.europa.eu/about/legal/en) points to CC BY for Commission-owned editorial content, but third-party and dataset organization redistribution rights must be assessed before enabling for commercial SaaS. Source-specific approval is NOT replaced with an inferred approval. Existing Platform source and bulk approval surfaces must be used once per approved source, never per company.

## Next measurable gate
Reach 200+ nonduplicated visible companies via multiple batch seeds and licensed/CC0 datasets, record source-derived growth by intake_batch, then enrich region only when first-party evidence establishes municipality+province. New company claim and real connections remain separate.
