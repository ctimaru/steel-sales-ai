# TRUST-AUDIT1C.2G.1 — Automated Source Rights Evidence Linking
Date: 2026-10-23. Status: **PROVENANCE LINKS AUTOMATIC / RIGHTS CLEARANCE NOT AUTOMATIC**.

## Purpose
Connect the steel Network profiles to observed crawler URLs, timestamps, discovery run governance, assessments, canonical-company evidence and individual data assertions while keeping source rights and commercial permissions separate. A public website or an allowed discovery run is not a general license for database copying, AI/RAG, or paid commercial redistribution.

## Implemented, private-only
- `private.trust_c2g1_source_evidence_links` collects **discovery candidates** (and their run governance), **source assessments**, **company data assertions**, and **canonical evidence** in one audit model: company ID, evidence kind, ID, source URL (where already known), recorded_at, run/candidate governance, explicit rights evidence URL when linked through the source registry, `reuse_clearance='not_cleared'`.
- `private.trust_c2g1_company_evidence_summary` derives one row for each company and records source links by kind, earliest/last evidence context, governance gaps and a conservative next-action lane. `reuse_rights_cleared=false` for every company.
- The views are *dynamic* and update when new source records are legitimately inserted; no scheduled crawler, mass update or publication is performed.
- Neither view is exposed to public/ordinary authenticated roles. Only service_role receives SELECT; its bypass privileges remain subject to separate inspection.
- No personal details, price lists, secret keys, raw source content or historic Git modification committed.

## Acceptance from production
The source-specific merger found **150 evidence links** covering **all 32 published company profiles** in the inspected ledgers, compared with the 2 missing in the prior narrower reconciliation. This is **provenance coverage, not rights assurance**.
The operational lane has **26 published profiles with discovery candidate governance gaps** and **6 published profiles routed to source reuse-rights review**. There are also 2 pending_review companies in the DB.
All 150 links have `not_cleared`, none of the 34 companies has automatically obtained reuse rights.
Staging and production schema checks use `supabase/tests/trust_audit1c2g1_source_evidence_linking.sql` and assert read-only company/link counts, no NULL company references, and no public grants.
Production ledger version: `20261023092823_trust_audit1c2g1_automated_source_evidence_links`.

## Decision rules
Evidence presence is a neutral observation. `discovery_candidate.governance_status`, `run.governance_status` and any `rights_evidence_url` are recorded independently, not silently promoted to "licensed".
A run's approved governance status does not replace per-company rights evidence or precise use-scoped license clearance. Prevent laundering of data from unreviewed candidates through an approved crawler run.
Next step for commercial permissions: a reviewed, versioned source rights record with allowed purposes (discovery, factual profile, excerpts, AI retrieval, bulk, paid Network), obligations, evidence date and source license/terms URL. Only evidence-backed rules may grant an individual purpose.

## Open
- Published profiles, IP rights, website terms and privacy reviewed by source and intended use.
- Source-rights review for 26 candidate-governance issues + 6 reuse-rights reviews, without compulsory manual review of all routine companies.
- Nine existing holds remain intact and must be reconciled separately.
- End-to-end signed JWT + superadmin Chrome acceptance; privileged RPCs and service_role; preservation/legal hold decisions and selective Storage API purge.
- Stack merge #861 → #867 → #869 → #870 → #872 → #873 → this PR only after required CI, schema rebuild, ledger reconciliation and deployment acceptance.

Source guidance: https://supabase.com/docs/guides/database/postgres/row-level-security .
