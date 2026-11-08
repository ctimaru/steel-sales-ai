# NET-RO1.GROWTH9.C — Reconcile 72 Romanian fabrication leads; release 15 source-backed profiles

**8 November 2026. Owner: Smart Steel Sales Network. Status: protected PR and staged (definition-only) migrations.**

## Decision

From the 86-company Romanian fabrication census, 8 were released in GROWTH9.A, 6 already existed, and **72 remained**. The 72 are fully accounted for in `services/worker/data/net_ro1_growth9c_reconcile72_20261108.json`. **15** now have a company-controlled website directly evidencing the named company and industrial relevance, with a country/county/city, and can be promoted after protected duplicate/source verification. **57 stay private/unpromoted**. This is not a claim that all 72 companies were fully verified or published.

| Reconciliation lane | Records | Next action |
| --- | ---: | --- |
| Web-sourced company identity and industrial activity, ready for protected review/publishing | 15 | 15-company private stage -> restricted preview -> atomic publication |
| First-party company website/activity not yet matched to exact legal identity | 52 | Discover direct website, role, city and canonical domain |
| Group-domain facility/subsidiary identity: ZAUNER, EMSIL | 2 | Model independently identified Romanian legal entity/facility; no duplicate global domain |
| Multi-entity legal split and location: MIRAS INTERNATIONAL | 1 | Official split notice distinguishes trading, distribution, welding; reconcile legal headquarters Ilfov vs Bănești plant Prahova |
| Shared multinational identity: DEXION | 1 | Preserve separate local entity and source before release |
| Mostly steel trading/rebar service, not core structural fabricator: EUROZONE | 1 | Reclassify trader/processor evidence, defer tube-fabrication profile |
| **Total** | **72** | 15 candidates, 57 held |

Original numbered census rows stay fixed; no candidate is lost or reindexed.

### Exact 15 companies

| Region | Company | Role proposed | Company source |
| --- | --- | --- | --- |
| Nord-Est / Iași | COMPRODIS SERV SRL | metalworking processor | https://www.comprodis.ro/contact.php |
| București-Ilfov | BOG’ART STEEL SRL | structural fabricator | https://www.bogartsteel.ro/contact/ |
| Vest / Hunedoara | RECOM SID SA | welded structural fabricator | https://recomsid.ro/recom/confectii-metalice/ |
| Sud-Vest Oltenia / Dolj | TEAM MONTAGE SRL | structural fabricator | https://teammontage.ro/contact/ |
| Centru / Sibiu | IZOTIN SERVICE SRL | metalworking processor | https://www.izotinservice.ro/despre-noi/ |
| Centru / Sibiu | NEW-METRIC SRL | industrial automation/fixture OEM end user | https://new-metric.ro/ |
| Vest / Timiș | MAXSTRUKTUR SRL | metalwork fabricator | https://maxstruktur.ro/ |
| Centru / Sibiu | ARMAX GAZ SA | industrial equipment end user | https://armaxgaz.ro/ |
| Centru / Brașov | ENERGOSTEEL ART SRL | large infrastructure steel structures | https://www.esteel-art.ro/despre-noi/ |
| Sud-Muntenia / Dâmbovița | MECANPETROL SA | oilfield machinery OEM end user | https://www.mecanpetrol.ro/contact.php |
| Sud-Muntenia / Prahova | MONTAJ CARPATI SA | structural fabricator | https://www.montajcarpati.ro/ro/contact |
| Sud-Est / Galați | DEMCAR 2000 SRL | modular-container OEM end user | https://demcar.ro/ |
| Sud-Est / Buzău | CONSTAM PROCESARE OTEL SRL | rebar/welded steel processor | https://constamprocesareotel.ro/contact/ |
| Nord-Est / Suceava | GIO GIOVANNI ANDREEA SRL | metal hall/stair fabricator | https://confectii-metalice.ro/ |
| Sud-Muntenia / Giurgiu | PEIKKO ROMANIA SRL | construction connection component producer (NOT structural tube mill) | https://www.peikko.ro/ |

**Role split:** 10 fabricators/terzisti, 4 end users/OEMs, 1 manufacturer of construction structural connectors. These roles are source-indicated, not owner-verified. No purchases of EN 10219 tubes, production capacities, certificates or order availability are asserted. PEIKKO is not labelled a tube mill.

Sources and proposed location, CUI (when directly available), generic company channels and the source text are captured in `net_ro1_growth9c_fabricators15_firstparty_20261108.json`.

## Release specification

Production baseline at read-only preflight: **196 public Romanian company profiles and 289 private research records**; all 15 proposed official site domains and normalized company names absent from current public/private records, no known suppressions.

1. P0 protected CI success against final PR head. FLOW1 is ancillary and separately reported.
2. Protected merge of source manifest, all-72 reconciliation ledger, data migration and definition-only publisher. SQL-only Vercel build may be skipped.
3. Apply `20261108150000_net_ro1_growth9c_fab15_private_research.sql`: guarded **15 private research records only**, target **304** private RO; public remains 196. Failure is atomic.
4. Apply `20261108151000_net_ro1_growth9c_fab15_publisher.sql`: defines service-only `private.netro_growth9c_publish_fab15(boolean DEFAULT false)`, with no auto inserts.
5. Verify `anon_execute=false`, `authenticated_execute=false`, `service_execute=true`. Run preview `SELECT private.netro_growth9c_publish_fab15(false)`; must show **15/15 eligible**, baseline 196/304, 0 created and expected **211 public Romania profiles**.
6. User authorized batch public publication; invoke `...fab15(true)` **once** after successful preview. Whole wave is one database transaction with advisory/table locks, source identity, role, NUTS2, name, domain, opt-out, prior ledger and counts gates. No contact, owner claim or certification rows are created.
7. Independent SQL readback: **211 published Romanian companies with 211 distinct domains**, 15 publication links, 15 primary roles (10 processors/4 end users/1 producer), 15 assertions, 15 NUTS2-sourced facilities, 0 automatic claims/certifications/contacts. Private research remains 304. Re-run `false` for idempotent `already_published, created_now=0`. **Never repeat true.**
8. Stage generic company email and company telephone via existing NET-CONTACT1 service-only endpoint **only** for the official website/domain source given; any staged channel remains `pending_review` until LR4 admin approval. Do not publish contacts via direct SQL. Do not import named individuals/mobile phones as personal contact channels. Preserve original source attribution.
9. Browser visual check at 1440, 390, 320: RO country flag, country/role/NUTS2 filtering, corporate contact placeholders and claim CTA. Browser screenshot QA is distinct from Supabase SQL readback.

## Next acquisition

The **57 held** are prioritized for direct website matching, legal identity, official corporate contact page and role evidence. The five group/trade cases get reconciliation, not blanket rejection. Continue in waves of 20–50 once adequately sourced, without mandatory paid visure for a minimal web-sourced listing. The owner can later claim the company and enrich certificates, product scopes, contact details and user permissions.

Readme reference: [NET-RO1.GROWTH9](./net-ro1-growth9-fabricators-and-company-contacts.md).
