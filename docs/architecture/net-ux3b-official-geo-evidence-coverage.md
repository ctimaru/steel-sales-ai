# NET-UX3B — Official Company Geo Evidence & Controlled Coverage Expansion

## Baseline (16 October 2026)
- Published Italian Network profiles: **31**; region-mapped: **3**; geographical gap: **28**.
- Official ISTAT 2026 reference: **7,894** active municipalities.
- Existing crawler candidates and private Company Memory are out of scope. Official website evidence is company-public address data only.

## Governed pipeline
1. Operator finds a publicly visible registered/company site location and an official URL. For multi-site groups, associate ONLY the entity listed on that page (no group-office inference).
2. `netux3b_operator_stage_geo` checks role `discovery.enrich`, the published company's domain, an explicit city and **standalone province abbreviation**, and exactly one active ISTAT entry. It derives canonical `region` and `istat_code` from the official register. No facility is created.
3. A service-role-only `netux3b_stage_screened_official_geo` accepts a small, explicitly selected pilot cohort with evidence source URLs and attribution batch. All imports remain `pending_review`; no reviewer identity is faked.
4. Independent `crawl_it61_review_geo_evidence` requires the Platform governance role and a first substantive review note.
5. Independent `netux3_publish_reviewed_geo` requires `discovery.publish` AND `discovery.governance_review`, a second reason, and fresh verification of the ISTAT code, company website and publication status. Only then creates published facility with `verification_status=unverified` + ledger and provenance assertion. Network map counts change only at this step.

## Security and provenance
- The collection batch uses RLS, service-only insert/read; there is no app-user access to batch tables.
- Public APIs are SECURITY INVOKER; private helpers are permission-protected. No new public SECURITY DEFINER; satisfies HP13.
- Reject unrelated host, query/credential URL, wrong province, non-unique/unavailable ISTAT municipality, already-published site, duplicate review candidate, unpublished company.
- No personal contact scraping, no false geometry, no automatic publication, no changes to RFQ/private tenant data.
- Relevant first-party company URLs and short address excerpts are recorded in the Platform review queue, not on public site until independently approved.

## Controlled source pilot
The first cohort includes **8** companies with observed first-party web pages/documents: Alessio Tubi, BM Laser, BST Tubi, DAMATEK, Giulipas, Padana Tubi, Tubi S.p.A. and Tubilaser. Each source must show company identity and city+province; the database uses ISTAT to derive the corresponding region. Official PDFs on a company's own domain are accepted only after inspection of the actual company identity. Source pages are rechecked by the human reviewer.

## Acceptance
- P0 frontend tests, local Supabase reset and SQL rollback fixture, HP13.
- Production security advisor plus authorized/unauthorized stage access checks.
- Pilot evidence `pending_review` records staged with provenance, not auto-published.
- Merge only after P0 required gate is green, Vercel deployment verification.
- Chrome authenticated Platform review and second publication by the user remains required. Free/Pro map continues to exclude all pending evidence.
