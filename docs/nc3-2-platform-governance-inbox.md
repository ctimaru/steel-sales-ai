# NC3.2 — Platform Bell & Governance Inbox

**Release scope:** private Platform notification UI, physically separate from Workspace NC3.1. New canonical URL `/platform/notifications` available only through existing `requirePlatformConsoleContext()`. No email, push, subscriptions or historical backfill.

## UI and behavior

- Header of Platform Console: independent responsive notification bell, last five assigned events, personal unread count capped at 99+, fail-closed '!' badge if data cannot be verified, panel closes on backdrop/Escape or navigation, links to Platform notification center and registration queue.
- `/platform/notifications`: all, unread, registrations, claims, incidents, archived; 15 items/page with server-side bounds, personal read/unread/archive/restore actions. No bulk actions.
- Friendly generic copy, avoiding applicant contact, evidence, commercial terms or infrastructure error payload.
- Source links go through `/platform/notifications/open/[id]`, carrying the **recipient ID only**, which is revalidated by server and database. Registration events redirect to /platform/registrations/{application} only if original event still matches the application, current role has `registrations.read`, and personal `registrations.review` recipient is authorized. Claims link to the existing claim queue only while requested and only with `claims.read`. Infrastructure incidents link to Platform Home only if genuine allowlisted production non-tenant error and `platform.audit.read` is still present. Missing source/revoked permission returns generic unavailable screen, never a raw source URL. Downstream pages independently check their own permissions.

## Security

- `nc32_platform_notifications_read`: authenticated-only SECURITY INVOKER, `search_path=''`, requires `platform.console.access`. Query uses existing Platform RLS plus per-row current `required_permission_key` authorization, recipient matching `auth.uid()`. Counts don't include notifications for revoked permissions or other staff.
- `nc32_platform_notification_set_state`: minimal authenticated SECURITY DEFINER because NC2.1 grants no browser DML. Checks `auth.uid()`, console access, exact personal recipient, current original event permission, limits to four state actions, `FOR UPDATE` row lock and idempotent writes. Neither permission revocation nor read/archive operations affect registration, claim or incident source state.
- `nc32_platform_notification_destination`: narrow authenticated SECURITY DEFINER, current personal recipient and permission, checks authoritative source and destination permission before returning an internal typed target. No arbitrary redirect, no source payload.
- All three RPCs revoke execute from PUBLIC/anon; two SECURITY DEFINER functions are explicitly added to HP13 audited allowlist. Platform RLS remains enabled, no new table DML grants, no Workspace table access.

## Validation

- Required CI rebuild Supabase + synthetic BEGIN/ROLLBACK test for registration reviewer, auditor, unrelated colleague sharing the same registration role, company-only user, and suspended Platform staff. Verify filters, unread read/archive/restore state, cross-account rejection, revoked permission denial, no Workspace message copy, no unauthenticated access. Frontend tests/typecheck/build and worker baseline.
- Production verify RPC grants, RLS, no synthesized events, Vercel READY and alias. Authenticated browser smoke / mobile assistive technology QA are NC5.1 if not performed.
- Next NC3.3 Freshness & Realtime; NC4 transactional email gated separately.
