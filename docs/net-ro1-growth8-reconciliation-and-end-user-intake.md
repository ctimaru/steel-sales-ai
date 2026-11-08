# NET-RO1.GROWTH8 — Reconcile 85, acquire 25 industrial company leads

**Date:** 8 November 2026. **State:** research code and manifests prepared, not published. **Source of truth:** the current Supabase Romania directory and the publicly accessible first-party URLs recorded per candidate.

## Outcome and strategic shift

Smart Steel Sales has **171 published Romanian company profiles**; the historical private research table contains **256 research records**, not 256 still-unpublished legal entities. There are **85 held research records** (83 not matched to any public company, 2 domains already used by public companies of another country).

The prior rounds over-indexed trading firms. This round emphasizes the platform's four-role steel supply-chain model, especially **buyers/end users**, machine/frame manufacturers and tube-processing subcontractors. Do not treat end-user status as a verified purchase order, tube consumption, supplier qualification, certification or owner claim.

### One grouped reconciliation of all 85

The complete record-by-record audit and provenance are frozen in `services/worker/data/netro1_growth8_reconcile85_20261108.json`. All entries have `publication_approved=false`.

| Decision lane | Research records | Resolution |
| --- | ---: | --- |
| Identity / alias / group | 31 | Prove the company/brand split or consolidate into existing canonical profile |
| Retail and industrial B2B fit | 29 | Low priority until tube/steel industrial B2B activity is clear |
| Industrial product fit | 15 | Confirm tube capability and correct primary role; do not infer from sheet-metal-only work |
| Stale, directory-only or historical sources | 6 | Recover current first-party operating evidence |
| Other first-party product page needed | 1 | Complete direct product proof |
| Cross-country canonical website collision | 2 | Tenaris and Van Leeuwen: link legal entity/facility; do NOT create cloned global-domain companies |
| **One producer cleared by primary-source evidence** | **1** | MAIRON TUBES: independent group-company manufacturer evidenced by corporate catalogue; source update only |
| **Total held at baseline** | **85** | Reconciled without duplicating any published legal company |

#### Important explicit reconciliation decisions

- **MAIRON TUBES S.R.L.** (`mairon-tubes.ro`): MAIRON's own 2024 corporate catalogue separately identifies MAIRON TUBES, its Găești factory and welded CHS/SHS/RHS production. The narrow migration `20261108123100_net_ro1_growth8_mairon_manufacturer_clearance.sql` upgrades its source evidence and sets `web_profile_review_pending` while leaving the profile unclaimed, unverified and private. Corporate source: https://www.mairon.ro/wp-content/uploads/2024/09/CatalogMaironeng2024.pdf. This is NOT owner confirmation of certificates, stock, norms or capacity.
- **Tenaris** (`tenaris.com`), **Van Leeuwen** (`vanleeuwen.com`): group/global domains are already used by canonical companies in other markets. Keep Romanian subsidiaries or facilities held until modelled with a separate local legal identity or facility relationship.
- **EASTMAN IMPEX** (`eastmanmetalwork.ro`) versus existing **Eastman SRL** (`eastman.ro`): separate sites and different legal names require a careful company/alias check rather than an automatic second manufacturer classification.
- **NOKSEL ROMANIA** (`noksel.com`): official group domain plus separate Romanian legal entity evidence needs subsidiary mapping; do not silently clone the group domain as a new company.
- **Țevi Europa / VALRO TRADE**, **Comtech Tub / COMTECH CO**, and multiple shared-brand/alias domains: stay held until clear legal attribution.
- Source-only retail candidates (29) remain lower priority than industrial end users. No mandatory paid visura for ordinary minimal web-first profiles, but domain/identity collisions cannot be ignored.

## New first-party research — 25 unique companies

The 25 source URLs and factual summaries are frozen in `services/worker/data/netro1_growth8_new25_20261108.json`. **All 25 are newly identified against the exact current private/public database at the time of this preflight.** Roles are proposed, not owner-verified.

| Proposed primary role | New researched entities | Research lane |
| --- | ---: | --- |
| **End users / industrial buyers** | **16** | Agricultural machinery, trailers, railway wagons, metal furniture and infrastructure manufacturing |
| **Industrial subcontractors** | **7** | Welded metal structures, steel fabrication, specialized processing |
| **Producers** | **2** | **Hold**: one local plant on a multinational group domain; one steel profile producer not documented as a structural tube mill |
| **Total** | **25** | 16 initially in `web_profile_review_pending`, 9 in source/identity/product-fit/site-integrity holds |

