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
