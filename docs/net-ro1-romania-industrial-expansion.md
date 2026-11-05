# NET-RO1 — Romania Industrial Network Expansion (5 November 2026)

## Decision and scope
Create a Romania-only industrial acquisition lane in the existing European Network. Reuse the Italy source/evidence governance, but do not merge Romanian acquisition metrics with Italy. No decorative frontend work, no automatic outreach, no company claim, no production import and no changes to global publisher state in this phase.

This is a **research-only branch**. Romanian profiles are *candidates*, not registered suppliers, legally verified entities, or production records.

- Git branch: `feat/net-ro1-romania-industrial-expansion` from `main`.
- Reference: [NET-GROWTH3.F Italy](https://app.notion.com/p/40ff059cecb58184a284e22c2ffa3304).
- Independent production baseline as of 2026-11-05: 278 canonical + 408 provisional = 686 (not attributable to RO).
- The existing EU country UI supports ISO alpha-2 `RO` (EUROPE1A). No RO/NUTS geography or correct RO company counts can be inferred from country-selector availability.

## Acquisition targets
Primary personas:
1. **Producers**: welded structural tube/HSS, hollow sections, industrial pipes; distinguish seamless vs welded and infrastructure pipes vs EN 10219 structural products.
2. **Traders/distributors**: stockholders supplying structural steel tubes/profiles and relevant industrial pipe products.
3. **Processors / subcontractors**: tube laser cutting, bending, profiling, welding, galvanizing, fabrication when expressly sourced.
4. **End-users**: steel fabricators, OEMs, machinery and agricultural-equipment manufacturers — **second wave**, never infer that they buy steel tubes from their business sector alone.

Territorial focus, not an exhaustive market-size claim: Bucharest/Ilfov, Galați, Iași, Olt/Slatina, Sălaj/Zalău, Giurgiu, Prahova, Brașov, Cluj, Timiș, Mureș. Keep legal entity separate from facility and group subsidiary. City/județ must be backed by evidence; store unknown when absent.

## RO1.1 — First-party research seed
See `services/worker/data/netro1_romania_first_party_research_20261105.json`.
- 10 candidate *websites* sourced from company-owned pages; **not yet confirmed as 10 distinct new legal identities** against production, opt-outs, or six existing registries.
- 4 producers, 4 traders/distributors, 2 processors; roles are candidates requiring source and legal review.
- Domains of multinational groups require special identity handling: `tenaris.com`, `vanleeuwen.com` and `metinvestholding.com` cannot each stand alone as a legally unique Romanian company key.
- Every technical claim has an evidence URL; lack of explicit EN 10219/10210 or S235/S355 reference means *unknown*, never inferred.
- Licensing/reuse rights, current legal status, tax/registration ID, opt-out and database uniqueness are **pending**. Only public company information, no personal contacts.
- Research records must not be passed to the production RPC. `mode=research_only`, `production_write_authorized=false`.

## RO1.2 — 50–100 source-backed Romanian company cohort
- Search in Romanian (țevi oțel, profile tubulare, țeavă sudată, debitare laser țeavă, furnizor/distribuitor, prelucrare metal), supplemented by official company catalogs and trade-association member pages **only for discovery**; confirm via company sites.
- Legal-identity and facility dedup across existing company catalogs and country-scoped group records, with no overwrite of canonical records.
- Evidence ledger per company: legal name, domain, country, locality/județ, role, product family, material, technical claims with URL, observed date, rights review, review status; unknown fields remain null.
- Segment each record as **net new**, **existing enrichment**, or **hold**; these are not interchangeable KPI classes.

## RO1.3 — Protected import/readback (separate approval gate)
1. Production read-only snapshot; six-catalog collision and opt-out screening, material/role/rights/legal checks.
2. Offline unit tests and service-only SQL transactional preflight with ROLLBACK; check cross-country preservation, ISO RO, reader visibility and security.
3. Required GitHub checks green; protected review/merge. **No autonomous production write in RO1.1.**
4. Authorize one idempotent atomic service-role RPC import of a distinct batch. No SQL inserts or blind retries.
5. Independent post-COMMIT readback: requested, added, duplicate, held, invalid, per-role, country RO, verified distinct domains, provisional review state, canonical unchanged, search visibility by RO; authenticated browser QA 1440/390/320 px separately.
6. Report actual added rows only from production readback. Never count research leads as production companies.

## AI-ready capabilities and acceptance
Data dimensions: `company_identity` · `industrial_role` · `product_family` · `technical_claim` · `process_capability` · `source_url` · `review_status` · `rights_status` · `country_code` · `județ`.
Test with (a) HSS supplier near a named city, (b) tube laser processor with stated capacity, (c) manufacturer with specific standard. Return *not documented* if no evidence. Do not fabricate steel grades, sizes or capacity and do not connect private Commercial Memory to shared Network.

**Status:** branch and research seed in preparation; import count **0**; production unchanged.

## NET-RO1.2a — Independent Romanian market screening and growth wave (2026-11-05)

**Outcome:** 25 research candidates across the first two waves, all source-backed *at website level*, no production import and no legal/rights sign-off: 6 candidate producers, 14 candidate traders, 5 candidate processors, 50 claimed product/process/role facts with source URLs. This is *not* a verified 25-company additions count. There are 15 new domains in `netro1_2a_romania_research_wave_20261105.json`; 10 original domains remain in `netro1_romania_first_party_research_20261105.json`.

**Observed, read-only Supabase screening** on `ecrafjdummcdfycznitx` using exact normalized domains across six existing catalogs (`public.network_companies`, `public.network_core_target_leads`, `private.netfast_discovered_records`, `public.network_netfast2_structured_entities`, `public.network_company_discovery_candidates`, `public.network_discovery_domain_leads`):
- First ten: **two exact domain collisions**, both multinational shared group domains. `tenaris.com` is already linked to Italian `Dalmine S.p.A.` in `network_companies` and Italian Tenaris in discovery; `vanleeuwen.com` is linked to Italian `Van Leeuwen Italia S.p.A.` in canonical and lead catalogs. This is **not** evidence that Romanian `SILCOTUB S.A.` or `Van Leeuwen Romania S.R.L.` are duplicates as legal entities: legal country-scoped uniqueness needs adjudication.
- New fifteen: **zero exact-domain hits** across six registries. This does not establish 15 legally independent or completely new entities; group, name, VAT, legal status and opt-out checks remain.
- `public.network_companies` country-code breakdown at read time: **282 IT, 0 RO** (other provisional catalogs do not expose reliable country for every row). The historical 278 published canonical + 408 provisional = 686 is a baseline from an earlier independent readback; these are different populations, so do not equate or add them.

**Industrial relevance holds and caveats:**
- `miras.ro` lists multiple MIRAS companies; map the chosen legal entity `MIRAS STEEL TRADE S.R.L.` to its proper site/facilities, not the group root alone.
- `tenaris.com` / `vanleeuwen.com` shared global domains MUST NOT be used as globally unique company keys; use country + legal identity after verification.
- `kovostroj.ro` rectangular tubes are described among group products; confirm they are made by the Romanian legal entity.
- `laserprocessing.ro` and `comelf.ro` document general steel/profile processing but **not specific tube cutting** at reviewed pages; keep relevance *on hold* rather than inventing tube capability.
- `lio-metal.ro` displays S235 for welded tubes, not automatically EN 10219. `baurom.ro` and `intacteco.ro` explicitly document EN 10219; `otelstructuri.ro` documents EN 10219 and EN 10210, but legal storefront verification is pending.
- All research records: `research_only`, no PII, no contact outreach, no private commercial memory, `production_write_authorized=false`.

**Next gate (RO1.2b):** reach 50–100 first-party candidates with stable legal identity, rights and source audit ledger, classify `new`/`existing-enrichment`/`hold`; complete offline validator and protected CI. Production import `RO1.4` remains a distinct gate after legal, opt-out and source-rights approvals. RO1.2a **does not authorize import or merge**.
