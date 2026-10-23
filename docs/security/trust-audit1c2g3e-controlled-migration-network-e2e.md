# TRUST-AUDIT1C.2G.3E — Controlled Migration Promotion & Network E2E Acceptance

**Date:** 2026-10-23. **Status:** staged DDL PASS; production pending positive acceptance and stack integration.

## Rationale
The single-purpose C2G.3D migration fixes 3 existing PL/pgSQL errors: two undefined `min(uuid)` aggregates used for unambiguous facility selection and one ambiguity in daily Network batch counter variables. A strict lint of 41 reported functions showed zero error diagnostics in local Docker. This workstream now prepares a safe *staging-first* promotion and tests the real permission boundaries without claiming legal source rights.

## Supabase staging change, already applied
- `trust_audit1c2g3d_network_plpgsql_lint_fixes`: applied on **staging** after direct verification of the PR #886 migration text (only `CREATE OR REPLACE FUNCTION` and preserving worker EXECUTE).
- Recorded staging ledger version: **`20261023124810`**. The canonical repo file is `20261023123000_trust_audit1c2g3d_network_plpgsql_lint_fixes.sql`. As with earlier TRUST migrations, this timestamp difference is **not** permission to rewrite the ledger.
- `supabase/tests/trust_c2g3d_plpgsql_function_contract.sql`: **PASS** (three fixed bodies and original role security boundaries preserved).
- An ordinary authenticated caller was refused P3 enrichment with SQLSTATE **42501** (missing `discovery.review` platform permission).
- Ordinary authenticated caller of the worker-only `netlaunch2_commit_daily` was refused.
- Under a staged synthetic `claimed` Network batch and simulated service_role, `netlaunch2_commit_daily` **correctly rejected unapproved source** (SQLSTATE 42501); all inserts/updates rolled back.
- Staging currently has **0 discovery candidates**, **0 Network batch runs**, **4 sources unreviewed/disabled** and **no licensed source entry** matching the hard-coded required Wikidata source ID. Therefore a *positive real source E2E in staging is currently impossible without introducing a licensed source or a synthetic isolated fixture*. This is a **blocked acceptance dimension**, not a bug in the migration.
- Production has **162 discovery candidates, 8 existing Network runs**, but none were used as testing fixtures. Production migration **NOT applied** by C2G3E.

## Positive synthetic Network E2E (Docker only)
`supabase/tests/trust_c2g3e_synthetic_network_positive_LOCAL_ONLY.sql` inserts only synthetic QA data into ephemeral Docker with transaction rollback:
- a synthetic reviewer identity solely to satisfy the source-registry constraint;
- a synthetic license/governance row for the pinned Wikidata source **solely to test worker behavior**. This is explicitly **not real legal permission**, and this test is *never* run in staging or production;
- a fake claimed batch with two sectors, zero offsets, 1 synthetic entity `synthetic-c2g3e.invalid` (non-resolving `.invalid` suffix);
- calls the actual `netlaunch2_commit_daily` function with PostgreSQL `service_role` locally;
- asserts `status=completed`, counters `accepted=1`, `new_unconfirmed=1`, `canonical_published=0`, and the synthetic entity stored in the **unconfirmed** Network table;
- rolls back all synthetic users, source registry, entities, cursors and batch run.

The positive fixture only verifies the SQL flow with synthetic conditions. It does **not** verify external Wikidata crawling, real licensing or actual signed worker credentials.

## GitHub implementation and bounded-cost acceptance
- [PR #887 — Controlled Migration Promotion & Network E2E](https://github.com/ctimaru/steel-sales-ai/pull/887), Draft stacked after #886; no merge.
- `.github/workflows/trust-c2g3e-network-acceptance.yml`: cheap static preflight on branch; expensive Docker job only on a **reviewer-added** PR label `trust-c2g3e-approve-local-network-e2e`. The workflow hardcodes the expected head/base branch, requires no remote Supabase credentials, calls Docker locally and always cleans up. Max 35 minutes.
- Staging denial SQL persisted in `supabase/tests/trust_c2g3e_staging_unlicensed_worker_denial.sql`, already tested with rollback.

## Release decision
**STAGING FUNCTION PROMOTION PASS; PRODUCTION REMAINS NO-GO** until:
1. Positive synthetic Docker E2E and cleanup PASS;
2. source governance and company enrichment behavior confirmed in a controlled environment with valid fixtures and no legal hold;
3. explicit migration review/commit and stack PR #861 through #887 integration readiness;
4. production readiness/rollback of function definitions and original grants assessed;
5. protected real JWT owner/non-owner acceptance and Vercel preview for the rights console;
6. source reuse rights/AI/premium Network remains blocked absent documented approval.

Avoid setting `approved` flags in hosted databases merely to make tests green. Do not rewrite historical migration versions, publish sourced text or erase quarantined evidence.
