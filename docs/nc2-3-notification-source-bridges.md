# NC2.3 — Verified Source Bridges & Controlled Automation

**Status:** source adapters + private capture queue + optional in-app projection; **no SMTP, email, push or public notification UI.** This microblock does not backfill historical source events, and no customer source payloads are copied.

## Supported event→source mappings

| Notification type | Verified source condition | Recipient policy | Capture |
| --- | --- | --- | --- |
| `workspace.rfq.response_received` | `buyer_rfq_events.event_type='quote_submitted'` + campaign tenant and owner match | active RFQ owner and active campaign team members with active org membership | append-only RFQ event insertion |
| `workspace.rfq.award_confirmed` | `buyer_rfq_events.event_type='rfq_award_confirmed'` + matching campaign | same owner/team, no cross-company recipient | RFQ event insertion |
| `workspace.import.failed` | `worker_jobs.status='failed'`, `completed_at`, tenant & revision=`attempt_number` | active owner + org admins | insert/change to terminal failure |
| `workspace.operations.regression_detected` | critical, open, tenant-scoped `operational_alerts`, revision=`occurrence_count` | active organization admins | insert/reopen/critical occurrence increase |
| `workspace.marketplace.opportunity_matched` | active match, verified recipient org, matching `marketplace_unlocks` entitlement | active company admin/member with entitlement | match notification creation + unlock wake-up |
| `platform.registration.submitted` | `platform_registration_events.event_type='application_submitted'` | Platform role with current `registrations.review` capability | immutable event insertion |
| `platform.registration.information_provided` | `platform_registration_events.event_type='information_provided'` | Platform reviewer with current permission | immutable event insertion |
| `platform.claim.requested` | claim remains requested | Platform current `claims.read` capability | claim insertion / transition to requested |
| `platform.infrastructure.critical_incident` | service-side `observability_events` event type system, production error, organization_id/owner_id NULL, explicitly allowlisted operations | Platform `platform.audit.read` capability | insertion |

**Deliberately excluded:** `workspace.rfq.clarification_requested` and `workspace.rfq.supplier_confirmation_received`. Unlike `quote_submitted` and `rfq_award_confirmed`, verified source event labels were not confirmed for these two semantic types; the existing router still raises a source-not-supported error. Unknown RFQ events (e.g. `campaign_created`, delivery webhook updates) remain suppressed. No fictional semantic inference.

## Architecture and failure handling

1. Private security-definer triggers on eight existing source tables capture only `event_type`, canonical source ID, revision and optional organization UUID into `notification_source_bridge_queue`. Every trigger selects its type based on the **new source row**, never a client-provided event label. Queue UNIQUE NULLS NOT DISTINCT prevents duplicates for both Workspace and Platform (nullable tenant).
2. Source transactions **do not call the router**, send notifications or depend on Platform staff being available. Non-critical queue capture faults are logged as sanitized SQLSTATE and never interrupt RFQ, Marketplace, import or claim writes. This protects commercial write availability, but rare capture faults may require explicit source reconciliation; capture health must be audited before launch.
3. A service-only processor `nc23_process_source_bridge_batch(50)` selects due queue references with `FOR UPDATE SKIP LOCKED`, reruns the trusted `nc22_route_notification` source validation and active recipient selection, then records projection ID. Replays are idempotent across source queue UNIQUE and existing event/recipient/outbox UNIQUE constraints.
4. Failed sources remain in `retry` with exponential backoff and sanitized SQLSTATE; after up to 12 attempts or permanent invalid/unsupported references, items enter restricted `dead` state for operator review. No raw email addresses, offer prices or source details are stored in the queue. Ineligibility or revocation at projection time is a denial; it must not cause cross-tenant fallback.
5. The five-minute PostgreSQL cron job runs in a transaction with `SET LOCAL ROLE service_role`, without any HTTP, pg_net, Vault secret or client-facing API. Postgres service-role switching was verified via rollback-only role query before scheduling. The queue processor rejects direct anonymous/authenticated calls and the queue/outboxes have no browser privileges.
6. `workspace_notification_outbox.status='delivered'` means only that a reference was committed into the protected in-app inbox. **It does not mean an email or realtime push was delivered.** All email and push channels remain disabled.
7. No unapproved backfill: production source rows predating bridge rollout are not automatically replayed. Review historical projections and privacy implications separately in the pilot; no retrospective customer notification storm.

## Specific Marketplace behavior

A notification may exist before the matching request is unlocked. It enters the private capture queue but fails entitlement verification and is retried without exposing data. When `marketplace_unlocks` is inserted, a separate trigger reactivates the exact matching pending queue references. It never changes a previously projected inbox state. No organization gets a preview of unentitled Marketplace data from this bridge.

## Acceptance and rollout controls

- Required CI: rebuild local Supabase, run transaction-scoped `supabase/tests/nc23_source_bridges.sql` with **two companies**, active and unassigned members, Platform registration reviewer/auditor, real synthetic source inserts, quote/award mapping, status validation, queue idempotency, service-only processor, in-app projection count and email=0. Transaction ends with `ROLLBACK`.
- Production audit: verify that all 8 source triggers exist, cron job is active, queue/RLS/EXECUTE rights are correct, and the six new notification/recipient/outbox tables are not populated by fixtures. Inspect queue only by counts and SQLSTATE classes, never business payload.
- Next **NC3.1/NC3.2**: separate bells and authenticated inbox screens; source deep links independently re-check relevant RFQ campaign assignment and Marketplace entitlement.
- **NC4.1**: transactional email transport only after preference/privacy/rate-limit gates, never via these capture triggers. **NC5.1**: real authenticated browser security and pilot latency checks.
