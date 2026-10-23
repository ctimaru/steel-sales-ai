# TRUST-AUDIT1C.2G.3D — PostgreSQL Lint Hardening & Network Function Repair

Date: 2026-10-23. Scope: three PL/pgSQL diagnostics identified in the explicitly approved ephemeral GitHub rebuild #39952799030.

## Why this block exists
The Supabase CLI command `supabase db lint --local --level warning` finished with a zero exit status despite logging three issues at severity `error`. Treating that overall exit code as release-safe would be misleading. All three are in existing industrial Network functions, outside the newly added rights ledger. Fix them in a **forward-only migration**, add a fail-closed machine-readable lint gate, and retain a separate product/real-JWT release decision.

## Findings and minimal fixes
1. `private.p3_enrich_existing_company_discovery_impl`: `min(f.id)` on `uuid` is not defined in PostgreSQL. The function calls it only while attempting to select the sole published facility for a company. Use `min(f.id::text)::uuid`, preserving the intended result if exactly one facility exists and retaining the existing `count(*)<>1` handling.
2. `private.p3_enrich_existing_company_discovery_selected_impl`: same UUID aggregate problem; same minimal repair.
3. `public.netlaunch2_commit_daily`: unqualified local `accepted` and `skipped` collide with columns in the worker batch function. The production DB already had the unambiguous `v_accepted`/`v_skipped` names, **but the canonical migration chain does not**. The forward migration carries that corrected definition into any new clean rebuild and brings the staging source into alignment without editing the historic migration.

All three definitions retain their original parameter signatures, `security definer` or invoker status, explicit `search_path`, worker-only guard, and existing grant restrictions. This migration changes function definitions only. It neither approves source licensing nor modifies company records, user roles, prices, files or database migration history.

## Versioned deliverables
- Forward migration `supabase/migrations/20261023123000_trust_audit1c2g3d_network_plpgsql_lint_fixes.sql`: three replace-function statements; no destructive schema operation.
- `supabase/tests/trust_c2g3d_plpgsql_function_contract.sql`: transaction-scoped assertions that the UUID aggregate, counter disambiguation, security-definer flags and worker-only EXECUTE are preserved.
- `scripts/trust_c2g3d_fail_closed_lint.py`: parses structured Supabase CLI lint results. Blocks on any issue with `level=error`, `fatal` or `critical`, even if CLI exits successfully. Blocks on an invalid/missing report. Only reports function names and severity counts, never function bodies or SQL arguments.
- Unit tests verify the CLI-zero-with-embedded-errors failure mode, warnings, empty-clean output and fail-closed behavior.
- `.github/workflows/trust-c2g3d-network-lint.yml`: cheap push CI for parser unit tests. A Docker rebuild is *not* automatically launched on every commit: maintainer must explicitly label this PR `trust-c2g3d-approve-isolated-lint`, and exact branch identifiers are validated. No remote DB secrets; Supabase Docker local only with two historical CI baseline files temporarily injected into the runner. Strict contract and existing quarantine/provenance tests precede the lint parser, then cleanup always runs.

## Acceptance gates
- [ ] Isolated replay and runtime tests from the **updated** migration.
- [ ] Structured lint analysis detects **zero level:error** diagnostics across the local schema.
- [ ] Verify broader warning-only diagnostics and decide whether to improve them in a separately budgeted task.
- [ ] CI and dependency merge from #861 onward; no forced/wholesale replay of production ledger.
- [ ] Separate staging functional acceptance of affected enrichment paths and daily worker batch.
- [ ] Protected real-JWT Chrome owner/nonowner and Vercel preview QA of rights console.
- [ ] Legal and rights review for commercial source reuse; rights matrix still defaults to not-cleared.

No production/staging DDL or database reset is performed in this Draft-PR stage. A successful local replay does not authorize a deploy or a historical ledger repair.

Parent [PR #885](https://github.com/ctimaru/steel-sales-ai/pull/885), isolated replay [run #39952799030](https://github.com/ctimaru/steel-sales-ai/actions/runs/39952799030), current source-rights console [PR #880](https://github.com/ctimaru/steel-sales-ai/pull/880).
