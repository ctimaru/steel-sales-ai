# RQG3.2 — Authenticated Production Acceptance

## Verified status (2026-10-13)

RQG3.1: authenticated Google Chrome with real LOCAL GoTrue and tenant-isolated synthetic data passed (24/24); anonymous production Chrome passed. **Those results do not prove authenticated production role isolation.**

Read-only production Supabase inventory at the beginning of RQG3.2 showed **four auth identities total, one with a test/demo-like name, and zero RQG3.2-marked identities**. The connected browser's available profile had **zero signed-in sites**. No authorized credentials for seven separate synthetic production personas were available to perform the authenticated browser check.

**Authenticated production verdict: BLOCKED — not green.** This check must not be marked accepted, merged as a "passed" test, or quietly replaced with local E2E.

## Safe release harness

Workflow: \`.github/workflows/rqg32-production-auth-review.yml\` (manual workflow_dispatch ONLY). Script: \`apps/web/tests/rqg32-production-authenticated-readonly.mjs\`.

- Seven **dedicated synthetic accounts**, identifiable with \`rqg32-\` or \`+rqg32-\` in email local part:
  1. Registration staff: ONLY Registration Platform Review lane.
  2. Claims staff: ONLY Claims Platform Review lane.
  3. Network Trust staff: ONLY Trust Platform Review lane.
  4. Platform Auditor: all five lanes **read-only**, no Company Review.
  5. Company Admin A: Company Review and distinct \`RQG32-...\` test evidence A, no platform.
  6. Company Admin B: Company Review and distinct \`RQG32-...\` test evidence B, cannot see A.
  7. Company Viewer: denied Company and Platform Review, including legacy deep links.
- **The sole production superadmin is deliberately not impersonated and not added to GitHub Secrets.** Owner permission coverage was exercised with the single synthetic owner on local GoTrue in RQG3.1; a manual production Owner check would require a user-authorized, already-authenticated browser session.
- Each production account must have the required permission/membership in the real environment. Platform role delegation must be done by the authorized Platform Owner through standard audited workflows. Company A and B must be explicitly synthetic and own a distinct, pre-existing test record in their Review Queue with a marker matching \`RQG32-[A-Z0-9_-]{6,64}\`.
- **Do not backfill RQG3.2 identities through direct auth.users SQL, create a second superadmin, or seed commercial evidence automatically in production.** This acceptance script never creates accounts, rows, or approvals.
- Configure **seven QA password environment secrets** (one per role) and `RQG32A_AUTH_SECRET_KEY` in the protected `production-qa` environment. Email addresses and markers are fixed, public QA identifiers and no longer require GitHub secrets. **Never paste passwords, tokens or session cookies into ChatGPT/PRs/Notion.** Restrict workflow and environment permissions; revoke the Admin key after operations.
- From GitHub Actions select **RQG3.2 — Production Review Chrome Auth Read-Only**, run manually on \`main\`, type exactly \`I_APPROVE_READ_ONLY_RQG32\`.

## Technical safety boundary

1. Hard-coded production origin \`https://www.smartsteelsales.com\`, project GoTrue origin pinned to the expected Supabase project, no arbitrary target URLs.
2. Real Chrome login with passwords delivered only via GitHub Secrets into a short-lived job. No screenshots, traces, session state, storage, audit exports or artifacts.
3. Only GET/HEAD traffic and **POST solely during login** to \`/login\` or Supabase \`/auth/v1/token?grant_type=password\` can reach production. All other non-GET requests are aborted **before transmission**. The script does not click any Review decision control and does not invoke any RPC.
4. Browser sessions are isolated by context; login authorization and tenant markers are evaluated independently; no real evidence values are logged.
5. A failure to log in, missing dedicated account/marker, unexpected lane, reviewer escalation, private-data leakage or unauthorized route reachability **fails** the run. The workflow is never triggered on a PR/push or scheduled; no additional Vercel build or app cron is required.


## RQG3.2b — Consolidated production QA acceptance gate (2026-10-13)

The earlier eight-persona workflow **has been retired**: it required a synthetic Platform Owner and could be confused with the strict seven-persona suite. Exactly one production Platform Owner remains; the real Owner's password is **never** placed in GitHub Secrets.

**Single authorised workflow**: `.github/workflows/rqg32-production-auth-review.yml`, manual-only from `main`, environment `production-qa`. It refuses Chrome sign-in until a **read-only RQG3.2a readiness check** validates all seven trusted Auth users, precisely scoped staff and company memberships, two completed synthetic organizations and their two pending review markers. The privileged `RQG32A_AUTH_SECRET_KEY` is visible only to the preflight step, **not** the Chrome step; credentials are loaded from protected Actions secrets.

Use the same `production-qa` environment for the RQG3.2a provisioning tool and the Chrome gate; restrict it to the `main` branch and use environment approvals when available. Do not store passwords in general repository secrets if you can use protected environment secrets. The seven emails and two markers must match the exact `RQG32` contract; no second owner persona is permitted.

**Current real production result**: zero RQG32 users, zero demo organizations and zero demo Review items in Supabase, one active owner. RQG3.2b makes the test **safe to execute once authorized data exists**, but **the authenticated live production acceptance is BLOCKED and has NOT run**. No production accounts, permissions, records, decision RPCs or Review statuses were created/changed by this code.

## Exit gate

- [x] Local authenticated Chrome with platform/company roles and RPCs (RQG3.1).
- [x] Anonymous production Chrome private-route denial (RQG3.1).
- [x] Static safety contract + manual production test harness (RQG3.2 code).
- [ ] Dedicated synthetic production accounts + distinguishable tenant Review evidence provisioned/authorized.
- [ ] Explicit manually launched RQG3.2 workflow with **all checks passed**, no application mutation requests transmitted.
- [ ] Optional manual Owner confirmation using a user-authorized signed-in production browser (without exporting Owner credentials).

Until the unchecked criteria complete, classify **RQG3.2 as test-ready / live-auth-pending, not full production acceptance**.
