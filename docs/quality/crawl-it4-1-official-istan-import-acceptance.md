# CRAWL-IT4.1 — ISTAT Import and Geographic Reconciliation

Official source: https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/
XLSX permalink: https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.xlsx

The reference as of 21 February 2026 contains 7,894 municipalities. Verify the current source before each import.

## Import procedure
1. Retrieve the ISTAT original XLSX, inspect actual workbook column headers and export a UTF-8 CSV with exactly these columns: `istat_code,municipality_name,province_code,province_name,region_code,region_name`. Preserve code leading zeros.
2. Run from `services/worker`: `python -m app.istat_import path/to/official-mapped.csv` (check only). Confirm 7,894 unique codes, 20 regions, all valid two-character province abbreviations, and newly instituted Castegnero Nanto.
3. Record original XLSX URL, download date, XLSX SHA256, verified mapped CSV SHA256, importer results, and operator review in change ticket.
4. Only after authorizing the correct official source data: run same command with `--apply` in a correctly scoped worker environment, then verify reference count and sample lookups. The importer changes only `network_it_municipalities`.
5. Perform geographic reconciliation from evidenced company facility candidates; do not overwrite original `network_facilities`. When province is missing, prefer manual review to guesswork. Proposed records can be stored in `network_it_facility_geo_reviews` only after independent provenance is attached.

## Current blocked step
Direct download of the ISTAT XLSX failed in the current tool environment. Do not substitute an unofficial dataset or claim all municipalities have been imported. The new importer rejects partial datasets, duplicates, wrong headers and malformed province/region codes.

## Security and operational constraints
No automatic publication, company identity change or geographic backfill. No ongoing Vercel job. The registry can be populated only by explicitly running the opt-in import step after controlled source verification.
