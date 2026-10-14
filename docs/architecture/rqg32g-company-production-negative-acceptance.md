# RQG3.2g — Negative Company Review Production Acceptance

**Current scope: defensive / negative only.** The three RQG32 QA company personas are unassigned, with no organization or legal acceptance and no synthetic Review entries. Even though the four Platform staff passed production Chrome (RQG3.2f run #38538124176: 12/12, zero transmitted application writes), Company Review **positive** authenticated production acceptance has not happened.

## Live safe negative test

Manual GitHub Actions workflow `RQG3.2g — Company QA Denial Chrome (Unassigned)` on `main`, approval `RQG32G_INSPECT_UNASSIGNED_COMPANY_TEST_USERS`, protected `production-qa` environment. A read-only Supabase Admin preflight checks: seven tagged QA identities, exactly one Owner, three company accounts have zero memberships, zero legal acceptance entries and zero Platform roles; no QA organizations or Review records. **If any of those facts change, stop instead of issuing a false negative success.**

Three isolated real Chrome sessions sign into production under their already-created company-A, company-B and viewer QA identities. They must all be redirected away from `/operations/review`, `/platform/review` and `/review`. No Review content or synthetic marker may be rendered. Requests other than GET/HEAD and password login POST are blocked before transmission; no consent forms are accepted. No artifacts, cookies, screenshots or session traces are saved. All environment secrets are scoped only to the stages using them. Does not create users, organizations, memberships, legal acceptance, commercial records or any root grants.

## Positive tenant Company Review — separate decision

Existing `RQG3.1` suite already covers **positive Company Review admin A/B**, restricted viewer, direct RPC/RLS cross-tenant denials and controlled mutations in **disposable local Supabase** (24/24 as previously reported). It is the authoritative non-production positive Company Review test and should be rerun whenever tenant boundary code changes.

Do not create fake Terms acceptance in hosted production, bypass `lr5_current_legal_acceptance_state`, or treat synthetic QA organizations as real legal entities. A production-positive test requires an explicitly reviewed test-organization registration and valid terms acceptance by actual authorized users; without that, full 7-persona RQG3.2 production acceptance remains BLOCKED.

Passing RQG3.2g means production denies **unassigned** synthetic company users only. It does not prove positive company tenant access.
