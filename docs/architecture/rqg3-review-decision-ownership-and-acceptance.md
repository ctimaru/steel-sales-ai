# RQG3 — Review Decision Ownership & End-to-End Acceptance

## Scope
The RQG2 Platform Review is **navigation only**. A platform read permission never grants a write permission. Each card now shows every independently authorized decision (Registration review / approve / reject / activation; Claims proof / approve / reject / revoke; Discovery review / publish / enrich / duplicate / source governance; Network Trust verification / revocation / conflict / identity; Knowledge review / publish). Each linked destination continues to guard its Server Actions and Postgres RPCs.

Company Review remains tenant-owned: \`/operations/review\` and \`/review\` require active membership \`admin\` in the current organization, with RQG1 RLS and RPC checks before each write. The platform owner and staff have no implicit company access. When data has not been assigned to the company, neither confirm nor correct is offered.

## Evidence
- GitHub PR #540 (RQG1) and #541 (RQG2), both merged before RQG3.
- Read-only production schema inspection, 2026-10-13: public \`m4_review_company_claim\` and \`m5_review_identity_candidate\` delegate to private security-definer implementations; both explicitly invoke the decision's \`private.require_platform_permission\`, validate row status under \`FOR UPDATE\` and write audit/reviewer metadata. \`p3_6_review_claim_proof\` and \`p3_review_company_discovery\` also independently require granular permissions; publish requires extra permission.
- Automated regression covers UI capability derivation, read-only auditor, forged Server Action grants and positive domain RPC dispatch. RQG1 and RQG2 tests remain in scope.

## Acceptance commands
From \`apps/web\`: run \`node --experimental-vm-modules --test tests/rqg1-review-access-hardening.test.mjs tests/rqg2-platform-company-review-separation.test.mjs tests/rqg3-review-decision-ownership.test.mjs tests/review-confirm.test.mjs\`, TypeScript, and required CI checks. **Merge only after green CI.**

## Live E2E (not claimed by source-only tests)
With controlled accounts and **dedicated synthetic records**, verify browser/direct URL/Server Action/PostgREST RPC:
1. Platform Owner — only platform governance and explicit tenant admin access (no blanket cross-tenant read).
2. Delegated Registration Admin — can review, approve and activate, but not decide unrelated Knowledge/Claims.
3. Claims/Trust delegate — only specifically delegated decisions; deny permission-switching by crafted form values.
4. Platform Auditor — read queues, no writes.
5. Company admin A — confirm/correct only org A rows; admin B cannot mutate org A.
6. Company member/viewer and anonymous — no Company Review reads/writes.
7. Repeated decision, invalid status and stale item — no second write, preserved audit actor/time.

Preserve the existing three review cases. Do not mutate real production records. Until a controlled multi-account browser and RPC acceptance has been performed, classify **live E2E pending** rather than green. No new migration, cron, query or Vercel background consumption.
