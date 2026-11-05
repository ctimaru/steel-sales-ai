# NET-RO1.4 — Web Growth & Claimable Company Profiles

**Decision 2026-11-05:** For Smart Steel Sales Network, focus on expanding the industrial company database with source-linked online business facts. Formal visure and ONRC documents are deferred for research intake. The company owner can claim and enrich the profile later.

## Results

| Romania source wave | Unique candidate domains | Producers | Traders/distributors | Tube processors |
| --- | ---: | ---: | ---: | ---: |
| NET-RO1.1 + 1.2a + 1.2b | 50 | 9 | 30 | 11 |
| NET-RO1.4.WEB-GROWTH1 | 17 | 1 | 13 | 3 |
| **Total researched domains** | **67** | **10** | **43** | **14** |

New manifest: [17 web-sourced candidates](../services/worker/data/netro1_4_web_growth_first17_20261105.json).

17 first-party sourced domains: tubomet.ro, metaldistribution.ro, steelhaus.ro, baduc.ro, conbuz.ro, profilometal.ro, smp-srl.ro, metalworx.ro, nordcut.eu, productie-plase.ro, aepartnergroup.ro, adianacom.ro, grosmetal.ro, mathaus.ro, comsport.ro, limshome.ro, utchimsteel.ro.

All 17 were screened in production **read-only** against six company catalogs on 2026-11-05: no exact normalized domain/name matches. This is NOT proof of legal/company uniqueness or live public profiles.

Examples of role correctness: Tubomet is a welded-tube producer; SILVESROM produces mesh/fencing but **distributes** steel tubes; SMP, MetalWorx and NordCut offer tube/profile laser services. LimsHome and teava-rectangulara.ro appear to share contact details; count only LimsHome and flag possible alias. General retailers do not automatically qualify as industrial RFQ suppliers.

## Fast track database expansion, not false verification

Versioned additive SQL migration: [private web-company research staging](../supabase/migrations/20261105133000_net_ro1_web_seed_research.sql). Intended result: 67 company website research seeds in a **private**, RLS-protected, country-scoped, service-role-only table. 50 original + 17 new domains, idempotent inserts, role, source link, conservative own-word factual summary and explicit ambiguity lane. It never writes to the public company directory and never approves unverifiable details. Production row count must be independently checked before reporting data as actually staged.

Existing discovery tooling supports country RO via an authenticated batch function, but a valid platform-permission user context is required. Do **not** impersonate an admin or bypass its permission gate. Also do not use the Italian-only industrial RPC to import Romanian traders.

No personal names, personal phones, automated outreach, logos, copied product text/images, certification claims, CUI or ownership assertions have been added. A research site candidate is not a guaranteed current company; unknown facts remain unknown. Opt-out or company correction requests still take priority.

### Claimable public company UX (after safe promotion)

A compact profile should immediately show the company name, country, role, one-line factual industrial activity and source website. Clearly indicate **Profilo non rivendicato** and have one visible CTA **Rivendica questa azienda**. The owner, after affiliation checks through existing onboarding, can add capabilities, product forms, standards, grades, dimensions, stock/production locations, services, documents and RFQ preferences. Never display unsupported certifications or infer manufacturing from trading. Keep desktop/mobile Network UI compact without adding menus.

The private research table can never be directly marked published. Public unclaimed profiles require an explicit, separately reviewed projection through existing governance; claim does not mean the platform independently certifies the supplied statements.

## Roadmap and check gates

- [x] 17 extra first-party industrial sites sourced, 17 exact catalog screens.
- [x] 67 cumulative research website candidate domains and 3 canonical roles.
- [x] Private country-coded staging migration + offline tests versioned.
- [ ] Protected CI + integration of additive migration, then Supabase readback of actually staged rows.
- [ ] Minimal source-backed public unclaimed profiles and owner claim UX, authenticated QA.
- [ ] Next 50–100 new industrial website domains, favor producers, traders and tube-laser services over generic retail.

**Supersedes NET-RO1.3.B as immediate work priority**; ONRC/visure workflow remains an optional later data-quality path and is not required for private research growth.

## NET-RO1.4.WEB-GROWTH2 — Second sourced web wave, 2026-11-05

50 new Romanian company website candidates, screened read-only against six production company catalogs. **Zero exact domain or normalized-name collisions**; not proof of 50 distinct current registered companies, nor a licence for any third-party content.

| Research waves | Domains | Producer | Trader | Processor |
| --- | ---: | ---: | ---: | ---: |
| First NET-RO1 waves | 50 | 9 | 30 | 11 |
| WEB-GROWTH1 | 17 | 1 | 13 | 3 |
| **WEB-GROWTH2** | **50** | **5** | **30** | **15** |
| **Total** | **117** | **15** | **73** | **29** |

**Sources:** 41 rows cite company-operated sites; 8 use industrial directory listings; 1 uses a historical 2007 trade advertisement. The last nine are source-backed research leads **with manual source/current-business holds** rather than current website-confirmed businesses. Some first-party profiles are held for multinational groups, name aliases, retail-only activity or plant-vs-trader roles.

Illustrative relevant sites: `wecubex.ro` processes/perforates tubes; `estmetalcab.ro` says it makes galvanized rectangular tubing; `valrotrade.ro` distributes steel pipes; `caroltech.ro` performs laser cutting of steel tubes; `www.metal-inox.ro` distributes stainless square/rectangular tubing. Important exception: `metal-inox.ro` apex and `www` present different brands; hold canonical profile identity for later review. `tevi-europa.ro` vs `valrotrade.ro` also require a possible-identity-overlap review.

- [WEB-GROWTH2 50-record public-source research manifest](../services/worker/data/netro1_4_web_growth2_20261105.json), with exact source URL, role, own-word summary, source tier and unresolved hold.
- [Additive migration for 50 additional private seeds](../supabase/migrations/20261105144500_net_ro1_web_growth2_research.sql), idempotent and **no public Network writes**; assumes WEB-GROWTH1 table with 67 seeds. Research only, unclaimed, unverified, unpublished.
- [Offline tests](../services/worker/tests/test_netro1_4_web_growth2_research.py) verify 117 unique research domains, 50 migration rows, source tiers and non-publication.

**Acceptance:** 50 source-linked research records [x], six-catalog exact duplicate screen [x], conservative role/source flags [x], code and tests versioned [x]. CI and protected merge [ ], production staging migration applied/readback [ ], publisher-governed unclaimed profile promotion [ ], authenticated owner-claim enrichment QA [ ].

**Reporting:** 117 GitHub research domains != 117 actual records in Supabase != 117 public unclaimed companies. All three measures must be reported independently.
