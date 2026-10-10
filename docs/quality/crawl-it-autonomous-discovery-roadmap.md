# CRAWL-IT — Autonomous Italian company discovery and geographic coverage
**Implementation status (2026-10-10):** CRAWL-IT1 geographic evidence handling and tests in this PR. Continuous discovery scheduling is a subsequent gated delivery, **not yet active**.

## Architecture: worker-led, not Vercel-led
1. **Authorized source registry**: industry associations, public business directories, licensed search providers and user-submitted lists. Store the exact source, terms/database rights, allowed use, robots policy, review actor/time, allowed country `IT`, refresh interval and rate budget. Never assume that publicly visible means reusable.
2. **Discovery scheduler on Railway**: disabled by default until source approvals. Round-robin region and sector, daily batch caps, timeouts, exponential backoff, per-domain throttling, idempotency and lease-based single-worker ownership. No Vercel cron or repeated frontend builds.
3. **URL harvesting** from approved directories/search sources into candidate domains; **do not** treat directories as companies. Compare against canonical domains, VAT and existing company identities before fetching, avoiding repetitive crawls.
4. **Existing FastAPI crawler**: robots and SSRF controls, up to 5 pages per company, JSON-LD company/facility extraction, classification, evidence, source URLs, candidate review queue. Keep all results in staging until approved.
5. **Geographic evidence**: country IT, municipality, province code, region, postcode, explicit source URL, confidence and review state. Accept schema.org PostalAddress; never extrapolate region from city or province without a versioned official municipality/ISTAT mapping. A postal code alone cannot prove a specific company facility.
6. **Geofilters**: publish `country / region / province / city` only from approved and normalized structured location records. Present `location unknown` separately. Ambiguous locations require manual verification, not automatic geocoding.
7. **Source-level and candidate-level governance gates**, dedupe, rights, private-data exclusion; no autonomous approval or publication.

## First operational objective: Italy
- **Demand first**: identify and qualify `end_user` manufacturers who consume steel tubes; avoid false buyer classifications based on general industry mentions.
- **Supply**: add unmatched traders, producers and processors only, after identity resolution.
- **Regional spread**: start Lombardia, Veneto, Emilia-Romagna, Piemonte; then expand nationwide. These are *planned campaign targets*, not evidence that profiles are present there.
- **Pilot operating budget**: first 10 approved source domains, <=20 discovered company domains per run, <=100 site fetches per day across approved sources. These are initial configurable *targets*, not currently enforced runtime quotas.

## Required microblocks
- **CRAWL-IT1**: Normalize sourced regions and preserve province evidence in worker candidate JSON; test. (This PR.)
- **CRAWL-IT2**: Approved-source registry schema and operator governance, including legal evidence, source refresh controls and permissions.
- **CRAWL-IT3**: Source discovery adapter (provider or licensed directories), scheduler and durable idempotent domain staging. Default off until IT2 source approvals.
- **CRAWL-IT4**: Official ISTAT municipality/province/region reference and location reconciliation; promote only approved locations to Network Facilities.
- **CRAWL-IT5**: Network filters and coverage observability; Chrome multi-account test, controlled pilot and activation.

## Release gates
- Do not deploy autonomous source search without provenance, licensing and rate controls.
- Do not automatically publish companies, personal information, identities or facilities.
- Do not infer a region if evidence only provides a city/province abbreviation.
- No new automated infrastructure costs without measuring candidate uniqueness and verified location coverage.
- Baseline: 32 Network companies, 3 structured facilities, 0 end_user role assignments, 43 pending Discovery candidates (all IT).
