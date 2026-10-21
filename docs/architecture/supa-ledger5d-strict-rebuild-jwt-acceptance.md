# SUPA-LEDGER5D — Strict Repository-only Rebuild & Real Local JWT Acceptance

**Project:** Smart Steel Sales · **Date:** 21 October 2026 · tracking [SUPA-LEDGER #780](https://github.com/ctimaru/steel-sales-ai/issues/780). **No production mutation or release authorized.**

## Objective and two distinct truth claims

1. **Strict repository-only replay:** Can a fresh ephemeral Supabase stack be started and `supabase db reset --local` complete using **only** the checked-in migration files, without injecting `supabase/ci/p0_pre_worker_baseline.sql` or `supabase/ci/p0_staging_baseline.sql`?
2. **Actual signed JWT / PostgREST acceptance on disposable local staging:** Do **two independent real GoTrue Auth sessions** obey the tenant isolation and commercial confidentiality boundaries when making HTTP calls using their signed bearer tokens?

A passing security test in the *assisted* stack does not imply the strict rebuild is green. Both are reported independently.

## CI changes: same existing P0 runner, no external staging charges

In `.github/workflows/p0-required-gate.yml`, before injecting any SQL baseline, run:
- `python supabase/tools/strict_rebuild_probe.py --output strict-rebuild-diagnostic.json`: invokes **unmodified** `supabase start`; if it succeeds, also attempts `supabase db reset --local`. Uses only loopback Docker and the repo's real migrations. It then calls `supabase stop --no-backup` to clean up; the normal assisted build starts separately afterwards.
- The tool records **booleans and non-sensitive failure category only**, never raw SQL, credentials, environment or log lines. GitHub retains the JSON as `strict-rebuild-probe` artifact for 14 days.
- **Fail-closed release flags**, even on successful replay: `automatic_release_authorized: false` and `migration_history_repair_authorized: false`. When strict replay fails, `strict_rebuild_passed: false`. The workflow is diagnostic; a known blocker does not make the downstream assisted security CI green by definition.

The existing P0 steps **continue to inject the two historical baselines**, then run the full long-established SQL and worker/RAG suites. They must all succeed independently to protect `main`.

### Important caveat on the strict result

The first migration dependency failure might arise during `supabase start` (since the CLI applies local migrations on startup), **before** an explicit `db reset` occurs. That still indicates repository-only bootstrapping cannot succeed, but the report specifies which phase failed and `reset_succeeded` separately. A timeout/environmental failure is `*_timeout` or `unclassified_failure`, **not proof** of a missing historical baseline. Further provenance work is required.

## Real signed JWT & PostgREST tests

`supabase/tools/local_jwt_tenant_acceptance.py` runs only **after** a healthy assisted reset and all existing SQL acceptance. It:
- Reads local API URL/keys using `supabase status -o env`; refuses any URL other than `http://127.0.0.1:54321`.
- Creates **two synthetic verified accounts** using the **local** Supabase Auth administration endpoint. Each independently signs in via real `/auth/v1/token?grant_type=password`, and the `/auth/v1/user` endpoint verifies the actual signed JWT subject.
- Creates two separate synthetic organizations with **active** membership owned by their respective test users, through the **local** PostgreSQL 54322 port only.
- Queries organization and membership read APIs as **both** users. Each should see its own organization/membership but none of the other user's.
- Verifies `anon` cannot see private organization rows, invalid bearer JWT is rejected, `anon` cannot call `rfqh13_governance_state`, and that internal price-list versions are not returned to either authenticated test identity or anon.
- Deliberately includes a **user-editable metadata field** pretending to be a platform superadmin. This is only attack-surface input; the security decision depends on actual database membership, **not** editable user metadata.
- Prints **aggregate acceptance counts** only; no JWT, passwords, actual user emails, source price values, credentials, business records or service-role keys are logged.

These are **real signed local JWT tests**, not an external preview/staging deployment. Because they operate on a disposable instance and do not interact with Vercel/Railway/production, they are suitable for the user's deferred infrastructure and cost constraints.

## Preconditions and regressions to watch

- Original P0 acceptance suite must still pass, including SUPA-LEDGER5C PA1.4 trigger, RFQH13 approvals, SEC1 local split, M5 reference integrity, SK4.2 manufacturer-only dimensions and PL1.5 geometry and source governance.
- The **SEC1 production gap remains unchanged**: 11 selected public Knowledge RPCs still SECURITY DEFINER in production, and `sec1_public` absent. A valid local JWT pass **does not authorize running SEC1 on production**.
- SCHOOL6B and TRADER1D3B2 remain GitHub-only/non-deployed production schema. The P0 assisted stack contains the local tables, but that is not live availability.
- Strict replay cannot be “repaired” by silently injecting historical baseline SQL and declaring success. The 36 remote-only histories, duplicated PA1.4/RFQH13 and collision at `20261005130000` must be provenance-resolved in a reviewed new baseline proposal.

## Release gates after SUPA-LEDGER5D

1. Find the first exact strict-rebuild failure and trace it to remote-only baseline schema provenance. Prepare a **separate**, security-reviewed historical baseline/ordering strategy. No production dump of private records into CI.
2. Confirm a **strict, no-baseline repo-only replay is actually successful**, independently of assisted test success.
3. Extend genuine signed JWT acceptance to claimant vs outsider, RFQ buyer/approver vs unauthorized supplier, Network Free/Pro entitlements and malicious user metadata, using fixed reproducible staging fixtures. **Current two-tenant tests do not cover every workflow.**
4. Recover the existing PostgreSQL DB password privately when available, rerun **official linked** migration list and plan **individual** history actions with rollback; no password reset merely for audit.
5. Only after #780 and authenticated acceptance close can IDENTITY2D #799/#801/#803 be merged/released; any SEC1 deployment also needs a standalone privilege-impact and rollout gate.

### Important safety guarantees

No `supabase db reset --linked`, `supabase db push`, `supabase migration repair`, SQL writes or impersonated calls **against production**. No production secrets. No Railway calls. No paid Supabase branch provisioned. No publication of source-restricted private price lists.
