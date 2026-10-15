# CRAWL-IT6.6c — MIMIT RNA bulk prospect discovery: governed no-write pilot

## Why RNA, not only Telemaco
The official InfoCamere `Elenchi di imprese` service is useful for owned sales research and customer/supplier archive updates, priced at €5 plus €0.02/list row for the basic extract, but the public page does **not** establish SaaS republication rights. Do not buy a large CSV assuming it can become a public network directory:
- https://registroimprese.infocamere.it/web/guest/elenchi-di-imprese
- https://registroimprese.infocamere.it/vecchia-accesso-banche-dati (separate data-operator contract).

Public MIMIT RNA Aid datasets are indexed on dati.gov.it with **CC BY 4.0** distribution metadata:
- Official dataset index: https://www.rna.gov.it/open-data/aiuti
- Official catalog example: https://www.dati.gov.it/node/view-dataset/dataset?id=bec22008-0255-415c-aac7-d9daea0be010
- Official XML format (PDF): https://www.rna.gov.it/sites/rna.mise.gov.it/files/2024-01/cl_wcc-001577.pdf

**Important legal limitation:** RNA's own site warns that published personal data may only be used compatibly with the statutory purposes of the register, GDPR and Italian legislation. This pilot filters to **corporate legal entity names with an 11-digit numeric corporate CF**, explicitly excludes natural-person CFs, emails and contact data. The owner still needs to assess corporate-only SaaS re-use, provenance/attribution, deletion/retention, and regional legal constraints *before staging*, then publish only after separate identity and commercial-role review. CC BY 4.0 metadata is not an excuse to collect personal contact info.

## Implemented read-only bulk prospect flow
- Source proposal: `https://www.rna.gov.it/open-data/aiuti` registered as **unreviewed, discovery disabled**, not auto-approved. No migration writes to company profiles or intake rows.
- GitHub Actions manual workflow: `.github/workflows/crawl-it66c-rna-corporate-preview.yml`:
  - choose an exact **MIMIT-hosted public XML** URL copied from the official index (only `www.rna.gov.it/sites/rna.mise.gov.it/files/opendata/OpenData_Aiuti_YYYY_MM[_NNN][.xml]` allowed (official catalogs also expose extensionless XML links));
  - choose `trader`, `buyer` or `both`, and 100/200/300 unique companies max;
  - download max 180 MB, no external redirects or requests to company sites; 8-minute job;
  - streaming inspect `LISTA_AIUTI/AIUTO`, **only legal entities** with 11-digit numeric fiscal ID and matching corporate legal-name suffix, valid COR aid ID;
  - use `COMPONENTI_AIUTO/COMPONENTE_AIUTO/SETTORE_ATTIVITA` **only as an initial NACE aid-component *hint***. NACE 46.72/46.82 for potential metals wholesale; 25.11/25.12/25.62/25.5 and 28/29/30 for possible manufacturing buyers; never claim proven steel buying behavior.
  - dedup by corporate tax ID *before* output, no VAT/ATECO alias, no inferred province/city, no contact fields; preserve `RNA-COR-NACE` source reference + official provenance.
  - **SECURITY CHANGE:** the GitHub repository is **PUBLIC**, so the preview logs aggregate counts only and never materializes or uploads CSV artifacts, legal names or corporate tax IDs. No Supabase key in this workflow. Private CSV conversion remains available using the local CLI `python -m app.rna_corporate_candidates --input ./official.xml --output ./private.csv --segment both --limit 200` on an operator-controlled computer, after source review; this file must never be committed or uploaded into the public repo.
- Operator can use `/platform/company-discovery/bulk-import` to select the RNA source and run **preview** to see dedup against existing company/lead candidates. **Staging requires explicit Platform Owner approval of the RNA source's data and SaaS re-use in `/platform/company-discovery/sources`**, done under their identity; the migration never sets approvals or synthetic reviewer IDs.
- To support this accurately, the SQL staging row gains nullable `corporate_tax_id` with exactly 11 digits. It is independent of `vat_id` (RNA field is `CODICE_FISCALE_BENEFICIARIO`, **not confirmed P.IVA**). Existing source-rights gate, per-run 200-row limit, immutable batch keys, previous dedup and zero publications continue. No change to Wikidata CRAWL-IT6.5b schedule.

## Current and next acceptance
- Worker synthetic XML parser tests: corporate vs individual, namespace, URL SSRF prevention, NACE filter, duplicates, no published profiles.
- SQL temporary Supabase test: source remains unreviewed/disabled, owner preview creates no writes, unapproved RNA staging blocked, dedicated approved **synthetic** fixture stages corporate tax ID with VAT null, idempotent replay and no companies modified.
- Frontend test/typecheck/build, GitHub Actions workflow safety static guard, full P0 & mobile CI.
- On production: verify new RNA source is **unreviewed disabled**, `network_bulk_intake_rows` still zero, existing 4 Wikidata domain leads unaffected, no domain crawler settings changed.
- After first manual RNA Actions preview: check aggregate candidate yield and XML compatibility. Sample-level precision requires a **private operator-controlled** conversion workflow or subsequent governed stage; never expose company identifiers through public Actions logs or artifacts. If low precision, adjust sector selection. Do not claim 300 leads until the real workflow has run and results are checked. For geographic enrichment, RNA gives only region; do not infer province/comune, use separately approved evidence later.

## Expansion
CRAWL-IT6.6c.2: After owner source approval and candidate CSV dry run, stage first 100–300 corporate-only candidate trader records; perform governed sampling and human review, with duplicate and false-positive metrics. Next CRAWL-IT6.6d targets end users using additional industrial-source signals, and CRAWL-IT6.6e optionally schedules multiple approved sources with per-source quotas on GitHub Actions.
