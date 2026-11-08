# NET-RO1.GROWTH9 — Publish Romanian steel fabricators and expose public company contact fields

**Date:** 2026-11-08 · Founder authorized publishing census companies and adding email/telephone on company profiles.

## Scope of the actual input

The spreadsheet `Censimento_Carpenterie_Romania_Smart_Steel_Sales_2026.xlsx` contains **86 named businesses**. Its "Aziende per regione" sheet comprises **50** entries from the 2025 CAEN 2511 revenue ranking, **31** Google Maps *search links* (not business proof), **5** other marked activity/website references (some are search links). **Neither the 86 names nor the national CAEN activity count provide 86 verified websites, emails and phones.**

All names and regional/provincial source tiers have been captured in:
`services/worker/data/net_ro1_growth9_census86_review_20261108.json`.

**Conservative reconciliation:** 8 first-party company websites fully identity-matched and source-backed for initial public publication, 6 company names already represented as published profiles, and 72 held for exact website/CUI/alias and trade relevance research. The held count is a research disposition, not a conclusion that those businesses are invalid or non-existent.

## First publish wave (8 unique companies)

| Company | Official website | Proposed role | Province / NUTS2 |
| --- | --- | --- | --- |
| TeraSteel S.A. | https://terasteel.ro | producer, metal building products, NOT established as tube mill | Bistrița-Năsăud / RO11 |
| Gormet SRL | https://gormet.eu | industrial processor / welded fabrication | Cluj / RO11 |
| ASSA Steel Structures | https://assasteel.ro | metal fabricator | Cluj / RO11 |
| NORSTAL Steel Structures | https://norstal.ro | metal fabricator | Cluj / RO11 |
| CO.ME.F. Utilaje Industriale | https://comef.ro | machinery manufacturer / industrial end user | Bacău / RO21 |
| SETRO Metal Group | https://setrometalgroup.com | structural steel fabricator | Argeș / RO31 |
| Containere FDC SRL | https://containere-fdc.ro | modular container maker / industrial end user | Bacău / RO21 |
| Topanel Production Panels SA | https://topanel.ro | building-panel and galvanized open-profile producer, NOT verified structural tube mill | Vâlcea / RO41 |

Names, source URLs, city/province, role, NUTS2 code and disclaimers pinned in `net_ro1_growth9_fabricators8_20261108.json`.

Read-only live preflight PASS: **8/8 unique domains**, 0 existing public/private domain or normalized-name duplicates, 0 opt-outs, 0 inactive roles, 0 NUTS2 mismatch. Baseline **188 public** and **281 private** Romanian research leads at start. No forced insertion of product-family `tubes_pipes`, RFQ permissions, owner claims or certifications. Published facility country/province/city/NUTS are source-backed but still unverified by owner.

## Email and telephone on every company profile

The company detail UI already has a governed `profile.contacts` reader and supports `mailto:` / `tel:`. This release makes **both fields explicitly visible on every company profile**, even if no reviewed company channel exists: **Email – Da integrare** and **Telefono – Da integrare**. Email/phone only render real values from the existing reviewed profile reader; no synthetic defaults, inferred `info@` or guessed switchboard numbers.

Existing project table `public.network_contacts` and governance `NET-CONTACT1` / `LR4` remain the ONLY authoritative contact store and publish path. In the source and research stages, contacts are **pending_review** and cannot appear on public cards until a platform admin with `network.privacy_governance_review` accepts. For private/non-generic/personal email addresses, use existing rejection rules, not a bypass.

Four known company contacts staged through `public.netcontact1_stage_company_channel`:
- CHIULAN: `office@chiulan.ro`, +40 744 304 078 · https://chiulan.ro/contact/
- SSAB-AG: `office@ssabag.ro`, +40 740 118 080 · https://www.ssabag.ro/contact/
- NIMB CONSMETAL: `office@nimbconsmetal.ro`, +40 241 238 488 · https://www.nimbconsmetal.ro/contact
- DUAL MAN: phone +40 21 425 67 70; `dualman@groupdual.ro` was rejected by the existing generic-local-part policy, so it must not be silently published · https://www.groupdual.ro/contact/

After publication of the new 8, stage company contacts that appear on primary company sites (not staff personal contacts); keep `pending_review` until normal admin decision. If no legitimate company email or switchboard phone is available, show "Da integrare" rather than inventing it.

## Protected launch

1. PR accepted through P0 Required Gate and normal merge, with additional FLOW1 observed. This is a **frontend + database** change, so Vercel may run a production build.
2. Definition/data migration `20261108133000_net_ro1_growth9_fab8_private_research.sql` stages exactly 8 private research candidates atomically, with checks. Expected **289 private RO research records / 188 public RO**.
3. `20261108134000_net_ro1_growth9_fab8_publisher.sql` installs **only** `private.netro_growth9_publish_fab8(boolean DEFAULT false)`. Verify role execution `anon=false`, `authenticated=false`, `service_role=true`.
4. `SELECT private.netro_growth9_publish_fab8(false) AS preview;` must return 8 eligible / 0 created / expected RO 196, and fail if baseline, source, role, province, domain, alias, opt-out or ledger drifted.
5. User-authorized single `SELECT private.netro_growth9_publish_fab8(true) AS published;` after preview. Independently verify **196 public RO**, **196 distinct domains**, **8 wave links**, **8 published source assertions/primary roles/geolocated facilities**, 0 automatic claims/certifications/contacts; retest `false` for `already_published`. **Never repeat true**.
6. Stage contact sources via existing NET-CONTACT1, leave pending for separate privacy reviewer. Open a real browser (if available) to test 1440/390/320 company detail contact fields, country flag, NUTS2 regional filter, and claim CTA; distinguish this from SQL verification.

## Continuation to all 86

The other **72** census rows require a one-shot source enrichment pipeline: find company website and legal CUI, verify county/region, inspect products and generic channels from its official contact page, check against existing company domains and normalized names, then promote batches of 20–50. Keep 2025 revenue ranking as discovery evidence (CAEN 2511), **not** proof of verified tube consumption, sole legal identity or company phone. Avoid making compulsory paid visure the gating factor, but do not invent email or phone. The user's broader ambition is industrial steel end users and structural fabricators, not retail listings.
