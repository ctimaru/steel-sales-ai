# FLOW1 hosted acceptance with existing QA identities

This complements the complete disposable Search → bill → RFQ → supplier response
journey in PR #933. Its scope is the remaining deployed browser → Next server
action → staging Worker → staging Supabase boundary, plus private bill/RFQ
persistence and tenant denial. It sends no supplier invitations.

## Reviewed deployment and targets

- App revision: `584cdf9ac16d9e1b911a80110f6c478193741952`.
- Vercel preview: `dpl_6LQEzvGc3x9dD9MdPBStAQCkjS9g`, observed READY.
- Only allowed browser origin: `https://steel-sales-ik587c5yr-ctimaru-5113.vercel.app`.
- QA branch: `qa/sec-p0-close1d16c-isolated-vercel-staging`.
- Supabase staging: `lwrrrphakpbjhbzljqhn`.
- Worker staging: `https://steel-sales-worker-staging-staging.up.railway.app`.

The QA branch has its own preview Supabase URL/public key, Worker URL and sensitive
Worker token. A branch-only empty `RESEND_API_KEY` was set before this deployment.
Production configuration is outside this workflow. A similar-looking Vercel URL
is insufficient: the workflow and session helper require the exact reviewed URL.

## Existing identities and session handling

Only the two previously user-created `sr2b-admin-a` and `sr2b-admin-b` staging
accounts at `smartsteelsales.test` are allowed, with their exact existing UUIDs.
Preflight checks confirmation, existing current legal acceptance, no memberships,
zero active embedding models, and an unused fixture namespace. Missing consent
is a failed prerequisite; the workflow does not insert or simulate it.

The CI step uses the existing staging admin credential to generate a magic link
for each verified existing QA identity, then obtains a normal GoTrue session with
`verifyOtp`. No email is delivered. It verifies the returned identity, signed
claims, live `getUser`, legal-state RPC and MFA assurance before browser use.
An unexpected/missing account or verified MFA factor stops the test. The admin
credential never enters the browser; the SSR SDK serializes real user-session
cookies, scoped to the exact preview host and kept in memory.

Authentication creates session/audit records and updates sign-in metadata. The
workflow preserves accounts, passwords, profiles and existing legal evidence;
it is not a claim of zero Auth writes. Logout uses `scope: local` in `finally`.
An access JWT may remain valid until its normal expiry despite session logout.

## Application fixtures and browser checks

One serialized workflow run creates two reserved staging organizations and
memberships, plus one synthetic structured source per organization. No RFQ is
pre-created. The browser uses both identities at 1440 and 390 px to verify:

1. Actual unfiltered Next server-action responses succeed with `model: null`,
   include the authorized source and omit the other tenant's source.
2. A product's verified 60.3 × 3.2 mm geometry reaches the existing calculator.
3. Buyer A creates one private RFQ per viewport through the actual UI: two lines,
   EN 10219 / 3 × 6 m and EN 10210 / 2 × 12 m, grade S355J2H, total 42 m.
4. Saved snapshots retain identities, quantities, dimensions and standards;
   reload creates no duplicates, and B cannot read A's bill, lines or RFQ.
5. There are no supplier targets, invitations, dispatches, quotes, deliveries or
   Marketplace publication in this hosted acceptance.

Browser POSTs are restricted to the two required Next action routes. The preview
protection credential is attached only to that exact origin. Other network
destinations are blocked except staging Auth GETs needed for session validation.

## Execution and cleanup

The manual workflow `product-flow1-hosted-acceptance.yml` runs only on main. It
uses the existing staging database target guard and QA concurrency group.
`preflight` is read-only. `accept` additionally requires its explicit existing-QA
scope input and available CI credentials before creating fixtures.

The seed is atomic. Cleanup runs after a successful seed even if browser checks
fail; it checks exact organization/owner/namespace identities and refuses sent or
unexpected procurement records. It deletes only these application fixtures and
verifies the original Auth/legal record counts and empty namespace. Accounts and
legal evidence remain. Raw logs, cookies, tokens, traces and storage-state files
are not published as artifacts.

Preparation and guard tests are not evidence of hosted success. Record the actual
manual run, browser checks, SQL assertions and cleanup result in #921/#927 and
the Notion project record before closing the hosted gate.
