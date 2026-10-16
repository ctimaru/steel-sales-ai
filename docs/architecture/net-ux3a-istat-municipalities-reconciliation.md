# NET-UX3A — ISTAT Municipality Reference Import & Geographic Reconciliation

## Official source and license (verified 16 October 2026)
- ISTAT permanent XLSX permalink: https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.xlsx
- Official page: https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/
- Updated 21 February 2026: **7,894 municipalities**, after Castegnero Nanto fusion; 20 regions. Sardinia province and municipality codes recoded effective 1 January 2026.
- Source released under **Creative Commons Attribution 4.0**, attribution ISTAT. Never claim the dataset is proprietary Smart Steel Sales data.
- XLSX permalink may update in place: **sha256** is printed and recorded per applied batch. A changed file requires fresh validation/review.

## Baseline
- Production NET-UX3: 31 published Italian companies, 3 with published region, 28 without.
- ISTAT reference table empty at audit. New code never invents municipality rows and never creates/publishes company facilities.
- Existing worker `istat_import.py` already validated manually normalized CSV, but not direct XLSX. Legacy parser retained as `istat_import_legacy.py`.

## Import mechanics
1. Official file is downloaded via HTTPS pinned to `www.istat.it` only. No GitHub mirrors, mixed datasets or guessed province data. Row parser identifies reviewed official ISTAT columns, fails closed if schema changed.
2. Validate exactly 7,894 distinct six-digit municipality codes, 20 region codes, nonempty names, province sigla and identity, and 2026 Sardinia 112–119 recoding.
3. Every municipality is staged into `network_it_istat_import_staging`, attached to a batch with reference date + file SHA256. Staging is **service_role-only**, RLS enabled.
4. `netux3a_activate_istat_import` runs atomically, confirms completeness, activates upserts and marks absent codes inactive without deleting historic records (needed by foreign keys to reviewed matches). No company or facility edits.
5. Review the preview workflow and its SHA256 log first. Production import workflow is **manual only**, from `main`, with GitHub repo variable `NETUX3A_APPLY_ENABLED=true`, `NETUX3A_SUPABASE_URL` and dedicated `NETUX3A_SUPABASE_SERVICE_ROLE_KEY` secret. The workflow can be disabled by resetting the variable; the preview uses no DB credentials.
6. Idempotency: same approved SHA+reference date returns already activated; incomplete staging can retry without creating duplicate municipality codes.

## Geographic matching
- Platform / Company Discovery / Geo Review / Riconcilia comuni e province.
- For a **published facility**, operator must provide province code and first-party company-site URL+excerpt explicitly showing **both city and province**.
- `netux3a_stage_facility_match` matches one active ISTAT municipality using *city + province*, requires region agreement, creates only `pending_review` in existing `network_it_facility_geo_reviews`.
- `netux3a_decide_facility_match` requires `discovery.publish` AND `discovery.governance_review`. Approval exposes the correct province in existing Pro `m6_search_network_geo`; **does not rewrite existing facilities or mark company verified**.
- No automatic generation of provinces, GPS pins or promoted crawler candidates. 28 unlocated companies need NET-UX3 documented evidence and publication first.

## Acceptance
- [ ] Official XLSX preview workflow download+header+7894 count+sha confirmed.
- [ ] P0 local Supabase reset, HP13 RPC boundary, negative incomplete import test.
- [ ] Worker pytest parser tests and frontend build.
- [ ] Only after explicit approval: manual production import and 7,894 active rows verified.
- [ ] Chrome authenticated role/municipality acceptance.
