# TRUST-AUDIT1C.2G — Network Source Rights & Provenance Reconciliation

23 October 2026. **Private readiness ledger installed, rights clearance NOT established.**

## Why
We are building an AI-ready industrial company Network using public online discovery, while ensuring every future permitted use is justified. Source URLs and independently developed crawlers demonstrate **origin**, not blanket rights to republish text, bulk-copy databases, train AI or monetize restricted data.

## Verified production (aggregates, no private content)
- **32 published companies:** 22 assessment-linked, 8 have linked discovery or canonical traces but no assessment, 2 have no evidence in these reconciled ledgers. Other evidence sources may exist; these figures are not proof of wrongful publication.
- **288 source assessments**: all currently reuse-rights `not_assessed`. Some contain documented URLs; this alone does not establish permission.
- **9 rights/identity holds**: 6 identity conflict, 3 rights review. **5 lack an assessment**. Current hold IDs do not match the current candidate table, so do not discard orphan holds.
- **4 registered discovery sources**: 1 enabled and compliant with existing SQL admission constraint; 3 disabled. No new crawler activation is performed.
- **38 Knowledge sources** with `license_name` not populated. Investigate other governance tables before treating it as absence of legal rights.

## New internal views
- `private.trust_c2g_source_assessment_queue`: linked assessment rows, flags for URLs and holds, conservative rights review lane.
- `private.trust_c2g_company_provenance_readiness`: one row per company, counts of linked assessments, discovery candidates, canonical evidence, holds, and `reuse_rights_cleared=false` for all until verified.
- `private.trust_c2g_source_hold_queue`: retains all 9 hold records, including the 5 not represented in assessments.

Views are **read-only, private, grant SELECT to service_role only**. No access for anon/authenticated, no changes to public profiles or assessments, no automatic license assignment. The access roles with bypass RLS remain a separate privileged audit. Source rights must be evaluated for specific uses.

## Acceptance
SQL test in `supabase/tests/trust_audit1c2g_source_rights_reconciliation.sql` asserts no missing/duplicate assessments, companies or holds, no automatic clearance and restricted Data API grants; run with transaction/ROLLBACK on staging and production.
Migrations match production ledger `20261023090236` and `20261023090328`. No data deleted or source promoted.

## Next product step — evidence, rights and UI
For each company/source, attach URL, date of retrieval, terms/license document, proof of reuse rights, source assertions, transformation origin, allowed scopes (discovery, factual profile, bulk redistribution, AI retrieval, paid Network), consent/personal-data constraints. Only a verifiable compatible license or own/company submitted evidence may clear that use scope; otherwise `needs_rights_review`. No compulsory manual review of ordinary fact records, but exceptions and rights holds must be resolved.

**Superadmin visual console:** dense table — Azienda | Evidenze | Diritti | Hold | Azione; compact filter chips for 2 missing source traces, 8 discovery-only, 22 assessed but rights-unverified; side-panel original URLs and dates. Avoid massive card layouts.

## Open gates
Live signed-JWT Chrome multi-account tests, privileged RPC/service-role execution, row-level source-rights clearance, strict clean-rebuild CI, and chronological merge #861 → #867 → #869 → #870 → #872 → this PR. Physical source purge held for legal review; Git history not rewritten.

Sources: https://supabase.com/docs/guides/database/postgres/row-level-security ; TRUST-AUDIT1C.2F Notion.
