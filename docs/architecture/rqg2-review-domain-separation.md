# RQG2 — Platform Review vs Company Review

## Ownership and authority

| Surface | Owner | Read authority | Decision authority | Data |
| --- | --- | --- | --- | --- |
| `/platform/review` | Smart Steel Sales Platform | Authenticated Platform Staff/Owner with `platform.console.access`, filtered per domain read permission | Explicit domain permission enforced again by destination action and PostgreSQL RPC | Governed platform registration, claim, discovery, Network Trust and Knowledge queues |
| `/operations/review` (and legacy `/review`) | Current tenant organization | Active organization `admin` only (RQG1) | Same organization `admin`, independently enforced at Server Action and RPC/RLS level (RQG1) | Private `commercial_review_queue`, corrections and extraction evidence |
| Customer dashboard | Current tenant | Role-specific commercial entitlements | RFQ/procurement/offer/order domain rules | Actionable business next steps; never raw parser review urgency |

## Invariants

- Platform identity does not imply a role in a customer tenant; no global read of tenant technical evidence.
- Tenant admin does not imply any Platform Staff role. Even the Platform Owner has no automatic cross-tenant data access.
- The Platform hub is navigation only: **no new aggregate, query, view, RPC, materialized dataset or cron job**. It shows no invented counters.
- Underlying queues and authorizations are unchanged. No data migration; RQG1's row-level tenant protections and audited confirmation remain mandatory.
- All decisions remain inside their source-owned domain workflows with explicit permission checks. Reading a card is not an authorization to decide.
- The Company Review menu is only visible to tenant administrators. Legacy URLs and deep links remain functional behind their original RQG1 guards.
- Production acceptance: positive tests for owner and authorized staff; negative tests for members/viewers, unprivileged staff and tenant admins without Platform permissions; verify direct URL, Server Action and RPC deny paths.

## Non-goal

This microblock does not transfer private company evidence to a global platform queue, reclassify tenant review events, or grant staff break-glass tenant access.
