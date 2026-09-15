# P0.11 — CI/CD & deployment hardening

## Production topology

- GitHub repository: `ctimaru/steel-sales-ai`, production branch `main`.
- Web: Vercel, project rooted at `apps/web`.
- Worker: Railway `steel-sales-ai`, source `main`, health check `/health`.
- Database/Auth/Storage: Supabase production `steel-sales-ai`.

## Required merge gate

`.github/workflows/p0-required-gate.yml` is the authoritative merge and post-merge gate.
It always creates the final job `required` in the `P0 Required Gate` workflow on pull requests to `main` and pushes to `main`.
The gate classifies changed paths and runs only the required suites:

- `apps/web/**` → frontend install/test/typecheck/build;
- `services/worker/**` or `railway.json` → worker pytest;
- `supabase/**` → clean Supabase rebuild, P0 acceptance SQL, DB lint and worker/RAG regression;
- changes to the gate workflow itself → all suites;
- documentation-only changes → secret guard plus the stable final `required` check;
- every change → tracked-secret guard.

The older workflow files remain available through `workflow_dispatch` for manual diagnostics only, preventing duplicate CI spend.

### Branch protection target

`main` must reject direct pushes and require pull requests with the GitHub Actions status check named:

`required`

When configuring the rule in the GitHub UI, select the `required` check produced by the `P0 Required Gate` workflow / GitHub Actions app.

Recommended repository rule:

1. require a pull request before merging;
2. require the `required` status check from GitHub Actions;
3. require branch to be up to date before merging;
4. block force pushes and branch deletion;
5. allow repository administrators to bypass only for emergency recovery, or use no bypass for maximum enforcement.

This repository rule is an account/repository administration setting and must be verified independently from the workflow definition.

## Vercel

`apps/web/vercel.json` defines an Ignored Build Step:

`git diff --quiet HEAD^ HEAD -- .`

When the Vercel project root is `apps/web`, commits that do not change the web project are skipped instead of consuming a build/deployment. Frontend CI remains the code-quality gate.

Rollback: promote/rollback to the most recent known-good Vercel production deployment. Do not rebuild merely to roll back.

## Railway

Railway production watches only:

- `services/worker/**`
- `railway.json`

This prevents database/docs/frontend-only commits from redeploying the worker. The service remains on `main`, uses `services/worker/Dockerfile`, and requires `/health` to succeed.

Railway's `source.checkSuites=true` setting was attempted through the platform API during P0.11 but did not persist. Therefore the enforced protection is GitHub merge gating plus Railway path-scoped deployment. Re-verify native Railway check-suite gating when the platform setting becomes available/persistent.

Rollback: redeploy the previous successful Railway deployment or revert the offending commit through a pull request. Verify `/health` and P0 observability after rollback.

## Supabase

Production DDL must be represented by versioned files under `supabase/migrations/` and must pass the P0 Required Gate before application.

Deployment sequence:

1. merge only after the required gate passes;
2. apply the exact versioned migration to production;
3. run production smoke checks;
4. run Security and Performance Advisors;
5. record evidence on monday.com.

For destructive/data lifecycle operations, default to dry-run. P0.10 confirmation and audit controls remain mandatory.

Rollback: prefer a forward corrective migration. Do not manually edit applied migration history. Restore/PITR remains a pre-external-pilot gate while the project stays on the Free plan.

## Secrets and environment contract

Never commit `.env` files or production secret values. Examples are maintained in:

- `apps/web/.env.example`
- `services/worker/.env.example`

Production values stay in Vercel/Railway/Supabase secret stores. The required gate rejects tracked `.env` files and common production-token patterns.

## Cost policy

Keep Supabase/Vercel/Railway on Free or minimum-cost tiers while they satisfy internal P0/P1 development. Paid backup/PITR and related production guarantees are enabled only at the pre-pilot gate.

Supabase Leaked Password Protection is a paid-plan feature and is therefore treated as a pre-pilot Pro gate rather than a Free-tier P0 blocker.

## P0.11 exit criteria

- stable `required` check on PR and post-merge main;
- no duplicate automatic GitHub CI pipelines;
- branch protection requires the stable `required` check;
- Vercel is configured to skip unaffected backend/database-only changes;
- Railway deploy scope is restricted to worker/config changes;
- production health checks are green;
- temporary validation infrastructure is paused/dismantled;
- pre-P0 legacy test artifacts are classified/cleaned without touching tenant data;
- Supabase Advisors show no new structural security/performance warning;
- rollback/deploy procedure is documented here.
