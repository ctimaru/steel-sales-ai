# NET-COV2 — Scalable Industrial Company Acquisition

## Why this is core (16 October 2026)

NET-COV1 established a private, evidence-backed research pool and a strict crawler bridge, but a Platform operator could stage one official-domain target at a time. Its 10 research leads are not published companies. The Italian Network baseline is 31 published companies, **0 published end_users**; 162 pre-existing crawler candidates have no end_user role. Scaling the discoverable commercial graph requires a larger reliable pipeline, not a weaker publication bar.

## Delivered in this first core increment

- In Platform > Company Discovery > End-Users, paste up to **40 tab-separated official-company rows per campaign** (repeatable Excel/Sheets workflow; optional exact header).
- Each row retains exactly the seven NET-COV1 fields: `name, domain, evidence_url, summary, segment, material_signal, role`. Each evidence URL must be an **exact first-party HTTPS site** for that normalized company domain.
- Requires a real authenticated Platform operator with `discovery.enrich` and explicit source-evidence attestation. Service-role-only seeding remains separate.
- Delegates validation, first-party URL rules and deduplication against existing canonical companies and crawler candidates to `private.netcov1_stage_core`.
- Campaign name is persisted as `intake_batch`, with counts of staged/rejected/duplicate, candidate roles and review statuses.
- Repeatable operator campaigns use **small auditable batches**, not background unlicensed scraping. Limits: 1–40 entries per RPC, 60k characters per pasted form.
- Import returns separate `staged_needs_review`, `duplicate_existing`, `already_staged` counts. None are Network publications or confirmed procuring firms.
- Cross-campaign uniqueness remains enforced on canonical domain. Existing source registry, source-rights gate, human review, worker runs and publication controls are unchanged.

## Operational procedure

1. Define a cohort by geography and use-case (for example Lombardia / furniture, Piemonte / industrial equipment, Veneto / machinery, then traders), with a short unique campaign label.
2. Assemble rows from actual official company/product evidence. Capture explicit tubular steel material signals; `finished_equipment_only` stays research-only until substantiated. Do not add people, emails or contacts.
3. Paste at most 40 tab-separated rows and attest the first-party evidence. Check `staged_needs_review`, duplicates and already-seen counts.
4. Use NET-COV1's **human Platform batch qualification** (max 40, reason and role/evidence recheck). `ready_for_crawler` does not imply company verification.
5. Only after independent assessment of terms, reuse/database rights and approval of the **actual applicable source** may a separate Platform operator transfer ready targets to the governed domain lead queue. A public official site alone is not blanket permission to scrape, store or republish third-party content.
6. Domain lead approval, governed worker execution, candidate review, publication and company claim still occur under the existing separate gates. No automatic merging or publication.

## Explicit limits and risks

- This increment **does not activate a new crawling source, bulk worker runs or production migrations**. No claim of acquisition of thousands of companies. A legally sound, source-specific authorization is an external dependency for any mass crawling campaign.
- Do not reuse Wikidata CC0 authorization as approval for extracting arbitrary company websites, and do not use unapproved RNA or Registro Imprese data.
- A source may be used for human evidence-led company research even when automated bulk extraction/reuse is not approved, subject to legal review of the specific workflow. Keep only business/product information and source pointers.
- Import quality relies on truthful operator attestation; there is deliberately no automated confidence or material inference. Review remains a separate operator decision.
- NET-COV2 success must not be measured by `published` until a company passes the independent discovery+governance gates.

## Acceptance

- `netcov2_operator_batch_stage` is SECURITY INVOKER; private implementation restricts authorization and batch size, with no direct publication.
- `netcov2_campaign_metrics` is read-restricted to Platform; no new public data surface or Company Memory access.
- Web server action parses tab-separated 7-field rows and rejects malformed batches without a partial success claim.
- P0 SQL negative security smoke and frontend static regression included; CI, migration release and actual source approval are separate gates.

## Measurement for rollout

Per campaign: rows requested, successfully staged, existing-company/candidate duplicates, previously staged domains, proposed end_users vs traders, ready-for-crawler, enqueued leads, candidates accepted by governance, and **published companies** (from canonical Network, not research staging). Dashboard intentionally does not attribute published companies to campaigns until durable linkage exists.

## Next execution phases

- **NET-COV2A (this PR):** repeatable, guarded first-party evidence campaigns + metrics.
- **NET-COV2B:** independently document and approve a suitable source / data license, source-to-domain provenance, and run a controlled, budgeted worker intake for genuinely eligible leads; hard no-go if terms/database/privacy constraints fail.
- **NET-COV2C:** source-aware bulk dedupe/review/publish funnel with canonical company identities, real regional/role distribution and repeatable yield metrics. Allow a larger volume of *research candidates*, but retain explicit company promotion.
- **NET-UX5:** first-party company claim/onboarding to increase verified density without risky third-party crawling.

Dependencies: [NET-COV1](./net-cov1-end-user-network-density.md), [Platform End-Users](https://www.smartsteelsales.com/platform/company-discovery/end-users).
