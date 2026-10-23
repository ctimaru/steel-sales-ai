# TRUST-AUDIT1C.2G.3B — Real-JWT Chrome Acceptance & Stack Integration Preflight

Date: **2026-10-23** · **GO / NO-GO: RELEASE BLOCKED**.

## Why we are not releasing the console yet

The Superadmin Rights Decision Console is implemented in [PR #880](https://github.com/ctimaru/steel-sales-ai/pull/880) but not in `main`. The Postgres owner-only RPCs are already applied to Supabase staging and production and passed role-based SQL tests. However, SQL `SET ROLE` / simulated `request.jwt.claim.sub` is **not** a signed GoTrue session and cannot be reported as Real-JWT acceptance.

### Verified upstream GitHub facts
PR dependency sequence (all open at audit time): **#861 → #867 → #869 → #870 → #872 → #873 → #874 → #876 → #880 → #881**.

- #861's head had **8 commits ahead / 6 behind** main in the initial check; its history has diverged. The preflight workflow's later `origin/main...HEAD` comparison reported **7 main-only commits** at its execution. These are different comparisons and GitHub may move during the day.
- All subsequent stacked PR heads were confirmed as descendants of their predecessors in GitHub compare results (`ahead`, 0 behind). Their clean intra-stack ancestry **does not** prove current-main integration readiness.
- Existing generic PERF2.1/TypeScript and component source checks are PASS for #880, but a protected real-owner browser login and page-specific visual acceptance have not been executed.

### Verified Supabase migration inventory (non-sensitive)
- Production: **8 canonical TRUST migration records**, and each corresponding SQL migration exists in the stacked repository.
- Staging: **9 historical TRUST migration records** for the same series. One non-recursive staging-only policy repair was recorded separately and other migration versions differ from production.
- **Do not update `supabase_migrations.schema_migrations` blindly**, drop staging records or rewrite historic SQL. A strict clean rebuild from canonical repository migration files on an isolated DB is required before resolving these differences.
- The migrations already applied to production **must not** be applied twice by CI. Compare exact version, name and resulting schema/permissions before accepting reconciliation.

### Vercel deployment evidence
The deployment tied to the latest console commit **539de11e…** is **CANCELED** in Vercel. “Preview Comments success” is not proof of a READY deployment. We did not create a new preview or consume an extra deployment for this audit.

## Artifacts added

1. `supabase/audits/trust_c2g3b_stack_migration_snapshot.json`: sanitized, read-only evidence of migration names/versions from staging and production plus required gates. No database connection string, access token, personal data, or pricing data.
2. `scripts/trust_c2g3b_stack_preflight.py`: reports all canonical migrations present, checks staging/production version mismatch, detects main ancestry divergence and lists open gates. `--strict` blocks release. The standard report mode returns success to allow auditors to inspect blockers without granting permission to deploy.
3. `scripts/test_trust_c2g3b_stack_preflight.py`: synthetic regression tests for fail-closed and success paths.
4. `apps/web/tests/trust-c2g3b-real-jwt-negative-chrome.mjs`: real GoTrue sign-in in ephemeral Chrome for **six pre-existing synthetic QA personas** (four scoped Platform Staff, two company users) followed by denial verification for `/platform/network-trust/source-rights`. All non-login application mutations are aborted; no artifacts, secrets, credentials, cookies, screenshots or traces are exported.
5. `.github/workflows/trust-c2g3b-stack-realjwt.yml`: no-secret static preflight on this audit branch. The **real-JWT** job requires protected `main`, an explicit exact approval string, existing `production-qa` GitHub environment and the six pre-existing QA password secrets. This job is intentionally **SKIPPED** on unreviewed branch pushes and can run only once the route is integrated and production-live from a reviewed commit.

## Release acceptance matrix

| Area | Checked result |
| --- | --- |
| GitHub stacked branches relative to each other | PASS |
| First PR compared to current `main` | DIVERGED / reconcile |
| Required production SQL migration files in stacked repo | PASS (8 / 8) |
| Staging and production TRUST migration ledger alignment | FAIL / investigate before strict rebuild |
| SQL owner-only authorization with role+subject simulation | PASS in earlier C2G.3; **not signed JWT** |
| Browser real-JWT **nonowner** acceptance | **NOT RUN**; protected workflow created |
| Browser real-JWT **owner** acceptance | **NOT RUN**; sole Superadmin must use their own real session, no cloned production owner |
| Page-specific mobile/keyboard screenshot QA | **NOT RUN** |
| Vercel preview corresponding to console commit | CANCELED |
| PR merger, release, DB cleanup, price-list purge | NOT EXECUTED |

## How to execute Real-JWT acceptance safely

1. Complete PR dependency integration into protected main, resolve migration drift on isolated staging, and confirm the console's deployed production/preview route. Never run this workflow against a route not yet deployed.
2. From GitHub Actions on **`main`**, choose **TRUST-C2G3B Stack & Real-JWT Release Preflight**, `mode = jwt_negative`, `approval = TRUST_C2G3B_READ_ONLY_PRODUCTION_JWT`. The existing `production-qa` environment must approve it; secrets stay within the protected job and browser lifecycle.
3. Read the output for **six successful logins + six denied owner-only route accesses**. If one login is missing or an account reaches Source Rights, the job fails.
4. Separately open the console with the **founder's genuine Superadmin session** (not a synthetic production Superadmin). Verify company list, seven use filters, evidence panel, hold prohibition, confirmation modal, append-only history, and the absence of any real source rights issuance during QA. Do not record/print session cookies or access tokens.
5. Add a targeted **direct PostgREST RPC denial** test using real authenticated QA JWTs under a protected environment if publishable credentials are available, without exposing JWTs in logs.
6. Verify at 320/390/768/1440 px, keyboard, focus states, overflow, small type, screen reader labels, and empty/blocked/expired decisions.
7. Record screenshot checks in a restricted artifact store that does not include personal data or credentials. Avoid screenshots of protected client source URLs and employer documents.

## Security & economics

No GitHub secret values were read or printed, no production test users/roles created, no database DDL or purge, no Vercel deployment and no rights grant. CI uses read-only GitHub permissions, and credential-bound tests cannot run from the Draft PR branch. 
**Do not claim launch clearance** until real owner authenticated acceptance and clean schema rebuild have succeeded. Subsequent C2G.4 source-rights enforcement must remain a distinct audited release.

Links:
- [PR #880 — Console](https://github.com/ctimaru/steel-sales-ai/pull/880)
- [PR #861 — First stacked dependency](https://github.com/ctimaru/steel-sales-ai/pull/861)
- [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
