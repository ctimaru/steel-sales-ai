# SEC-P0-CLOSE1D.16 — Release reconciliation

## Verified evidence (2026-10-24)
- Staging Supabase project: `lwrrrphakpbjhbzljqhn`, staging-only migration ledger version `20261024133532`, name `sec_p0_close1d15c_staging_structured_search_bridge`.
- Staging Worker real GoTrue JWT-derived actor A/B isolation and reserved-fixture cleanup: [GitHub Actions #40099938911](https://github.com/ctimaru/steel-sales-ai/actions/runs/40099938911) PASS. This is **not** a browser/Vercel acceptance.
- Backend service URL: `https://steel-sales-worker-staging-staging.up.railway.app`. Do not use its internal token in any client-side code.

## Schema divergence (not approved for production)
`public.p1_global_structured_search_bridge_v2(uuid,text,text[],jsonb,integer)` was created directly on staging to restore a missing RPC. The existing versioned `p1_global_structured_search` is not the same function. Staging SQL smoke and privileges were verified (service_role EXECUTE, anon/authenticated denied). **The exact deployed SQL is not yet stored in a reviewed repository migration.**

Gate before future promotion: obtain authoritative deployed `pg_get_functiondef` from staging using a privileged, reviewed channel; compare it against a proposed migration; verify grants, SECURITY INVOKER, tenant isolation, schema dependencies, migration ledger and clean rebuild; only then approve an explicitly controlled production rollout. Never assume a similarly named migration is equivalent.

## Browser-to-Worker integration gate
1. Authenticate two synthetic users through the **staging web deployment**.
2. Submit Global Search using actual Next.js server action. Confirm identity is derived from `supabase.auth.getClaims()`, never from request form parameters.
3. Confirm that both sessions see only their own RFQ, and a session-less invocation is denied.
4. Exercise negative token and missing-session cases, verify no credentials or other tenant payloads are logged.
5. Cleanup all synthetic staging Auth and organization/RFQ fixtures, and verify the cleanup.
6. Capture the GitHub Actions run and staging deployment IDs in issue #866.

## Release and cost gate
Production and staging Railway currently track `main`; merging non-runtime changes can cause deployment checks/builds. Keep deploys controlled, batch merges and verify both environments' newest deployed SHA and runtime health. Do not change production keys or promote staging RPC without a separate reviewed and approved release gate.

SEC-P0 issue #866 remains OPEN until browser integration acceptance and migration reconciliation are complete.
