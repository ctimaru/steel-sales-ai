# NC1.3 — Notification Domain Contract v1

**Status:** approved domain contract / implementation specification only; **no router, delivery, inbox, email, DB migration, or Platform view is enabled in NC1.3**. Release of any channel requires NC2–NC5 acceptance. Canonical typed specification: `apps/web/lib/notification-domain-contract.ts`.

## 1. Security boundary (normative)

- **Workspace scope**: a notification belongs to exactly one `organization_id` and eventually to individually authorized `recipient_user_id` rows. Every delivery, read, unread count, action and deep link must recheck *active membership + actual process authorization + entitlement*; an organization-wide inbox is not a replacement for individual permissions.
- **Platform scope**: a notification is addressed to independently authorized Platform Owner/Staff through **explicit Platform permissions**, not by `organization_memberships`. A platform event may refer to a registration/claim but the notification envelope must not contain tenant private payload. There is no automatic Platform super-user access to company commercial documents.
- A Platform user who also belongs to a company may see its Workspace only under their **separate active company membership**. Never union both scopes into a single unfiltered query, bell, realtime feed or email digest. Switching UI contexts changes the authorized notification scope.
- Frontend role visibility is only UX. Enforce at SQL/RPC / service action with RLS and explicit denials; never trust `user_metadata`, user-submitted IDs, arbitrary URLs, or client-side role claims.
- `operational_alerts` is **currently tenant-scoped** and stays in the Workspace. It is not automatically a Platform notification. Platform incident events require a new sanitized service-only adapter based on qualified `observability_events`.

## 2. Source of truth & named event candidates

| Canonical event | Source (verified production table) | Priority | Recipient resolver (NC2, not active yet) | Email eligibility |
| --- | --- | --- | --- | --- |
| `workspace.rfq.response_received` | `buyer_rfq_events` | action_required | Assigned, permitted RFQ team members | actionable |
| `workspace.rfq.clarification_requested` | `buyer_rfq_events` | action_required | Assigned, permitted RFQ team members | actionable |
| `workspace.rfq.award_confirmed` | `buyer_rfq_events` | action_required | Assigned, permitted RFQ team members | actionable |
| `workspace.rfq.supplier_confirmation_received` | `buyer_rfq_events` | action_required | Assigned, permitted RFQ team members | actionable |
| `workspace.marketplace.opportunity_matched` | `marketplace_notifications` | informational | Eligible supplier users with entitlement | opt_in |
| `workspace.import.failed` | `worker_jobs` | action_required | Upload owner and authorized org admins | actionable |
| `workspace.operations.regression_detected` | `operational_alerts` | critical | Active organization admins | critical |
| `platform.registration.submitted` | `platform_registration_events` (`application_submitted`) | action_required | Registration-review staff / owner fallback | actionable |
| `platform.registration.information_provided` | `platform_registration_events` (`information_provided`) | action_required | Registration-review staff / owner fallback | actionable |
| `platform.claim.requested` | `network_company_claims` (`status=requested`) | action_required | Claim-review staff / owner fallback | actionable |
| `platform.infrastructure.critical_incident` | `observability_events` (service, `system` + classified critical failure) | critical | Incident-response staff / owner fallback | critical |

These are *candidates*, not proof that the processes already emit a compatible event. At contract audit time, `buyer_rfq_events` had no rows, `marketplace_notifications` accepts only `opportunity_match`, and `worker_jobs` contained 20 completed jobs. Do not infer runtime notification deliveries from this catalogue. Check exact RFQ event-type values and state transitions in the NC2.3 adapter before connecting them; the four RFQ kinds are semantic output names, **not presumed literal database event types**.

**Future candidates (explicitly NOT active / absent from v1):** Network follow/activity, RFQ deadlines driven by a new scheduler, platform account/security changes, buyer order lifecycle not yet represented by a verified immutable event, push PWA. Require new source, recipient mapping and privacy review before introducing each event.

## 3. Event envelope, severity and deduplication

Only the eight reference fields `contractVersion`, `eventType`, `scope`, `sourceTable`, `sourceEventId`, `sourceRevision`, `organizationId` and `occurredAt` are accepted by the pure validator. Reject unknown fields (especially `payload`, `customerName`, `email`, `subject`, `body`, `path`). Workspace requires a valid tenant UUID, Platform requires an explicit `null` tenant. Do not put source metadata, document contents, offer lines, exact prices or email addresses in the envelope.

- `informational`: no immediate action, optional digest; `action_required`: user should respond or review; `critical`: safety/continuity issue with admin escalation. Priority is not a grant to override access controls or silent hours rules.
- Immutable event-ledger rows use `sourceRevision=1`; transitions of mutable rows (e.g., `worker_jobs`, claims, `operational_alerts`) use a monotonic, domain-defined transition revision rather than `updated_at` alone. Adapters must not produce two semantic events with the same source ID and revision.
- Canonical dedupe identity: `(contractVersion,scope,organizationId,eventType,sourceTable,sourceEventId,sourceRevision)`; NC2 will index/hash and enforce UNIQUE transactionally. Reprocessing and at-least-once ingestion must not create duplicate inbox rows or duplicate emails.
- Multiple recipients share an event but each gets their own `read_at`/`archived_at` on an independently protected recipient row. Lifecycle states `unread/read/archived` are per-user; `acknowledged/resolved` are workflow states in the original source with separate role checks and audit.
- For Marketplace, `marketplace_notifications.status` is currently organization-level; the projected NC2 recipient state must **not write back** a shared `read/dismissed` status when one user reads the new inbox.
- Every selected recipient must have an active permitted role and business relationship **at dispatch time**; revoked membership/entitlement also prevents subsequent reads. Exclude actor/self where appropriate. No bulk notification to all active users without explicit policy.

