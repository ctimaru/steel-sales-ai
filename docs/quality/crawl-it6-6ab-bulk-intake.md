# CRAWL-IT6.6a/b — Italia: buyer & merchant identity consolidation + CSV staged intake

## Goal and scope
Convert the existing repeated discovery candidates into a clear distinct-domain operating metric, and allow **100–2,000 company CSV rows/file** to be previewed and staged in 200-row transactions for **trader_distributor (Commercianti)** or **end_user (Utilizzatori)**. No company profile, geographic evidence, contacts or claim right is automatically verified. No publication, no outbound messages, no website visits, no Vercel cron, no change to CRAWL-IT6.5b GitHub Wikidata schedule.

## Audited production baseline (2026-10-14)
- 30 published IT company profiles, all currently `unverified`; 32 total active Italian companies.
- 162 discovery candidate rows correspond to **77 distinct domains**; **43 pending rows / 33 distinct domains**, **25** pending rows already approved at company-data governance level. **88 rejected** and 10 marked duplicate existing. Repeated observations are not new companies.
- Among pending candidates, **5 distinct trader-only domains** and 1 combined trader/processor domain; no explicit end-user classification to date.
- Wikidata approval cannot authorize random bulk CSV. Existing four Wikidata pilot leads and its 5/168h limit remain unchanged.

## Architecture
- Private tables: `network_bulk_intake_batches` (idempotent source+digest+chunk id, reviewer attribution) and `network_bulk_intake_rows` (source ID, proposed company name, domain, VAT if authorized, province/municipality, ATECO with explicit 2022/2025 version, proposed segment, source record/evidence). **No phone, email, PEC, individual names or contacts.**
- Client-side `CSV` file (comma/semicolon) is sent to private operator-only Next.js POST, max **768 KB**, **2,000 data lines**, no persistent raw CSV upload, explicit per-session CSRF origin/host checks. File content + selected options are hashed for the preview → commit handoff. Up to 200 distinct candidates per database call; every successful chunk has its own immutable digest-keyed batch. Re-upload of an identical batch is safe (idempotent).
- `public.crawl_it66_bulk_intake` is an invoker facade to `private.crawl_it66_bulk_intake_impl`, guarded with `private.require_platform_permission('discovery.run')`. Platform role still enforced in PostgreSQL; client request alone cannot grant it.
- Preview can run on unreviewed sources **without database writes**. Commit is rejected unless a **non-Wikidata Italian source** has been personally reviewed/approved (reuse rights, database rights, exclude personal data policy, evidence URL, reviewer and note). Source `enabled_for_discovery=false` is fine for a manual-only CSV: no scheduled scraping is authorized.
- Layered dedup: in-file identity, existing network website/VAT/legal name, existing discovery candidates including rejected history, already-staged bulk records; new companies stay `pending_review`. Proposed end-user role is a sourcing assertion, not established procurement activity. ATECO indicates activity class, **not proof of demand for tubes**.
- Operator page: `/platform/company-discovery/bulk-import`, launched via Company Discovery navigation, displays true distinct-domain coverage and last 80 **private staging records**; next microblocks add entity verification, rights-by-record review and promotion approval workflows. Do NOT infer that a staged CSV record is published, proven a buyer, or permission to contact.
- Fail closed: unknown CSV personal-data fields, unsupported role, invalid source, non-IT source, missing source approval for commit, repeated batch, incorrect file/option digest and invalid/corrupt CSV.

## Telemaco proposal
The production migration registers `https://registroimprese.infocamere.it/web/guest/elenchi-di-imprese` as **unreviewed and disabled**. This is *not* a grant of database/redistribution license. The platform operator must obtain explicit contract verification of use in a public/commercial SaaS before approving any downstream reuse; merely purchasing a CSV extract does not prove that right.

## Acceptance gates
- `apps/web/tests/crawl-it66ab-bulk-intake.test.mjs` validates CSV parsing, duplicates, role proposal, PII header rejection, fail-closed mode.
- `supabase/tests/crawl_it66ab_bulk_corporate_intake.sql` exercises synthetic owner user, unauthorized commit, rights-approved preview with zero writes, trader+end_user staged rows, duplicate replay, rejection of extraneous contact field, no changes to network companies, all in rollback.
- P0 frontend test/typecheck/build, disposable Supabase migrations and tests and worker regression must be green before merge. Production migration application checked explicitly after merge. **No actual purchased/licensed source CSV is available at this stage**, hence no claims of 200 new companies.

## Next steps
- **6.6c** source contract and real 100–300 trader candidates, bulk stage, human review; support provider-specific header adapter if needed.
- **6.6d** buyer source and candidate quality/geographic evidence, role confirmation and claim conversion.
- **6.6e** scale Actions batch scheduling *after source-specific rights and API budgets*, separate from stable Wikidata pilot.
