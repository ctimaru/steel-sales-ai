# RQG3.2e — Controlled Owner-Approved QA Staff Self-Claim

## Verified gate
As of 2026-10-14, all seven synthetic Auth identities have been verified on production; exactly **one** active Platform Owner remains. The sole Owner explicitly created four pending invitations in `/platform/people`, one per delegated QA staff role: registration, claims, trust, auditor. The existing `sa2_claim_platform_staff_invitation()` security-definer RPC only lets the logged-in, email-confirmed, invited user claim its own invitation, and records an audit event. There is no second Owner or service-role bypass.

## Run
GitHub Actions: **RQG3.2e — Controlled QA Staff Invitation Self-Claim**, branch `main`, approval exactly `RQG32E_CLAIM_FOUR_APPROVED_INVITATIONS`. The `production-qa` environment is required. The four QA passwords are reused from the existing protected environment secrets (no new credentials); **no Supabase Admin key** is used. The runner authenticates separately as each of the four fixed `@smartsteelsales.test` users using the pinned public Supabase project API key; verifies trusted app_metadata and asserts no Owner role; invokes the normal, authenticated self-claim RPC; verifies exactly one active staff role, then signs out. On a partial failure, rerun is idempotent for exactly scoped active QA identities.

## Safety and acceptance
The workflow is manual-only, does not run on a push, has no PR-side side effects, never logs credentials/session tokens, and scopes passwords to its execution step (not dependency install). No role is inserted directly, no legal acceptance is forged, and no organization/membership or commercial data are created. Success means **four active test Platform Staff roles** and exactly one unchanged Owner, not full RQG3.2 Chrome acceptance. Two fictional company memberships and two isolated Review fixtures must still be governed and created separately.

Fail closed for wrong email, wrong persona tag, unapproved/expired invite, unexpected extra role, missing console access, wrong project or missing explicit approval.
