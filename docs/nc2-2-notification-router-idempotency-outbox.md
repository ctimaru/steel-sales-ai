# NC2.2 — Governed Notification Router, Atomic Idempotency & Outbox

**Runtime state**: backend callable contract only; **source bridges / triggers not enabled until NC2.3**; no scheduled cron, push, email or external transport. All writes require the restricted service-role function `public.nc22_route_notification` and transactional source validation. Frontend has **zero** execute rights.

## Safety-first routing contract

`nc22_route_notification(event_type, source_event_id, source_revision, organization_id)` takes only the eight-field NC1.3 semantic reference subset. The caller **cannot** name recipients, claim user permissions, submit message bodies or links, set severity or source table, or send email. The service-only PL/pgSQL function rejects requests from `anon`, `authenticated` and all roles other than `service_role`. It uses `SECURITY INVOKER`, `search_path=''`, revoked PUBLIC execution, qualified table names and immutable source ID rules. Only the server that stores the service key may call it. Never expose service credentials to browser/Next public environment.

Every candidate must exist in the authoritative source **at the expected organization, lifecycle and revision**:
- **Workspace operational regression**: `operational_alerts` ID / matching tenant, critical + open; revision = `occurrence_count`; authorized recipients = active company admins only.
- **Workspace failed import**: `worker_jobs` ID, matching tenant, failed + completed_at, revision = `attempt_number`; recipients = active company admins + active uploader/owner.
- **Workspace Marketplace match**: `marketplace_notifications` linked to active `marketplace_matches` for the same supplier org and request, matching recipient org; `marketplace_unlocks` must prove entitlement. Recipients = active company admins/members; no public network user or unentitled supplier.
- **Platform registration**: immutable `platform_registration_events` with approved `application_submitted` / `information_provided` event types. Recipient permission `registrations.review`.
- **Platform claim**: `network_company_claims` still `requested`, revision=1; recipient permission `claims.read`. Future state-transition evidence belongs to NC2.3.
- **Platform critical incident**: `observability_events` of kind `system`, status `error`, environment `production`, no tenant or owner, operation in an explicit critical allowlist. Recipient permission `platform.audit.read`. No tenant payload is copied.
- **RFQ four semantic candidates** are **explicitly rejected** pending vetted source-to-event mapping in NC2.3. These are not silently routed by matching unknown `buyer_rfq_events.event_type`.

Workspace recipient selection checks active membership and business relationship; Platform recipients derive active `platform_superadmin` plus `platform_staff` with active role and exactly required current `platform_role_permissions`. No Platform right grants tenant notifications. No source details or private payload enter the inbox.

## Atomic identity & outbox

In a **single database transaction**, the router:
1. Validates scope, canonical source ID, source state/tenant/revision, and at least one authorized recipient; fail closed on missing/unsupported source.
2. Inserts an NC2.1 event with `ON CONFLICT DO NOTHING` against the database UNIQUE dedupe identity; an identical replay returns `created:false` without extra recipients/outbox records.
3. Inserts individual recipient rows with UNIQUE per event/user.
4. Inserts **only** `channel='in_app', status='delivered'` rows into the corresponding private `workspace_notification_outbox` or `platform_notification_outbox`, referenced by recipient ID. These records represent committed in-app projection, not WebSocket delivery or that a user has read the inbox.
5. Returns `event_id`, `scope`, `recipient_count`, `created`, `email_dispatched:false`.

All inserts roll back together on any error. Missing recipients are errors, not an empty healthy inbox. Unique keys protect at-least-once caller replays. Both outbox tables have RLS on, no browser/anon access, service-only grants, per-recipient/channel uniqueness and bounded attempt/next retry fields. No external HTTP or pg_net calls. **No `channel='email'` rows are enqueued** until the NC4 transport, preference, privacy and consent review, and the present schema constrains any email row to `status='held'`; new migrations will be needed for a sender. There is no background sender, retry runner or digest, and this release must not claim email delivery. `status='delivered'` in the in-app outbox means committed to the private inbox, **not a delivered user notification**.

No direct writes on `marketplace_notifications.status`, `operational_alerts.status`, RFQ or other source tables. Personal `read_at` / `archived_at` on recipients stay untouched pending NC3 per-user endpoint.

## Operational rollout & acceptance

- CI: `supabase/tests/nc22_notification_router_idempotency_outbox.sql` runs **BEGIN…ROLLBACK** on a fresh database and exercises two tenants, company admin/member/foreign user, Platform Registration staff and Auditor, source validation, replay, wrong org, revision mismatch, rejected RFQ adapter, split inbox, private outbox and **zero email**.
- Required GitHub gate runs frontend/typecheck/build, worker and SQL rebuild. Production migration applies **after passing gate and merging**; smoke verifies function execution permissions, no production source events/recipients created, separate outboxes/RLS, and unchanged company memory.
- The function and outbox are intentionally **dormant** until NC2.3 adapters are explicitly enabled and acceptance checked. Any use from a new worker source bridge must log safe delivery metrics and honor the per-source suppression reasons.
- **NC2.3 next**: domain bridges, strict event mapping and replay, privacy-safe integration with existing RFQ, Marketplace, job worker and Platform events. **NC3**: user read/archive and unread counters with current entitlements and real-time freshness. **NC4**: email/Preferences/Retry/Dead-letter dispatcher.