## 4. Delivery channels, preference contract and privacy

- `delivery.inApp=true` means *planned primary channel*, not currently operating. `email` is **eligibility policy** (`off | opt_in | actionable | critical`); transport remains disabled pending NC4.1. `push=false` for every v1 event.
- `opt_in`: email only with affirmative per-user preference; `actionable`: eligible transactional email according to user preferences/escalation rules; `critical`: designated responders and company admins, verified addresses only, rate-limited escalation. NC4 will define legal basis and mutability of preferences separately from marketing consent.
- No full source payload in notifications or email: only generic source category, redacted one-line description, event timestamp and opaque authenticated link. Use fixed allowed destinations and server-re-resolve original entity rights before showing details. Avoid query parameters carrying email or secrets.
- Proposed policy for NC2 review (NOT enforced yet): inbox 90 days, transport attempt logs 30 days, security/governance audit retention 365 days subject to legal and customer data-governance review; document delete/retention implementation and minimization before launch.
- Email dispatch outbox is service-only; retry/backoff, unique provider idempotency key, failure telemetry and manual intervention. Email failures cannot roll back RFQ/PO processing. Never send cross-tenant batch content in a digest.

## 5. Routing, recipients and source-adapter acceptance gates

- **RFQ**: retrieve campaign and current permitted `buyer_rfq_team_members`, verify owning `organization_id`, actual assignment + role, and evidence of event type/state. Ignore unsupported event types.
- **Marketplace**: derive organization from `marketplace_notifications.recipient_organization_id`; confirm match is published/eligible and subscription/entitlement; resolve individual authorized users, not only recipient organization. No public Network disclosure.
- **Import**: resolve `worker_jobs.organization_id` and `owner_id`; only terminal `failed` (or verified equivalent) and actionable retries; don't expose raw error logs or file paths.
- **Operational alerts**: `operational_alerts.organization_id` remains Workspace; its `acknowledge/resolve` is admin-only per NC1.2. No inheritance into Platform.
- **Registration**: process exact vetted `platform_registration_events.event_type`, resolve Platform permissions for review queue, suppress submitter/unauthorized staff; no unreviewed applicant PII in Platform inbox/email preview.
- **Claim**: validate `network_company_claims` transition and reviewer permissions; avoid surfacing claim evidence or corporate verification documents to other companies.
- **Infrastructure**: allowlist monitored `observability_events` operations and classify severity server-side; only sanitized diagnostics and Platform recipient IDs. A tenant-tagged observability row never becomes a pretext for exposing private tenant metadata in Platform notifications.

**Hard-fail / dead-letter** on unknown source, missing tenant, unresolved recipients, missing entitlement, inactive membership, duplicate causal revision, malformed envelope, ambiguous source mapping, or deep link that cannot be authorized. Track suppression reasons in restricted service telemetry without leaking business content.

## 6. Next integration contracts

- **NC2.1:** segregated `workspace_notification_events/recipients` and `platform_notification_events/recipients` (exact physical schema after security/scale review), append-only causal events, per-recipient personal lifecycle, RLS/tenant and Platform capability tests. No unauthenticated RPCs.
- **NC2.2:** trusted backend adapters → strict validator → role/entitlement resolvers → service-only outbox and idempotent delivery projection. Never invoke network dispatch in a business transaction.
- **NC2.3:** staged source bridges (RFQ + imports, then marketplace; Platform registration/claims/health separate), measure missing source events before activation.
- **NC3:** independent Workspace and Platform bells (with independently calculated authorized counters), deep links and errors/freshness; never merge by design.
- **NC4:** transactional email, preference per category/channel, bounce/duplicate governance; push separately.
- **NC5:** synthetic two-tenant/role E2E with negative access tests, mobile, retry, high volume, opt-out, revoked membership, idempotent replays, privacy test, source event→inbox→deep link (plus actual email in sandbox).

## 7. Acceptance / frozen decisions

- Contract source tables are verifiable, but **source emitters, recipient resolvers, delivery channels and endpoints are not connected in NC1.3**.
- Typed catalogue contains only Workspace and Platform scoped events; a platform envelope with an organization ID or Workspace envelope without one is rejected, as are mismatched source, invalid revision, unknown event or any extra content field.
- 100% candidate notifications require server permission resolution before persistence or display. No event delivery in this release; no production schema alteration.
- Changing an event kind, recipients, privacy classification, or email policy requires a versioned contract change plus targeted regression tests.
