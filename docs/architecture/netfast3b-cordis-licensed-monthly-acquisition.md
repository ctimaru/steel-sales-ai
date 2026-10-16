# NET-FAST3B — Automatic CORDIS Horizon Europe Research Intake (16 October 2026)

## Business objective
Increase the industrial Network's company-research density without manually downloading CSVs or approving each business. Existing NET-FAST3 source-specific approval applies once to the dataset, NOT to every organization, and does not grant website crawling rights.

## Source verified
- Official dataset: https://data.europa.eu/data/datasets/cordis-eu-research-projects-under-horizon-europe-2021-2027
- Horizon Europe bulk CSV ZIP: `https://cordis.europa.eu/data/cordis-HORIZONprojects-csv.zip`
- CORDIS legal notice: https://cordis.europa.eu/about/legal/en
- CORDIS releases are monthly, with project and organization records in separate CSVs. Organization records commonly have `organisationID`, `name`, `country`, `activityType`, `projectID`, but DO NOT guarantee a company website. Project website links must NEVER be substituted for company homepages.
- Copyright notice: EC-owned editorial material generally CC BY 4.0 with attribution, third-party beneficiaries and rights not automatically covered; confirm **this distribution's organization metadata reuse for externally visible profiles in a commercial SaaS**. No dataset grant is fabricated.

## Engineering delivered
1. Register exactly the CORDIS dataset source as an `unreviewed`, crawl-disabled candidate in `network_discovery_source_registry`. Even the pre-registration does not infer permission.
2. Private RLS tables `network_netfast3b_cordis_runs` and `network_netfast3b_cordis_research`. The second is a *research-only* pool, not Free Network and not published companies. Only Italy, private for-profit CORDIS participating organizations (`IT` / `PRC`) are eligible. Deduplicate by `organisationID` (multiple projects ≠ new company).
3. Service-role RPC `netfast3b_cordis_open` checks a valid reviewed source and the separately approved NET-FAST3 dataset grant **before any external download**. One monthly snapshot run, max 30k distinct research candidates and 500 rows per transaction.
4. Runner reads only official same-host `cordis-HORIZONprojects-csv.zip`; no redirects, bounded 90MB zipped / 150MB `organization.csv`, strict CSV schema and official-domain parser. It never visits businesses or harvests email, VAT, phone, individual contacts or project copy.
5. `netfast3b_cordis_commit` saves organizations without site as `needs_official_website` research leads, not visible cards. Only an unambiguous organization-homepage column, a valid domain and an industrial-name clue can create a provisional `network_netfast3_entities` company card, still clearly **Da confermare**, with grant-based visibility and source attribution. It prevents canonical, crawler, researcher and opt-out duplicates. No auto verified company promotion.
6. Monthly GitHub Action on the 5th at 03:47 UTC and one-time main push dispatch, reusing configured dedicated Supabase secret. Explicit one-shot dry preflight returns `skipped / cordis_source_rights_not_approved` without fetching any CORDIS ZIP while not approved. No external-API licensing assumption.
7. Platform bulk console displays grant readiness, research-only count, available-company websites and monthly batches. Existing owner workflow is: review source in /platform/company-discovery/sources (enable ordinary crawl OFF), approve the distinct dataset reuse grant in /platform/company-discovery/bulk, and let the monthly workflow run.

## Known limitations (strategically important)
- CORDIS is **not an Italian industrial company registry**. Its participant pool includes entities outside steel and metal manufacturing. No claim of tube purchasing, commercial customer status, capacity, geographic operating sites, or supplier performance is made.
- CORDIS organization rows may lack website URLs. Missing domains are deliberately kept private as research leads until linked to an authoritative company site. Do not report these as visible company growth.
- If the dataset rights are not approved, the workflow is intentionally no-op; this is not a software error. No new company feed/license claims should be made without actual evidence.
- Do not equate research records, automatically visible previews, and published canonical Network companies.

## Acceptance and next
- P0 Required Gate: Python parser negatives, frontend, SQL unauthorized access, empty unlicensed-source gate and local migrations.
- Verify application in production; source remains unreviewed, zero grant, zero CORDIS imported data until operator approval. Verify first triggered job reports skipped without network download. Merge and Vercel deployment.
- **NET-FAST3C**: automated high-coverage matching of research-only organization names to *authoritative* company homepage evidence or actually licensed Italian industrial firm dataset; use no unlicensed site harvesting. Add source coverage and useful Network density KPIs separated by confidence.
