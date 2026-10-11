# CRAWL-IT6.2 — Existing-company geographic enrichment

## Production baseline, 2026-10-11
- 32 active companies (30 published); 3 published structured locations
- 27 published company records missing facilities have a website URL and exact domain
- ISTAT municipality reference remains empty; do not invent province or facility verification

## Controlled pilot
A token-guarded Railway worker endpoint `POST /v1/network/geo-enrichment/existing-companies` accepts `{"dry_run":true,"limit":5}` (defaults) or explicitly `{"dry_run":false,"limit":5}`.

- No scheduled invocation. No extra Vercel cron or function work.
- Select published IT companies with verified website field and without published facilities or existing geographic evidence. Each invocation checks at most 5 eligible domains and retains the existing robots/SSRF guards and 10-second timeout.
- Only HTML JSON-LD PostalAddress on the **exact matching company website** can be staged. Non-Italian locations and missing municipalities are rejected.
- Dry-run returns counts, creates no records. Explicit write stages only `network_it_geo_evidence_candidates` in `pending_review`.
- Human decision takes place in Platform → Company Discovery → Governance → Revisiona sedi Italia. No facility publication or company profile mutation.
- Dedup occurs through existing candidates and the database unique key. Conflicting writes require re-evaluation, not silent overwrites.

## Release sequence
1. CI worker tests including no-write dry run and cross-domain rejection.
2. Merge only after green gates.
3. Inspect Railway deployment and worker token readiness; do not claim live until checked.
4. Execute an authorized dry run of at most five sites; review candidate/error counts and actual source identity.
5. Separately authorize a first live intake of at most five websites; review sources, avoid mislabeling legal office as factory.
6. Measure coverage after governance review and controlled facility publication in a later microblock.
