# RQG3.2f — Production Platform-Only Chrome Acceptance

## Scope and legal boundary
Production has exactly one Platform Owner and four Owner-approved delegated QA staff roles, each held by a separate tagged synthetic Auth identity. The three remaining Company QA users have no company workspace and no personal legal acceptance. The Workspace guard `getWorkspaceContext()` redirects accounts with missing current legal acceptance to `/legal/accept`. Do **not** manufacture acceptance on their behalf, grant real company registration, or bypass production legal checks. Thus this microblock verifies **only the four Platform Review roles** in live Chrome, not full Company Review acceptance.

## Manual execution
From GitHub Actions select `RQG3.2f — Production Platform Review Chrome Acceptance`, branch `main`, and submit exactly `RQG32F_APPROVE_PLATFORM_READ_ONLY`. GitHub's `production-qa` environment must be protected. Four existing QA passwords are injected only into the Chrome test step, not dependency installation. There is no Admin secret, new Vercel build, migration or cron.

The script logs into the production app as registration, claims, trust and auditor test identities using isolated Chrome contexts, checks exact visible Platform Review lanes and denied neighboring lanes, and checks that each is denied Company Review. Auditor must have five **read-only** lanes. All requests beyond GET/HEAD and authentication POST are aborted; no Review decisions, business data writes, artifacts, cookies, traces or screenshots are retained.

## Acceptance
- [x] Seven QA Auth identities and one Owner verified.
- [x] Four precisely scoped Platform Staff roles claimed through audited owner invitations.
- [ ] RQG3.2f authenticated production Platform Review Chrome workflow green.
- [ ] Two synthetic tenant workspaces and test-only Company Review evidence, without fabricated legal acceptance.
- [ ] Complete seven-persona RQG3.2 authenticated Chrome acceptance.

Do not equate Platform-only success with full tenant/Company Review acceptance.
