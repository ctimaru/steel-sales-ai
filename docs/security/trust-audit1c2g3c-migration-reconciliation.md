# TRUST-AUDIT1C.2G.3C — Migration Reconciliation & Protected Release Readiness

**23 October 2026. State: SCOPED CATALOG/BUSINESS RULE PARITY PASS; HISTORY/REBUILD/JWT NOT CLEARED; RELEASE NO-GO.**

## Objective and data-handling guard
Safely explain why the private Network Rights Console cannot yet move from stacked PRs to production. Investigate schema *behavior* independently from the dated migration ledger. Never rewrite Supabase migration history, recreate production users, delete third-party data, release source rights automatically, or bypass the repository's protected branch.

## Live observations (production vs staging, read-only)
- **27/27** selected TRUST/owner functions, views, RLS policies and triggers are present in each environment.
- **25 identical normalized definitions**. Exactly **two SQL-text differences**:
  1. `private.trust_c2e_prevent_quarantined_reingest()`: comments, whitespace and a local PL/pgSQL variable name differ; the same guard conditions were inspected.
  2. `private.trust_c2g_company_provenance_readiness`: different LATERAL subquery aliases, with matching columns and expressions as reviewed.
- Transactional behavioral acceptance on both databases from `supabase/tests/trust_c2g3c_behavioral_parity.sql`: **PASS staging and production**. A synthetic quarantined SHA256 cannot create a queued worker job (SQLSTATE 42501), company readiness count matches the company table, source assessment counts agree with the input relation, no auto-cleared rights, four reingest triggers. All synthetic writes are rolled back.
- These are **scoped equivalence checks**, not proof of an identical full Postgres instance or of a successfully replayed migration history.

## Migration ledger — the underlying gap
Production currently contains **8 canonical TRUST migration records**, staging **9** records. The *executed SQL statement hashes* match on four shared names; three shared names have different SQL bytes; the remaining source-read-gate path is recorded as **one production migration** versus **two staging migrations**, including a staging-only read-policy repair. Timestamps/versions differ for all shared entries. The current restricted catalog matches apart from the two reviewed lexical variations.

**Policy:** Leave both historical ledgers intact. Do not mark missing versions manually, update `supabase_migrations.schema_migrations`, replace a legacy applied SQL file, or replay production migrations on the same project. A new, isolated local rebuild must show that the historical baselines + canonical current files compose cleanly, without credentials for either hosted database. Staging may retain lawful development history that is intentionally not in production; explain it, don't delete it.

## GitHub ancestry
- Source of the stack: [PR #861](https://github.com/ctimaru/steel-sales-ai/pull/861). At this audit, `main` has **8 commits** not in #861, while #861 has **8 commits** not in `main`. Between their common ancestor and each head, GitHub lists **11 changed files on main** and **13 on #861** with **zero overlapping paths**. This reduces textual conflict probability; it does not establish runtime compatibility.
- Subsequent PRs are stacked behind #861: **#867 → #869 → #870 → #872 → #873 → #874 → #876 → #880 → #883 → this PR**. The branch protection/required CI and migrations must be respected during sequential integration.
- No rebase, merge, force push, or production deployment has been performed in this microblock.

## Versioned artifacts
- `supabase/audits/20261023_trust_c2g3c_catalog_and_ledger_snapshot.json`: sanitized, **dated** fingerprints and ledger names/versions only; deliberately no source rows, file URLs, passwords, access tokens or proprietary content. MD5 here only detects ordinary SQL text drift; it is not a cryptographic authenticity proof.
- `supabase/tests/trust_c2g3c_behavioral_parity.sql`: SQL for controlled transaction/rollback, PASS both hosted environments.
- `scripts/trust_c2g3c_migration_reconciliation.py` + unit tests: compares versions and executed statement fingerprints, missing/duplicate canonical SQL files and selected catalog definitions. Differing text can be classified as reviewed only if the documented behavioral probe passed; any **new** mismatch fails the scoped parity gate. It reports release NO-GO while open gates remain.
- `.github/workflows/trust-c2g3c-protected-rebuild.yml`: inexpensive no-secret CI by default. A separate **manual** job provides a 35-minute max fresh GitHub Docker Supabase rebuild using existing CI historical baseline SQL. It requires exact authorization, `workflow_dispatch`, protected main and does not connect to remote databases. This optional expensive job is **not executed by opening the Draft PR**; full replay remains an open acceptance gate.
- The existing Supabase P0 workflow and earlier ledger divergence audits already handle broader schema issues. This checkpoint focuses on the newly stacked TRUST rights stream, not the entire historical baseline reconciliation backlog.

## Release gate
**Code parity / metadata**: scoped PASS.
**Full clean rebuild from canonical migrations**: NOT RUN, and must be performed on an isolated local ephemeral project first.
**Signed Real-JWT Chrome owner + six nonowners**: NOT RUN. No user's credentials are copied or shared.
**Vercel preview**: earlier deployment CANCELED.
**Network rights**: no grants; the Rights Console ledger does **not** yet enforce permissions in public, AI or paid Network services.
**Legal/IP**: source-specific licences, employment and retention/authorized purge remain separate open gates.

## Recommended next action
1. Confirm required checks on the root #861 and recompute merge preview/ancestry against current main.
2. Run the manual **isolated-clean-rebuild** job on the protected reviewed commit, without exposing any remote DB credentials. If it fails, examine the earliest migration dependency or function-order failure; do not attempt production repair.
3. Compare schema/permissions after local replay, then resolve historical differences through a separately approved, forward-only plan if truly necessary.
4. Integrate PRs in order with CI and staged acceptance. Confirm a real Vercel preview before any production release.
5. Perform protected Real-JWT/Chrome Owner + nonowner tests and visual QA of the actual console, with no secret tokens or source rights granted by test.

References:
- [Latest stack PR #883](https://github.com/ctimaru/steel-sales-ai/pull/883)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase local workflow](https://supabase.com/docs/guides/local-development/cli-workflows)
