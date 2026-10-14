# RQG3.2i — Production Company Pilot Acceptance

## Observed production facts (14 October 2026)

The successful RQG3.2f live Platform (12/12), RQG3.2g live unassigned Company denial (12/12), and RQG3.2h local disposable positive A/B + Viewer do NOT establish positive hosted Company acceptance.

Read-only production aggregation: 1 active Platform Owner, 2 completed organizations, 3 active company-admin memberships, 3 pending Review rows all in 1 company, 1 legal acceptance (source first_login), 0 RQG32 companies and 0 RQG32 review fixtures. Precisely 1 completed company has a current-legal admin and pending Review. Technical eligibility is NOT authorization to enter real customer accounts.

## Consent-first gate

**NO live run without out-of-band explicit pilot participation authorization.** Obtain the company's approval for any examination of its queue. Retain a non-sensitive authorization reference, operator, purpose, participants, scope and expiration in a restricted governance record. Terms accepted on login do not by themselves constitute approval to run QA.

Use a DEDICATED pilot account with independently verified email and real voluntary current legal acceptance via the normal product workflow. It needs exactly one active Company admin membership, approved through usual company governance, and no Platform access. Do not request or store ordinary customer credentials; never create fake legal acceptances, attach synthetic QA users directly to a real company, copy Review content, or create a second superadmin. The Company Review entry must already be pending and belong to the approved organization; no new production data will be seeded.

## Protected configuration (only after genuine human authorization)

GitHub repository ctimaru/steel-sales-ai → Settings → Environments → production-qa: restrict to main, require reviewers where possible, configure environment secrets (not general repository secrets):

- Existing RQG32A_AUTH_SECRET_KEY, required ONLY for the separate preflight step, ideally short-lived.
- New RQG32I_PILOT_SCOPE_JSON with keys adminEmail, adminUserId, organizationId, reviewId (number) and authorizationRef. IDs must come from authorized internal admin records, never shared in chat, PR or tickets.
- New RQG32I_PILOT_PASSWORD: the unique 20–128 character password of the CONSENTING DEDICATED pilot identity (not an ordinary company user's password).
- New RQG32I_PUBLISHABLE_KEY: active production Supabase publishable public API key.

Illustrative JSON shape, with deliberately fake placeholder IDs:

    {"adminEmail":"approved-pilot@example.com","adminUserId":"00000000-0000-4000-8000-000000000001","organizationId":"00000000-0000-4000-8000-000000000002","reviewId":12345,"authorizationRef":"PILOT-APPROVED-001"}

Then run Actions → RQG3.2i — Production Company Pilot Read-Only Acceptance, branch main, approval phrase exactly RQG32I_APPROVE_CONSENTED_PILOT_READ_ONLY. Never run without the private human consent gate.

## Automatic read-only acceptance contract

1. Admin-secret-scoped preflight verifies sole Owner, preapproved exact user and email, no Platform roles, a single active Company admin membership, completed organization, valid genuine current Terms/Privacy (2026-10-04-lr5-v1), and OWN pending Review. It NEVER downloads commercial Review source text.
2. Separate execution step without an Admin key authenticates as the actual dedicated pilot user, uses the user's own JWT to GET exactly the preapproved Review ID from PostgREST, confirms organization isolation and pending state. Authentication token request is necessary for sign-in; no Review writes.
3. Google Chrome signs into real smartsteelsales.com, renders Company Review, and is denied Platform Review/Registration/Claims/Trust URLs. Browser only allows GET/HEAD after the legitimate login POST, aborting all other non-GET requests before transmission.
4. No cookies, personal content, screenshots, trace, downloaded artifacts, migrated fixtures, business decisions, roles, legal acceptance writes, uploads or Vercel cron/build activity.

## Evidence and exit

Record only run URL, production commit, approval reference and PASS/FAIL in a restricted pilot acceptance record. No personal source data or credentials.

- **CODE READY** means PR checks passed and workflow exists. It does NOT mean hosted positive acceptance.
- **LIVE PASS** requires an explicitly approved protected workflow run to succeed after all human/legal preconditions.
- **NO-GO** if genuine pilot permission absent, legal gate stale, user lacks Company admin, another organization owns the Review, multiple Owner accounts exist, or any hosted write is requested.
- A single hosted Company pilot proves own-Review and deny-Platform only. The existing RQG3.2h disposable local suite proves A/B and Viewer boundaries, but cannot replace a two-company hosted pilot. More independent lawful participants would be required for full hosted A/B/Viewer acceptance.

This PR changes only read-only tests, manual GitHub Actions and operator documentation. Merge only after green required CI; never silently report a PR merge as a live Company pilot PASS.
