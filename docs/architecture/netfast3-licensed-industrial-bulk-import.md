# NET-FAST3 — Licensed Industrial Dataset Expansion & Bulk Ingestion
Date: 16 October 2026

## Goal and honest baseline
The NET-FAST2 automated CC0 Wikidata import ran successfully but returned zero net-new companies on its first day. Network currently has **31 published canonical companies + 17 distinct "Da confermare" previews**. Do NOT conflate source record count with verified buyers or published companies.

Make a high-throughput **500–1000-row structured company dataset import** practical after **one approval of the dataset redistribution rights**, instead of manual approvals for each company. Bulk importer is implemented; this release DOES NOT assert that a new commercial dataset licence has already been acquired.

## Rights and source choices
- One source requires an existing `network_discovery_source_registry` review: source type `licensed_search` or `curated_public_source`, country IT, approved, explicit terms and database rights, personal-data restrictions and a referenced licence. The separate grant `netfast3_grant_feed` documents actual **external SaaS resale/display rights**, licence reference, expiry and reviewing Platform identity. Source enable-for-crawling is NOT changed; bulk ingestion is not a grant for website scraping.
- CORDIS European Horizon data are a promising official, monthly published company/project dataset. Its generic European Commission CC BY policy cannot substitute for reviewing **the exact dataset distribution rights**, extra beneficiary/third-party material and whether organization websites and names can be republished. No CORDIS grant is automatically recorded. EU source: https://data.europa.eu/data/datasets/cordis-eu-research-projects-under-horizon-europe-2021-2027 and CORDIS copyright: https://cordis.europa.eu/about/legal/en.
- Italian CCIAA Marche and regional enterprise "open data" found in research are largely **aggregated counts by ATECO and region, not company-name directories**. Never create fictitious company profiles by misreading a statistical row as a company.
- Provider licensing for other sources remains undecided: do not repurpose RNA or Registro Imprese/Telemaco's restricted rows without authorization.

## Implementation
- 4 private RLS-controlled tables: licensed source redistribution grants, individual business-only entities, import batch metrics and cross-source domain suppression. No anon/authenticated direct table access.
- `netfast3_bulk_import` takes at most 1,000 records per atomic call, restricted to `discovery.enrich` Platform operators and sources with an **active, separately approved grant**. Names, normalized company domain, provider record ID and *optional tentative role* only. No emails, phone numbers, natural-language website text or tenant data.
- Suppress duplicates against canonical Network companies, existing discovered candidates, NET-COV research targets, NET-FAST2 CC0 entities and existing NET-FAST3 records. A rejected or opt-out domain never becomes a listing.
- `netfast3_source_status` shows source grant expiry, total imported and last ten batch metrics. `netfast3_revoke_feed` immediately hides that source's provisional records; `netfast3_suppress_domain` permanently hides a domain across *all* discovery overlay sources and future licensed reimports.
- `private.netfast_discovered_records` dynamically includes active-granted records only. All show **"Scoperta dal Network · Da confermare"**, with an uncertain rather than inferred role, website, provider page and visible license link in the profile. Canonical publication is unchanged. No region guessed.
- New Platform route `/platform/company-discovery/bulk`, linked from Source Registry: one source grant form, CSV/TSV file or Excel paste, 1–1,000 records (max 450KB), summary, revocation and takedown controls. The parser accepts quoted delimited text (with or without header `name,domain,record_id,role`); role defaults to `unknown`. Re-imports idempotently yield duplicates rather than duplicate records.

## Operator usage
1. Research a redistributable industrial companies **dataset with actual rows identifying individual companies and company websites**. Read distribution-specific commercial display/reuse licence. Register in Platform Source Registry with `licensed_search`, review as approved, keeping ordinary website crawl OFF.
2. In `/platform/company-discovery/bulk`, grant the dataset once, recording proof/expiry and applicability to commercial display in Smart Steel Sales.
3. Download source's legitimately reusable company CSV, retain only `name, domain, record_id, role` and Italy business records, import chunks of up to 1,000. For unknown buyer category use `unknown` rather than guessing.
4. Check exact new/duplicate/skipped metrics and browse Network Free as an active-company user. For removal, use suppress-domain; for revoked contract, revoke-feed. No per-company approval.
5. Never claim nonzero new companies or verified purchasers unless confirmed from the production data after a real import.

## Acceptance
- Local Supabase migrations + P0 SQL negative checks; frontend Node tests and Next typecheck/build; optional authenticated production visual acceptance.
- Production migration, live grant/records count and ACL check, merge CI and Vercel deploy. No fictional commercial licences are seeded.

## Next
NET-FAST3B: provider-specific **scheduled ingestion** for an actually licensed source (starting with CORDIS if the distribution licence is confirmed), CSV columns adapter/streaming/chunks, review reuse rules once, scheduled update, reliable company-count growth. NET-FAST4: large-scale server-side pagination and opt-out/takedown SLA, licensed provider cohorts by ATECO and region without guessing geography.
