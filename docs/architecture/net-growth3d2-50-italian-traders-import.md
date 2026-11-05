# NET-GROWTH3.D.2 — First 50-Company Italian Trader Cohort

Date: 2026-11-05. Purpose: grow genuinely distinct Italian tube/steel distributors with each company's own publicly accessible source, without touching product UX, Commerciale, users, prices, RFQ, platform permissions, crawler, paid Network status, or canonical publisher.

## Delivered cohort
The company-by-company source of truth is `services/worker/data/netgrowth3d_traders_research_20261105.json`.
- **50** proposed separate Italian steel/tube trade identities (`trader_distributor`), each with named official HTTPS business site, tube/steel supply evidence, original factual English/Italian summary and same-domain source/role/identity links.
- **0** remaining review holds. A source-backed candidate is still **not** a legally verified company registration or an active approved supplier. The existing RPC only gives it provisional `needs_review` status.
- Steel exposure covers EN 10210/10219 structural tubes, mechanical/precision tubes, carbon steel welded/seamless, stainless welded/seamless, gas/water pipes and steel pipe fittings/systems.
- The six previously researched new domains from NET-GROWTH3.D are retained. All 44 added domains were evaluated by first-party public company web evidence, not copied from association listings. Dedicated sources checked include Industrialforniture, Vergalli, SIC, Inoxtubi Padova, Meris, Paci Paolo, Taricco, Venturello, Prosid, G.P. Inossidabile and other official product/stock pages.
- Some companies also offer cutting/processing or distribute general siderurgical products; no pure tube producer has been downcast to trader. The role is sourced from the offer/sales business model, not an assertion of company registration/ownership.
- Excluded direct duplicates already in the Network, e.g. Morandi, Vicini, Interacciai, TECRA, Pessina Tubi, Soluzioni Piping, Siderpighi and several dozens of prior source domains. **Geo.Fer** was found in existing `network_core_target_leads` as `Geo.Fer` on `ferrobattutotorino.com`, so its new `geofer.it` alias was **discarded** and replaced by the distinct `gpinossidabile.com` company. `inoxtubi.it` is another possible alias of Inoxtubi Padova (`inoxtubi.com`): count it once only. Producers/processor-only operators are excluded from this trader import.

## Security and acceptance
- No changes to production SQL schema, RLS or RPC. Reuse the existing `public.netdensity3_seed_first_party` API via service role and the `netgrowth3d_role_correct.py` guarded importer.
- Offline Python test validates **exactly 50** sourced traders; 50 distinct domain/name keys; zero holds; product evidence URLs must match exact company domain; negative tests for short batch, holds, role mismatches, false identity websites, aliases. No new pipeline scheduling or unattended import.
- Full live **read-only** SQL audit of the 50 companies checks six overlapping source registries (canonical, core targets, discovery, CC0, feed, opt-out) and additionally exact normalized names across canonical, core targets and discovery. **0 overlap after Geo.Fer removal**.
- **Real production RPC evaluated with `BEGIN; SET LOCAL ROLE service_role; ...; ROLLBACK;`** and returned `contract=netdensity3-bulk-v1`, `requested=50`, `new_unconfirmed=50`, `duplicates=0`, `invalid=0`, `published=0`, `verified_buyers=0`, and zero failed items. This was not a real import; separate post-rollback read confirmed **0 new batch rows**.
- Production baseline immediately before actual import: **278 canonical + 307 provisional = 585** discoverable company cards, 509 core target leads.
- Full protected **P0 Required Gate + FLOW1** must pass on the final PR head; integrate by protected merge in allowed deployment window; **do not rerun source write if already imported**.
- Real import must match *the exact reviewed manifest from merged main*, with the legacy `www` source-host adapter as needed. Explicit transaction under `service_role`, no manual bypass or direct table writes.
- After import, independently query core target batch, 50 `needs_review`, 50 distinct visible `private.netfast_discovered_records` with `origin=official_company_research`, canonical count unchanged, no new verified buyers; only then declare real growth. Conditional target **585→635**, but **never claim 635 before post-commit DB readback**.
- Post-merge frontend may show a Vercel CANCELED deploy because no `apps/web` source changed; a database reader readback is not an authenticated user/browser test.

## Follow-on industrial growth
`producer` and `processor_service_provider` remain on dedicated `netgrowth3d_stage_industrial` path, with their true industrial roles and separate reviewed 50–100 company cohorts. No conversion of producer or processors to trader for the purpose of reaching the numerical target.
