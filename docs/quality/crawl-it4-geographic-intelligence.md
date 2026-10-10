# CRAWL-IT4 — Geographic Intelligence Acceptance

## Official reference
ISTAT: https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/
Official permalink XLSX: https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.xlsx
Reference page updated 26 Feb 2026; 7,894 municipalities as of 21 Feb 2026. Sardinia changed provincial/municipal codes on 1 Jan 2026.

## Implementation
- `network_it_municipalities` stores ISTAT municipality code, normalized name, province code, region code, exact reference date and official source link. It is **not filled with fabricated municipalities**.
- `crawl_it4_match_municipality(city,province_code)` returns zero matches if province is unknown or mismatched. No blind city-based region assumption.
- `network_it_facility_geo_reviews` holds evidence-backed reconciliation proposals; never overwrites a public facility or marks a company verified.
- RLS on both tables; service-role only; no new authenticated/security-definer RPC exposure.

## Import gate
1. Download the official XLSX on a machine with network access and check current ISTAT header/column mapping.
2. Convert to validated CSV (UTF-8; ISTAT and region codes retained as text with leading zeros), including exact official province abbreviations, normalized municipality names, reference date, and source URL.
3. Validate count, uniqueness of ISTAT codes, non-empty municipalities/regions/provinces, and verify latest Sardinia classification.
4. Only then import to the reference table through a reviewed, idempotent procedure and verify production count. Do not publish until imported and checked.
5. For existing companies with only unstructured address descriptions, require explicit location evidence and human approval before creating structured facility location links.

## Snapshot and constraints
Production baseline: 32 Network companies, 3 companies with structured facilities (Lombardia 2, Emilia-Romagna 1); 29 lack structured facility geography. CRAWL-IT4 database-only foundation is **not** a completed regional filtering interface. That is CRAWL-IT5.
