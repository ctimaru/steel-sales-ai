# CRAWL-IT6.5 — Approved-source candidate & controlled Italy discovery pilot

**Scope:** prepare the first legally documented *candidate* source, test a five-domain one-shot read-only preview, and wire the worker to ingest **only after an actual Platform Owner source decision**. No false "approved" or "running" status is inferred from CC0. No company publication, geocoding, or automatic contacts.

## First source: Wikidata (official structured data only)

- Endpoint: https://query.wikidata.org/sparql
- License: https://www.wikidata.org/wiki/Wikidata:Licensing — **structured statements CC0**, not general web text, Wikipedia articles, target companies' sites or third-party databases.
- Service rules: https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual — identify User-Agent, obey 429 and Retry-After, no broad crawling or high-frequency queries. One query, timeout 12 sec, max 512 KB response.
- Query: companies with Wikidata `P452=Q2285982` (iron and steel industry), `P17=Q38` (Italy), `P856` (official website); `LIMIT 20`, retain at most **5 distinct domains** for the initial source. Each lead carries its `https://www.wikidata.org/wiki/Q...` item URL as provenance.
- This **does not classify companies as merchants** or validate their location, legal identity, VAT, facility or commercial role. Wikidata may contain sparse/inaccurate coverage; duplicates and already known Network domains are skipped. Website is proposed only; not fetched by this adapter.

## Explicit two-stage activation; do not shortcut the human reviewer

1. The migration inserts one row into `network_discovery_source_registry`, **unreviewed and disabled**, `max_domains_per_run=5`, `minimum_interval_hours=168` (7 days), official license evidence URL, and provisional review note. No `reviewed_by` or `reviewed_at` is faked. The CRAWL-IT6.4 dashboard should still show **0 eligible enabled** until human approval.
2. Platform Owner visits **/platform/company-discovery/sources**, reviews official license, WDQS usage policy, personal-data minimization, chooses **Approvata / allows_reuse / low_risk / exclude_personal_data**, enters a reason, and separately attests the source's rights and bounded pilot. *Only* this exact Wikidata endpoint can be enabled in this pilot. Backend checks `discovery.governance_review` and the source ID/URL again; approval is recorded under the real authenticated user.
3. Worker **remains disabled** on Railway because `CRAWL_IT3_ENABLED` is currently **unset**. Changing the source registry does not start a job. The Platform Owner can first run GitHub Actions **CRAWL-IT6.5 Wikidata Read-Only Pilot (manual)** with 1/3/5 domain cap to see public data; this workflow has *no* Supabase key and performs zero writes.
4. Only after a successful read-only preview, verified source sign-off and an explicit operator decision, set Railway `CRAWL_IT3_ENABLED=true` for its existing worker service. The next worker cycle claims a source only if it is both approved and enabled, under a service-role-only atomic lease. Per-source interval is **7 days**, max **5 domains**, and poll cadence **1 hour**. Do not introduce a Vercel cron. For a one-off controlled run, return the flag to `false` after one successful lease/ingest; the recurring poll is not designed to be a job counter.
5. Leads enter `network_discovery_domain_leads` as `pending_review` with source ID, proposed HTTPS company domain and Wikidata Q-item provenance. Exact domain matches against active Network profiles are skipped by the worker; an additional human reviewed lead gate is required to queue a company-site crawler run, and a separate governed candidate review is required before publication. **Never automatically publish, merge, geolocate or ingest personal contacts**.
6. Metrics for the pilot: fetched one source / query; unique HTTPS website domains; count excluded (existing domain, duplicates); pending leads; approved leads; downstream identity duplicates; verified locations. Source license alone is not proof of company-level data accuracy.

## Explicit constraints

- Wikidata does **not** provide sufficient Italian *commercianti* discovery by itself. Follow-up CRAWL-IT6.6 should add a reviewed, specifically merchant-focused directory or opt-in company submission source with compatible database rights. Scraping arbitrary industry directories is prohibited until individually authorized.
- No real-company DB inserts from this microblock beyond the **disabled unreviewed source proposal**.
- A manual pilot is not a claim of successful continuous geographic scale-up.
- If WDQS 429/5xx or a timeout occurs, fail and do not retry automatically; respect WDQS limits and investigate before rerunning.

## Release acceptance

- P0 worker mock WDQS tests, source registry SQL, frontend review access, typecheck/build green.
- PERF1 synthetic roles; PERF2 mobile green when triggered.
- PR merge only after CI green; seed disabled source in Supabase production; verify 0 leads and 0 enabled sources.
- Manual dry-run and human review remain separate post-release gates. Worker runtime flag stays off until a human approves the source.
