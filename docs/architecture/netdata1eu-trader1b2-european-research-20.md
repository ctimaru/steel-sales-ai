# NET-DATA1-EU TRADER1B.2 — 20-company private desk-research pilot
20 October 2026. **Repository dossier / pending DB activation, no company published.**

## Scope and evidence
- Adds 15 source-observed candidates to the 5 previously prepared in #770 (target research total **20**, once migrations have been authorized and applied). This does not mean 20 verified legal entities.
- One source URL per role and product observation, limited summary metadata. Official site visibility does not license mass extraction, redistribution, crawling or publication. All source-rights remain `not_assessed`.
- Country field denotes *research market*, not legal-entity domicile, facility country or NUTS region.
- Manual identity watch: **Royal Van Leeuwen (NL)** already appears in discovered + target leads under shared domain `vanleeuwen.com` as **Van Leeuwen Italia S.p.A.**. Row on `identity_hold`; keep legal entities/group subsidiaries distinct. **Pouchard** is expressly in Hoberg & Driesch group and should be reviewed as separate legal company before any association.
- Dual-role watch: **BOWIM** officially mentions own production of steel sections as well as trading; do not auto-assign solely trader.
- **FRANKSTAHL excluded**: the official site imprint expressly restricts reuse/storage in commercial databases without prior written permission: https://www.frankstahl.com/en/imprint . Treat as source-rights hold outside this ingest.
- Five earlier research candidates remain BUHLMANN Group (DE), MCB (NL), ArcelorMittal Distribution Solutions France (FR), Wuppermann Stahl GmbH (DE), Kovintrade d.d. (SI).
 
| Label (research, not legally verified) | Market | Official first-party role/product URL |
|---|---|---|
| Hoberg & Driesch | DE | https://www.hoberg-driesch.com/en/products-solutions/ |
| CARL SPAETER | DE | https://www.spaeter.de/standorte/spaeter-oberhausen/produkte/rohre |
| thyssenkrupp Schulte | DE | https://www.thyssenkrupp-schulte.de/de/produkte/stahl/stahl-rohre |
| KDI | FR | https://kdi.fr/nos-produits/tubes_canalisation/ |
| Pouchard Tubes et Barres | FR | https://www.pouchard.fr/entreprise/nos-engagements/ |
| SOPROMET | FR | https://www.sopromet.fr/ |
| Royal Van Leeuwen | NL | https://www.vanleeuwen.com/ |
| Solines B.V. | NL | https://www.solines.nl/koker-profielen/ |
| BOWIM | PL | https://www.bowim.pl/profile-stalowe/ |
| Konsorcjum Stali | PL | https://www.konsorcjumstali.pl/kategorie/rury |
| Hierros Mora Antón | ES | https://hierrosmoraanton.com/productos/productos-largos/tubos-estructurales/ |
| Tubos Paris | ES | https://tubosparis.es/empresa/ |
| EHG Stahlzentrum | AT | https://www.ehg-stahl.com/de |
| Metalunion | BE | https://metalunion.be/staalproducten/buisprofielen/ |
| Claessens-Wettstein | BE | https://www.claessens-wettstein.be/home-fr |

## Data completeness and acceptance
- 15 new rows, 6 separately first-party sourced location assertions. All rows `source_rights='not_assessed'`; `research_state='research_only'`, except Van Leeuwen `identity_hold`.
- No automatic staff verification, licensed publication, NUTS assignment, CRM outreach, company connection or RFQ. No personal contact details copied.
- Existing canonical/discovered/lead exact-domain check prior to code migration: **14 new domains without exact match, one with 2 existing records (Van Leeuwen: discovered + lead)**; domain collisions are not equivalent to legal-company duplicates.
- Rerun dedupe after authorized migration via `private.netdata1eu_trader_audit` (service role only), compare all counts and review legal group graphs.
- Prerequisite blocker [issue #771](https://github.com/ctimaru/steel-sales-ai/issues/771): old foundation and first five staging migrations not yet applied to production. This migration cannot be applied before them.
- [PR #770](https://github.com/ctimaru/steel-sales-ai/pull/770) released schema in repo; **NOT production database**, despite Vercel ready.
- Post-migration production acceptance targets: 20 research rows total and 10 first-party location evidence entries across both batches, subject to transactions, source checks and dedup.
- Next DATA1-EU TRADER1C: expand past 20 to 60 with provenance, rights checks and quality/ranking, prioritizing underrepresented Poland and Germany.
