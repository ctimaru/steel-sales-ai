# NC2.1 — Segregated Inbox Schema, Security and Cutover Contract

**Status:** schema foundation only; no producer, router, source bridge, email, push, Realtime channel or user-facing notification actions enabled in this release.

## Physical domain isolation

| Domain | Event table | Per-user recipient table | Authorization |
| --- | --- | --- | --- |
| Workspace | `public.workspace_notification_events` | `public.workspace_notification_recipients` | Recipient's exact `auth.uid()` **AND active** `organization_memberships` for that event organization |
| Platform | `public.platform_notification_events` | `public.platform_notification_recipients` | Recipient's exact `auth.uid()` **AND current** `public.has_platform_permission(required_permission_key)` |

Tables, row policies, indexes and recipient states are **physically separate**; there is no union inbox, shared filter bypass, or implicit Platform-to-tenant access. Source systems (`buyer_rfq_events`, `marketplace_notifications`, `worker_jobs`, `operational_alerts`, `platform_registration_events`, `network_company_claims`, `observability_events`) are unchanged.

## Database integrity and deduplication

- Events store **reference metadata only**: contract version, canonical event type, approved source table, source event id, revision, priority and occurrence time. **No customer names, email addresses, PDF contents, prices, raw payload, OAuth tokens, commercial information, nor free-form URLs.**
- Workspace event rows additionally require exactly one tenant `organization_id`. Composite `(event_id,organization_id)` FK from recipients prevents even a service-side bug associating a Workspace recipient with the wrong tenant.
- Platform events have **no tenant ID column at all**. Each event type has a fixed `required_permission_key`: registration → `registrations.review`, claims → `claims.read`, incident → `platform.audit.read`; the composite `(event_id,required_permission_key)` FK prevents altering the permission via a recipient insert.
- Idempotence: UNIQUE `(organization_id,event_type,source_table,source_event_id,source_revision)` in Workspace; UNIQUE `(event_type,source_table,source_event_id,source_revision)` in Platform. Duplicate recipients forbidden by UNIQUE `(event_id,recipient_user_id)` in either domain. A distinct source revision is allowed for a subsequent business transition.
- Personal inbox status is derived: `read_at IS NULL AND archived_at IS NULL` = unread; `read_at IS NOT NULL AND archived_at IS NULL` = read; `archived_at IS NOT NULL` = archived. An archive requires a prior read. Each user has independent status. These rows **do not change** the original `marketplace_notifications.status`, offer/PO state or `operational_alerts.status`.
- Time-descending indexes for tenant/user lists and partial unread indexes. Counts filtered per-user; avoid full-table count or cross-domain joins when building bells.

## Grants, RLS and runtime revocation

- All four public tables have RLS enabled, **no anon grants**. `authenticated` has **SELECT only**, with policies checking the current DB identity + organization active membership or live Platform permission for both the event and recipient reads. `service_role` alone has write rights for NC2 router.
- The event policy requires a matching visible recipient; an active tenant member cannot enumerate all notifications from colleagues. Suspended members or Platform staff lose event and recipient visibility immediately on subsequent queries. Both domains reject browsing from users authorized only in the other domain.
- Direct `INSERT`, `UPDATE`, `DELETE` from the browser are refused at SQL privilege level. In NC2.2/NC3 any read/archive mutation will be a restricted, audited, user-scoped function or server action, not a direct table update.
- Current SELECT policies enforce **inbox-level** entitlement (recipient identity + tenant/Platform capability). Source-level entitlement, RFQ assignment and Marketplace unlock MUST be rechecked by NC2.2's trusted recipient resolver and by NC3 deep links before reading protected original content. A reference-only inbox event NEVER implies source-object access.
- Events/recipients are not added to Realtime publication by this migration. NC3.3 must test authorization for every websocket subscription and fallback to polling on errors.
- Runtime delivery starts empty. No synthetic production notifications. Rollout and privacy/retention schedules belong to NC2.2/NC4.2/NC5 acceptance, not automatic delete jobs in NC2.1.

## CI acceptance

`supabase/tests/nc21_segregated_notification_inbox_schema.sql` runs in a **rollback-only transaction**. Cases: four RLS-enabled tables; browser write denial; no anonymous reads; tenant A vs tenant B, admin vs member, assigned vs unassigned, suspended membership, Platform-only staff, Platform capability revocation, event permission/FK mismatch, cross-tenant insert mismatch, uniqueness and revision replay, read-before-archive invariant. Executed in Required Gate after schema migration on a rebuilt local DB; no customer data used.

## NEXT

**NC2.2 — Router, Idempotency & Outbox**: trusted producer event → `validateNotificationCandidate` (NC1.3) → origin validation → target permission/entitlement resolver → correct physical domain event → personal recipient rows (atomic dedupe) → service-only outbox for delivery. UI and permission-safe read/archive endpoints under NC3.1/NC3.2; no global notification stream.
