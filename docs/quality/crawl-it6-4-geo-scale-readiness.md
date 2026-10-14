# CRAWL-IT6.4 — Geographic Scale-Up & Network Population: controlled activation readiness

## Read-only production baseline (2026-10-14)
Queried the connected steel-sales-ai production Supabase with SELECT only:

| Metric | Verified value |
|---|---:|
| Total company profiles | 32 |
| Published IT companies | 30 |
| Published structured facilities | 3 |
| Published Italian companies with a published city | 3 (10.0%) |
| Published Italian companies without a published city | 27 |
| Geographic evidence candidates (pending / approved) | 0 / 0 |
| Approved and enabled source registry entries | 0 |
| Discovered-domain leads | 0 |
| Official ISTAT municipality reference entries | 0 |

These numbers are a **baseline**, not a claim that the crawler is running. This microblock does **not** acquire or publish new companies without a rights-approved source.

## Delivered
- `crawl_it64_geographic_scale_snapshot()` — *read-only* aggregated SQL RPC, scoped behind `discovery.read`. Counts active published Italian companies and distinct companies with an eligible published Italian facility containing a city; website-bearing gaps; pending/approved/conflicted geo candidates; official municipality reference count; source governance and enabled eligible source count; unreviewed discovered-domain leads.
- `/platform/company-discovery/coverage` — Platform-only live readout, separate from Workspace and public Network, linked from Company Discovery and Governance. Safe "unavailable" state if migration/RPC not available; never convert errors to zero.
- Staged activation *advice*, not an activation button. The registry gate is considered ready only if at least one source has explicit approval, use rights, personal-data handling, a human reviewer, timestamp and evidence URL. Even then **Railway worker state is unknown from this DB**; no implication that crawling is active.
- Local disposable SQL permission checks and Chrome acceptance for synthetic Platform Owner vs Company A/B, Company Viewer and registration-only staff. 320/390/768/1440 UI overflow checks, role-denied route checks and default-off activation copy.

## Controlled source and publication rules
1. Obtain and check rights evidence for potential Italian source directories or association listings. Register sources **disabled**, then explicitly approve only those permitting reuse. Do not treat discoverable information as licensed for database harvesting.
2. Do not set `CRAWL_IT3_ENABLED=true` or create a new cron automatically. First perform an explicitly authorized one-off/small Railway dry run against verified source(s), within existing <20 domain-per-source and existing throttling constraints. Check robots, SSRF, duplicates, and rights again.
3. Domains remain `pending_review` in `network_discovery_domain_leads`; human selection then invokes the existing guarded company crawler, preserving source evidence and deduplication. No automatic publication.
4. Existing-company geo endpoint remains **manual dry-run by default**, at most 5 approved-domain company sites per request. Retrieved JSON-LD addresses enter `network_it_geo_evidence_candidates` only after explicit non-dry-run authorization, then human geo review. Head office != confirmed facility.
5. Official ISTAT dataset remains an independent gate. With the reference table empty, do not infer official province or city coordinates. Never fabricate a geolocation or silently update a published facility.
6. Measure coverage delta **only after human review and governed facility publication**. Missing or unavailable data must not be described as a successful improvement.

## Acceptance / rollout
- CI P0 frontend + Supabase migration and SQL ACL test green.
- Disposable PERF1 Chrome test (Owner allow, company/viewer/staff deny, default off) green.
- PERF2 mobile/performance green if triggered.
- Merge to main only with green gates. Deploy SQL migration through the established Supabase production migration process, verify RPC ACL and run an authenticated Owner smoke check. Avoid exposing a service key to any Next browser client.
- Do not activate autonomous sourcing while approved source registry = 0. This is a **readiness exit**, not a fake Italy-wide population milestone.

## Next practical block: CRAWL-IT6.5
Approve a first small set of legally reusable Italy sources (with provenance) and an explicit authorized Railway dry run; use the resulting *unique* pending leads to prioritize traders and later end-user/processor RFQ acquisition. Prohibit company publication without separate governed identity resolution.
