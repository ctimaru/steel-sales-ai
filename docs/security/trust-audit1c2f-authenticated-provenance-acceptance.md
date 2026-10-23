# TRUST-AUDIT1C.2F — Authenticated Security & Source Provenance Acceptance
Date: 2026-10-23. State: **SQL RLS/RIGHTS GATES PASS; FULL LIVE JWT, PRIVILEGED RPC AND ROW-BY-ROW RIGHTS STILL OPEN**.

## What is verified
- The production quarantine remains: 12 superseded documents, 12 exact SHA256 denylist fingerprints, four re-ingest triggers, one inactive price list. No data or Storage objects have been physically erased.
- Staging synthetic rollback test: an authenticated role with simulated JWT-sub sees a ready global Knowledge document and its chunk, but not their superseded counterparts (1/0/1/0). This is **not** a browser login or signed JWT verification.
- Read-only production test: a membership-eligible user's simulated JWT subject sees 368 ready records and zero superseded records of an owner-scoped source; a user of another organization sees zero records/chunks. No user IDs or contents are copied to this report. These tests check SQL policy behavior, not real session revocation, REST endpoints or browser access.
- The private checksum registry has no table grants for anon/authenticated. `service_role` and `postgres` bypass RLS and remain deliberately privileged.
- Source registry (4 records) already has a check constraint requiring approved governance, reusable terms, acceptable database rights, privacy scope, named reviewer, timestamp, note and rights evidence before discovery is enabled. 1 source is enabled and compliant; 3 disabled. A synthetic invalid registration is rejected by the existing constraint. **Do not duplicate this guard.**

## Provenance gaps discovered
- `private.netdata1b5_source_assessments`: 288 assessed rows (247 source_observed; 30 identity_review; 11 needs_followup). **All 288 show source_reuse_rights=not_assessed.** This means observing a website does NOT prove re-use rights.
- `private.netdata1b5_source_holds`: 9 holds (6 identity conflicts, 3 rights review); these are not cleared by the existence of source URLs.
- 32 published network_companies (all verification_status unverified in the inspected snapshot); 22 of the published companies map to a canonical source-assessment row, 10 do not map in that particular table. Do not assert zero provenance for the 10: other provenance tables and evidence paths exist and need reconciliation.
- 38 Knowledge sources: all currently have blank `license_name` (37 global/1 owner). 36 of 37 global sources have a source URI. This field alone does not establish no rights; rights may be tracked in separate governance events. Treat it as an evidence pack gap.
- 4 discovery registry sources: 1 approved and enabled with rights evidence, 1 restricted and disabled, 2 unreviewed and disabled. Existing DB source activation gate is working.

## Remaining acceptance before declaring launch-ready
1. Signed JWT and Chrome multi-account tests (owner/reps/other tenant/superadmin) for Knowledge, Commercial, RFQ, Network and price-list endpoints.
2. Audit of each exposed `SECURITY DEFINER` RPC and every service-role/worker ingestion route, including end-to-end exact hash + altered-content cases.
3. Rights matrix per source and per company, using allowed use (discovery, internal index, public display, AI retrieval, paid Network), evidence date, source URL, access scope, redistributability and personal data policy. Distinguish facts vs copyrighted source extraction.
4. Do not automatically mark all 288 assessments licensed or publish unverified findings. Preserve 9 holds and prohibit laundering restricted sources through independent crawler stages.
5. Legal retention and precise restricted purge manifest are still required; NEVER SQL-delete Storage objects or rewrite Git history.
6. Merge dependent PRs #861 → #867 → #869 → #870 before this PR, only after required CI/strict clean rebuild and migration reconciliation; do not bypass protection.

## Tests introduced
- `supabase/tests/trust_audit1c2f_authenticated_knowledge.sql` synthetic authenticated isolation and positive path (rollback).
- `supabase/tests/trust_audit1c2f_source_registry.sql` existing source-rights enforcement (rollback).
Both tests contain synthetic fixtures only, no personal identifiers, file bodies, secret keys or price data.

## Exit result
**Authenticated SQL RLS: PASS for checked cases. Source discovery admission: PASS for checked cases. Provenance coverage: PARTIAL. Live multi-role browser acceptance: OPEN. Physical purge: NOT DONE. Legal clearance: OPEN.**
