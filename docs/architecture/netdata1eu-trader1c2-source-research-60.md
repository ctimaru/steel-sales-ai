# NETDATA1-EU TRADER1C.2 — 25 first-party research cases
2026-10-20. **Research dossier only; blocked production database rollout.**

### Results and limits
- Target code-sourced inventory: **60 research dossier records** = 5 (TRADER1B) + 15 (TRADER1B.2) + 15 (TRADER1C.1) + **25 here**, not 60 verified companies and not 60 Network public businesses.
- These **25** URLs were checked against the operating company's public first-party pages, for tube/section/pipe distribution. The exact-domain read-only dedup check across canonical/discovered/leads found 0 matches for 25 URLs at research time. Root company or subsidiary duplication is still possible.
- This file contains *only brief observations and source URLs*, not scraped catalogs. `source_rights=not_assessed`, `research_state=research_only`. Legal company identity, real stock, facility ownership, company operating rights and NUTS all require review.
- Important multi-entity relationships: thyssenkrupp Materials NL/PL; KönigStahl PL vs Königfrankstahl CZ; Weyland Austria vs Weyland Stahlhandel CZ; Grupo Valsteel has multiple companies. Keep each proposed legal entity distinct pending reconciliation. Pressure/hydraulic pipe roles cannot be automatically relabeled EN10219 hollow-section traders.

| Candidate research label | Market | Official first-party evidence | Review note |
|---|---|---|---|
| STAD | FR | https://www.stad.fr/stock-tubes | Stock and tube ranges documented; sourcing and publication rights not assessed. |
| LTB France | FR | https://www.ltbfrance.com/contactez-nous/ | Fluid-system pipe stockholder, not automatically structural hollow sections. |
| De Neuve Tubes | FR | https://www.deneuve.fr/distributeur-de-tubes-et-verins/ | Mechanical/pressure lines; tube grade availability requires separate verification. |
| Salzgitter Mannesmann Stahlhandel GmbH | DE | https://www.salzgitter-mannesmann-stahlhandel.de/de/produkte-leistungen/lieferprogramm-rohre/rohrprodukte.html | Member of Salzgitter group; legal operating-entity and location review pending. |
| Heitmann Stahlhandel | DE | https://www.heitmann-stahl.de/produkte/stahlrohre/ | No company-wide claim of stocked quantity or all facilities. |
| IMS Polska | PL | https://polska.ims-group.com/ | IMS group: exact Polish legal company to review, group subsidiaries distinct. |
| thyssenkrupp Materials Poland | PL | https://www.thyssenkrupp-materials.pl/pl/stal-weglowa | Separate Polish operating entity, not the same as NL or other group companies. |
| Drozapol-Profil S.A. | PL | https://drozapol.pl/ | DUAL-ROLE REVIEW: distribution and fabrication, separate capabilities. |
| KönigStahl Poland | PL | https://www.koenigstahl.pl/pl/ | GROUP REVIEW: König holding relationships with Czech Königfrankstahl. |
| Coopra Buis B.V. | NL | https://cooprabuis.nl/stalen_buizen/en/ | Office address published; do not infer stockyard location from office. |
| thyssenkrupp Materials Nederland | NL | https://www.thyssenkrupp-materials.nl/nl/producten/staal/kokerprofielen | Separate Dutch operating entity; group relation to Poland requires review. |
| Teham Pongers | NL | https://www.teham-pongers.nl/grote-magazijnvoorraad/ | Warehouse in Hengelo described in first-party source; no automated location mapping. |
| Precision Steel International | NL | https://psi-steel.nl/ | Precision/hydraulics rather than EN 10219 structural tube specialization. |
| León Tubos | ES | https://www.leontubos.com/ | Parent or historical Van Leeuwen relationship to review; no automatic group merge. |
| Marceliano Martín | ES | https://marcelianomartin.com/ | Site reports multiple distribution centers; no individual facilities inferred. |
| Globalmetal Aceros | ES | https://globalmetal.es/ | Trading/broker role; do not infer own warehouses from logistics descriptions. |
| Eduardo Cortina | ES | https://www.eduardocortina.com/ | Main warehouse Erandio explicitly published; verified legal name still pending. |
| Grupo VALSTEEL | PT | https://valsteel.pt/ | Group comprises separate legal companies; needs identity reconciliation. |
| ABC Steel s.r.o. | CZ | https://www.abcsteel.cz/ | Reported Czech identity must be checked against business register. |
| IMPEX TB s.r.o. | CZ | https://www.impextb.cz/cs | Factory and warehouse locations listed; distinct from manufacturing. |
| Weyland Stahlhandel s.r.o. | CZ | https://weylandstahlhandel.cz/ | GROUP REVIEW: subsidiary of Weyland Austria already in prior research. |
| Königfrankstahl s.r.o. | CZ | https://www.koenigfrankstahl.cz/ | GROUP REVIEW: related to KönigStahl Poland, distinct legal company. |
| FERRUM s.r.o. | CZ | https://ferrum-mb.cz/prodej-hutniho-materialu/ | Mixes trader and metal processing; separate role-level evidence. |
| H Metal | RO | https://www.h-metal.ro/ro/ | Broad construction supplies; ownership, license and site rights pending. |
| S.C. STEEL TUBES S.R.L. | RO | https://steel-tubes.ro/despre-noi | Legal designation appears first-party; independent registry check required. |

### Observed private locations (no map publication)
- FR Avrigny — warehouse, stad.fr (https://www.stad.fr/stock-tubes)
- NL Rijswijk — office, cooprabuis.nl (https://cooprabuis.nl/stalen_buizen/en/)
- PL Mysłowice — office, polska.ims-group.com (https://polska.ims-group.com/)
- PL Warszawa — office, koenigstahl.pl (https://www.koenigstahl.pl/pl/)
- ES Erandio — warehouse, eduardocortina.com (https://www.eduardocortina.com/)
- PT Vila Nova de Gaia — warehouse, valsteel.pt (https://valsteel.pt/)
- CZ Plchovice — warehouse, impextb.cz (https://www.impextb.cz/cs)
- CZ Praha-Modletice — warehouse, koenigfrankstahl.cz (https://www.koenigfrankstahl.cz/)
- CZ Moravské Budějovice — warehouse, ferrum-mb.cz (https://ferrum-mb.cz/prodej-hutniho-materialu/)
- RO București — office, h-metal.ro (https://www.h-metal.ro/ro/)

### Rollout and acceptance
- Source file: `supabase/migrations/20261020162000_netdata1eu_trader1c2_source_research.sql`.
- Requires migration series in order: `20261020160000`, `160500`, `161000`, `161500`, then `162000`. All run only through the **authorized** database path: GitHub issue #771 tracks existing security block.
- After authorized execution, expected **60 private research rows** and **29 private location observations** (19 prior + 10 here), conditional on source validity and dedup; `public.network_companies` and `public.network_facilities` remain unchanged.
- Run service-only audit `private.netdata1eu_trader_audit` and verify no `anon`/`authenticated` access, `0` rows with source rights prematurely approved, `0` public auto-publications or site crawler jobs.
- Next: TRADER1D identity/source rights/technical product review, then controlled promotion only if legal rights and tenant governance allow.
