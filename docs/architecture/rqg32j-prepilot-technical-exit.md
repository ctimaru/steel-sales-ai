# RQG3.2j — Technical pre-pilot exit (synthetic-only)

Decision on 2026-10-14: **do not activate production company test tenants or access any existing customer's Review data** at this stage. Resume consented live positive Company pilot only when commercial pilots are explicitly authorized.

## Evidence / scope

| Gate | Evidence | Classification |
|---|---|---|
| Platform staff scoped live access | RQG3.2f, production Chrome run 38538124176, 12/12 | PASS, production platform-only |
| Unassigned Company user denial | RQG3.2g, production Chrome 12/12 | PASS, production negative-only |
| Company A/B positive isolation, Buyer Viewer denial, Platform denied Company Review | RQG3.2h disposable GoTrue/PostgREST/Next/Chrome, Actions run 38541426572 | PASS, isolated synthetic environment |
| Confirm/Correct actions, RLS and RPC cross-tenant / replay controls | RQG3.1 on the same disposable environment, run 38541426572 | PASS, isolated synthetic environment |
| One or more consenting active companies, real production Company Review positive acceptance | RQG3.2i manual workflow exists but was not executed | **DEFERRED to authorized external pilot** |

This is an **environment-scoped technical exit**, not a claim that the full RQG3.2 seven-persona production-positive acceptance passed. Keep the hosted acceptance status **DEFERRED**, not PASS. Preserve all production permission, legal consent and RLS checks without creating testing exceptions.

## Why no further hosted test now

The hosted RQG32 QA company accounts were intentionally left without memberships, Terms declarations or synthetic Review rows. Fabricating a legal acceptance or populating live commercial fixtures merely to satisfy QA would invalidate the test and undermine governance. Existing real customer organization/Review data must not be used as a substitute. RQG3.2i is opt-in and manual-only, protected by production-qa and explicit participant approval; **do not run it during pre-pilot work**.

For continued coverage use the existing `PERF1 Chrome Auth & Multi-Account Acceptance` reusable workflow on an ephemeral Supabase+Next instance, seeded only with local synthetic Company A/B review rows. It performs real authenticated Chrome, JWT+RLS and Review decision checks, then destroys its database and credentials. This adds **zero Vercel production runtime** and avoids creating privileged production fixture users or tenants.

## Pre-pilot exit checklist

- [x] Dedicated Platform Review separated from Company Review, role-scoped authorization.
- [x] Production Platform Chrome positive and unassigned Company negative evidence.
- [x] Synthetic multi-company positive / Viewer denied / Platform denied.
- [x] Local-only Review decision authorization, RLS and RPC regression.
- [x] The sole actual production superadmin remains the only Owner (last inspected 2026-10-14).
- [x] Manual-only RQG3.2i runbook preserved for a later *authorized* pilot.
- [ ] **Host-positive Company Review verification** — deliberately deferred; NOT a pre-pilot release blocker.
- [ ] **Two real organization production isolation** — deliberately deferred; NOT a pre-pilot release blocker.

## Next safe work

**RQG4 — Company Review operational UX and synthetic release readiness**: evaluate operator-facing queue labels, statuses, navigation and empty/loading/permission states under disposable Company Admin A/B + Viewer contexts. Ensure the dashboard never promotes Platform Review tasks as Company actions. Scope does not include real customers, new Auth accounts, company onboarding, live consent writes or expensive Vercel background jobs.

When genuine commercial pilot onboarding begins, reopen the RQG3.2i hosted positive gate. Require written operator/participant authorization, dedicated user account, independently performed current Terms acceptance, governed company membership, and read-only execution. Never count synthetic local consent as real consent.
