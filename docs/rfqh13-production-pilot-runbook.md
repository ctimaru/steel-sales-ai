# RFQH13 — Production Pilot Runbook

## Purpose

This runbook closes the technical production-hardening layer of the multi-supplier RFQ Hub and defines the evidence required for a real-company pilot. It does not turn pilot readiness into a claim that an external customer pilot has already happened.

## Roles and approval model

- The RFQ owner remains the executor of launch, final award and Purchase Order issuance.
- An active organization admin can manage the RFQ team and is an implicit approver.
- A per-RFQ collaborator can read the governed RFQ, inspect procurement data, prepare approval requests and perform safe stale-dispatch recovery.
- A per-RFQ approver can review and decide approval requests created by another user.
- A requester cannot approve or reject the same request.
- Award and PO approvals are optional organization policies. When enabled, the approval is bound to a SHA-256 fingerprint of the exact commercial payload. Any changed allocation, reason, PO term, buyer message or confirmation deadline requires a new approval.

## Production health and recovery

1. Open the RFQ and inspect **RFQH13 · Production Hardening & Pilot Acceptance**.
2. Resolve any stale dispatch shown as queued/sending for more than 15 minutes without provider evidence.
3. Use **Marca failed per retry** only for those dispatches. The recovery is audit logged.
4. The RFQ owner then uses the existing governed RFQH3 retry. Never resend an item that already has provider evidence.
5. Investigate bounce/complaint and suppression indicators before adding or changing supplier addresses.
6. Investigate PO delivery failures before attempting a new PO version.

## Approval pilot

### Award

1. An organization admin enables **Approva award prima della conferma**.
2. The owner prepares a fully covered award and presses confirm.
3. RFQH13 creates a pending approval and does not confirm the award.
4. A different approver/admin approves the pending request.
5. The owner retries the exact same award.
6. The core RFQH7 transaction verifies the fingerprint, executes the award and consumes the approval atomically.
7. Change one allocation or the reason and verify that a new approval is required.

### Purchase Order

1. Enable **Approva PO prima dell'emissione**.
2. The owner prepares PO terms, message and confirmation deadline.
3. First issue attempt creates a pending approval and does not issue a PO version.
4. A different approver/admin approves it.
5. The owner repeats the exact emission payload.
6. RFQH9 creates the immutable version and RFQH13 consumes the approval.
7. Change a PO term, message or deadline and verify that the old approval is not reusable.

## E2E pilot evidence

A real RFQ pilot is accepted only when all of these are evidenced on the same governed flow:

- buyer RFQ has at least one supplier target;
- governed dispatch completed with no unresolved stale dispatch;
- at least one structured supplier quote was submitted;
- quote comparison is available;
- any required negotiation/revision was recorded;
- award was confirmed, including approval evidence when the policy is enabled;
- Purchase Order was issued, including approval evidence when enabled;
- supplier confirmed the Purchase Order;
- audit JSON export was downloaded and can reconstruct the decision chain;
- no unresolved bounce/complaint, PO delivery failure or expired approval blocks the case.

## Mobile acceptance

Validate at 390×844 and 430×932 viewports:

- RFQ header and RFQH13 panel fit without horizontal page scrolling;
- team and approval cards remain readable;
- all action controls have usable touch targets;
- quote comparison tables may scroll inside their own container without pushing the page width;
- award allocation editing is usable;
- PO issue controls and supplier-version history are usable;
- audit export link is reachable.

## Retention and privacy

RFQH13 records organization retention preferences and exports a sanitized audit trail. The current implementation intentionally does **not** auto-delete commercial records. Deletion/retention enforcement needs a separate legally reviewed lifecycle policy, so an admin changing the number of days cannot silently destroy procurement history.

The audit export excludes capability token hashes, idempotency keys, provider message IDs, raw provider payloads and common email metadata keys from RFQ event metadata.

## Backup and recovery verification

Before a real external pilot:

- verify the current Supabase database backup/PITR configuration in the project;
- document the restore procedure and accountable operator;
- separately verify recovery for files in Supabase Storage, including quote attachments;
- do not assume that database backup configuration alone proves object-storage recovery.

## Pilot evidence record

For each selected company record:

- organization;
- RFQ id;
- number of suppliers invited;
- number of structured quotes;
- first-quote elapsed time;
- award time;
- award approval id if applicable;
- PO approval id if applicable;
- supplier PO confirmation timestamp;
- audit-export timestamp;
- mobile acceptance result;
- blocker/incident summary;
- final outcome: accepted / accepted with follow-up / failed.

A technical smoke or synthetic database test must be labelled as such and is not a substitute for a real external-company pilot.
