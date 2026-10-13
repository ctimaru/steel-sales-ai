# RQG3.2 — Authenticated Production Acceptance

## Boundary and status
**RQG3.1** was merged in PR #543. Real Chrome + GoTrue + tenant-isolated Company Review, guarded Server Actions and PostgREST RPC writes passed in **disposable local Supabase**. Anonymous production Chrome private-route denial also passed. Neither proves *authenticated production* authorization.

**RQG3.2 remains PENDING** until a **manual** signed-in Chrome run passes on the deployed site with **approved synthetic production accounts and marked fixtures**. No real customer's Review entries may be changed, even for test purposes.

## Prerequisites — do not bypass
1. Provision eight authorized, independent **demo-only production identities**: `owner`, `registrationStaff`, `claimsStaff`, `trustStaff`, `auditor`, `companyAdminA`, `companyAdminB`, `companyViewerA`. The `owner` persona must be the sole existing owner; **do not create another superadmin**. For production testing, use the real owner account only after explicit approval, or leave this gate pending. No customer/staff credentials should be repurposed as demo accounts.
2. Company A and B must have **distinct, pre-approved synthetic** Review evidence visibly labeled with different `RQG32-` markers. Do not use the three existing real review cases or modify real records to prepare test fixtures.
3. Configure protected GitHub Actions environment `rqg32-production-readonly` and its required environment reviewers. Put the JSON object containing each approved persona's `email`, `password`, `synthetic:true`, and two Company Admin `expectedMarker` strings in encrypted environment secret `RQG32_PRODUCTION_PERSONAS_JSON`. No secrets in PRs, logs, artifacts, comments or ChatGPT.
4. After checking the deployed Git commit, manually dispatch `RQG3.2 Production Authenticated Review Acceptance` with explicit `approved_read_only=true`. There is no automatic push or PR trigger.

## Assertions
- Real production login (the only permitted POST): no registration, company activation or data modification in the test.
- Platform Owner sees five Platform Review lanes; Registration, Claims and Trust delegates see only the delegated lane; Platform Auditor sees five read-only lanes.
- Staff cannot open unrelated domains. All Platform roles are denied Company Review unless independently granted tenant admin membership.
- Company Admin A sees its own synthetic marker but not B's, and vice versa. Both are denied Platform Review.
- Company Viewer A is denied Company Review, `/review`, `/review/identities` and Platform Review.
- The browser aborts all non-GET/HEAD traffic except the initial POST to `/login` during sign-in. The test never clicks `Conferma`, `Correggi`, activation, Claim or publication controls. It never calls mutating production RPCs. No screenshot, trace or authenticated storage artifact is uploaded.

## Gate decisions
- Secret missing / environment unapproved / not enough identities / no distinct synthetic markers / failing navigation or isolation: **RQG3.2 NOT ACCEPTED**.
- Green protected manual run against confirmed deployed commit: **RQG3.2 signed-in production read-only gate PASS**. Keep production decision-write acceptance separate and pending until a dedicated non-customer fixture plus rollback/audit procedure is approved.
- Preserve RQG3.1 local write/RPC acceptance and anonymous production smoke as distinct evidence. No Supabase migration, cron, scheduled Vercel consumption or automatic release in this change.
