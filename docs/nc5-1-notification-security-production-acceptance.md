# NC5.1 — Notification Security & Production Acceptance

**Scope:** Workspaces and the Platform notification center, including source bridge, RLS, read/archive, deep links, Realtime and production deployment.

**Acceptance policy:** *Do not call a production browser pilot fully accepted until a true authenticated multi-user browser test is completed.* CI and SQL simulation are strong evidence, but are **not** a replacement for authenticated browser, actual websocket traffic, mobile accessibility or realistic load.

## Acceptance matrix (update with evidence)

| ID | Required proof | Current method | Gate |
| --- | --- | --- | --- |
| A1 | Source event → private reference queue → service processor → correct tenant inbox, idempotent | `nc23_source_bridges.sql` synthetic source rows, `ROLLBACK` | Automated CI |
| A2 | Independent user/tenant inbox and no cross-company reads/writes | `nc31_workspace_notification_center.sql`, `nc51_notification_security_acceptance.sql` | Automated CI |
| A3 | Platform registration reviewer/auditor, separate inbox from Workspace, no role spillover | `nc32_platform_governance_inbox.sql`, `nc51_notification_security_acceptance.sql` | Automated CI |
| A4 | Effective membership/permission revocation immediately blocks RPC access | NC3.1/NC3.2/NC5.1 rollback SQL tests | Automated CI |
| A5 | No browser service-role write, outbox/queue SELECT or anonymous RPC | Production read-only grant and RLS inspection; `nc51` | Automated & live |
| A6 | Realtime only recipient invalidation; no source, event payload, or outbox publication | NC3.3 SQL and production `pg_publication_tables` check | Automated & live |
| A7 | No external email/push; no synthetic production traffic | Production count inspection and outbox channel/status; static controls | Live |
| A8 | Cron capture delivery & recovery | `cron.job` active with most recent job result; retry/dead-letter counts | Live |
| A9 | Exact deployed commit and alias | Vercel production READY + `www.smartsteelsales.com` alias | Live |
| A10 | Real browser: owner, tenant A/B, colleague, Platform reviewer, auditor, signed-out | Protected Opera/browser session with five scoped pilot identities, no sensitive recordings | **Required; not proven by SQL** |
| A11 | Two sessions, websocket insertion/update, 90s fallback, hidden tab, offline/reconnect and revocation | Real browser network trace, create non-sensitive controlled pilot event in isolated staging | **Required; not proven by static tests** |
| A12 | Desktop + iOS/Android viewport: bell close outside, Escape/focus, touch and screen-reader | Browser+AT + screenshot evidence (redact personal info) | **Required** |
| A13 | Realistic concurrency and poll/WS/RLS load, database throughput budget | k6/Artillery staging load with representative tenancy, no production customer sources | **Required** |
| A14 | Runtime errors/latency after authenticated navigation | Authorized Vercel runtime logs, Supabase observability and SLO metrics | **Required** |

## What was and was not accessible during this execution

- Production database read-only SQL and GitHub CI can be audited without test-user credentials.
- The Opera Browser Connector was **not connected** (reported Browser not connected), so authenticated browser interaction was not accessible here.
- Vercel protected deployment fetch responded **403 forbidden** from the deployment-bypass API, despite authenticated deployment *metadata* showing a READY release.
- Current Vercel runtime errors query also returned 403; a READY deployment must **not** be interpreted as proof of zero runtime exceptions.
- Anonymous external HTTP from the code container was unable to resolve the domain. It does not prove the public domain is down; only that this environment could not test it.
- No unauthorized use of a production customer account, no fabricated browser screenshots, no live test RFQs or mock registration submissions in production.

## Pilot browser script (not completed until evidence is attached)

1. Use staging or controlled pilot identities (Company A admin/member, Company B admin; Platform registration reviewer and auditor), each with their own active session. Keep owner privileges reserved to actual owner.
2. Sign in Company A. Confirm the Workspace bell shows only A-assigned notifications. Mark one read/unread, archive/restore, reload. Deep link RFQ and Marketplace with actual assignment/unlock. Verify direct URL access to Company B IDs fails; check all visible text.
3. Sign in B separately. Confirm A notifications/IDs never appear, including via browser network inspector or direct recipient route.
4. Sign in Platform reviewer and auditor separately. Confirm neither inherits company access or each other's receipts; revoke staff permission in authorized administrative flow and verify immediate RPC denial, including existing open pages.
5. Use two tabs of the same active user. Produce one governed non-sensitive staging source transition; measure source→queue→inbox delay versus NC2.3 cron, then inbox→bell latency via Realtime, throttled network fallback 90s, reconnection and hidden-tab cleanup. Repeat with role revoked during the connection.
6. Re-run with mobile emulation and screen reader. Verify dialog focus containment/return, tap-off close and unread badge; no alert details leaked to browser before authorized refetch.
7. Store only redactable pass/fail evidence and timings in Notion. Add a concurrency test of RPC reads and Realtime subscriptions at staged 50/500/5,000 concurrent clients before extrapolating to 100k MAU.

## Preliminary verdict rules

- **Technical database acceptance:** green only when mandatory CI, production RLS/grant/pub/cron inspections all pass.
- **Production UI deployment acceptance:** green only with exact matching Vercel READY + alias (this is not a UX review).
- **Authenticated browser + mobile + actual WS + performance acceptance:** **BLOCKED/NOT TESTED**, never marked PASS without actual traces.
- **Overall NC5.1 launch gate:** **CONDITIONAL / NO-GO for customer pilot** until A10–A14 are proven; NC4.1 outbound email activation remains a separate authorization/privacy/delivery gate.