**Source-integrity exception:** Didicom (`didicom.ro`) displays unrelated gambling links alongside its metalworking description. It remains in `website_integrity_review_hold` and must not be publicly promoted until a clean first-party source/identity is established.

Selected source examples:
- **OEHLER MECANICA SRL** — agricultural trailer production; official https://www.oehlermecanica.ro/despre-noi/ — end user; tube purchases not confirmed.
- **AGROJET SA** — agricultural equipment, chassis, platforms, special transport structures; https://agrojet-sa.ro/?lang=en — end user.
- **Ereste Star** — trailer chassis and vehicle-body assembly; https://ereste-star.ro/about.html — end user.
- **Uzina Mecanică Mârșa (UMEM)** — industrial machinery and heavy welded OEM structures; https://umem.ro/en/company/ — end user.
- **ASTRA Vagoane Călători** — construction of railway carriages and transport vehicles; https://astra-passengers.ro/en/home/ — end user.
- **REVA Simeria** — rail wagon production and repair; https://www.revasimeria.ro/services — end user.
- **CHIULAN** — steel structures and welded fabrication; https://chiulan.ro/en/about-us/ — processor.
- **Dual Man** — welded industrial steel structures and component fabrication; https://www.groupdual.ro/en/ — processor.
- **NIMB CONSMETAL** — industrial steel structures, equipment and metalwork; https://www.nimbconsmetal.ro/ — processor.
- **ReNiCo Ind** — steel welded structures and precision OEM fabrication; https://renico.ro/en/company.html — processor.
- **INTERPIPE ROMAN S.A.** — primary group site identifies the Romanian seamless-tube production facility: https://interpipe.biz/en/about-company/ — **producer candidate on a shared multinational domain, HOLD for entity mapping**.
- **Variant Profile** — metal profile manufacturing, primarily open cold-formed profiles; https://www.variant-profile.com/ — **producer candidate on non-tubular products, HOLD; do not advertise EN 10219 HSS production**.

### Why the acquisition count is not inflated

Initial discovery included 9 names that were **already public with different display names**: HABA Research, Alex Ro Invest, Evinox, IRUM, Risk Management Company/R.M.C., Lavitex, Prodis, Stelco and Zsofia. Kovostroj was also already in private group/facility review. All have been excluded from the 25 new rows. No emails, private contacts, invitations or user associations are extracted.

### Protected implementation and release

- Source manifest: `services/worker/data/netro1_growth8_new25_20261108.json`.
- Full 85-entity reconciliation: `services/worker/data/netro1_growth8_reconcile85_20261108.json`.
- Atomic **private-only research intake**: `supabase/migrations/20261108123000_net_ro1_growth8_new25_web_research.sql`. An explicit 25/25 unique-domain/role/source/opt-out/duplicate preflight must pass, otherwise abort without partial inserts.
- Narrow **MAIRON** first-party evidence reconciliation: `supabase/migrations/20261108123100_net_ro1_growth8_mairon_manufacturer_clearance.sql`. Does not publish the company.
- Tests: `services/worker/tests/test_net_ro1_growth8_research.py`.

After protected CI/merge: apply migrations through the approved Supabase migration mechanism, then read back exactly **281 private RO research records** (baseline 256 + new 25), **171 public RO companies unchanged**, **25 new batch seeds**, **0 new owner claims**. Recheck Mairon source and lane. Vercel's SQL-only Ignored Build Step may skip the frontend, intentionally.

**Future public release is a SEPARATE atomic wave:** qualify the 17 web-ready new candidates plus Mairon (18 maximum under current evidence), check no drift, no duplicates, role visibility and owner-claim UX, then explicitly authorize publication. Do not publish held group-domain, unclear legal identity, or open-profile-only tube producer candidates.

## Suggested product visibility next

The Network's end-user facet currently has no Romanian public population. Adding source-backed, claimable end users would improve the supply-demand side, but their individual **tube consumption or RFQ participation must not be represented as verified**. Keep country-first directory filtering, compact company cards, and a clear single "Rivendica azienda" CTA.
