# NET-PRO-PRODUCERS1.B3.C.1 — Controlled producer catalogue queue

## Outcome
B3.C.1 connects the existing B3.A verified CSV rows and B3.B pending PDF candidates to an independently licensed, private, persistent producer catalogue queue.

A service-only issuer must have registered an actual B2 grant for a canonical, published Italian producer with current verified rights. A link_only catalogue URL, a file upload, a user's metadata flag or a domain match are NEVER grants.

## Storage and provenance
Private Storage bucket: producer-authorized-catalogs. No anon/authenticated upload or read policy is introduced. A trusted server-side issuer uploads immutable objects to a strict path containing the company UUID, catalogue UUID and 64-character file digest. The worker rehashes downloaded bytes before any parser is invoked; no URL fetching of external PDF content occurs.

Limits: 8 MiB PDF / 2 MiB CSV, at most three leased jobs per batch, no more than two jobs per normal AUTO1 cron run. PDF extraction uses the existing bounded pypdf subprocess and produces ONLY pending_verification; CSV uses existing B3.A source-row verification. Nothing produces manufacturing claims, stock, price, SKU or outbound RFQs.

## Queue invariants
Service-role-only RPC: enqueue, claim, complete, fail, stats. Private RLS deny-all for job/event tables, append-only event ledger, 10-minute lease, bounded retries, claim concurrency via FOR UPDATE SKIP LOCKED. Revocation of the B2 grant immediately blocks pending/leased work. Expired grants cannot be claimed, enqueued or completed. Object bytes and document content are never returned through RPC.

## Activation
The existing Railway AUTO1 worker has an opt-in feature flag NETPRODUCERS_B3C_QUEUE_ENABLED=1. It is OFF unless explicitly configured. No second cron job is created. A separate service-role CLI can drain the queue for a controlled canary using python -m app.net_pro_producers_catalog_b3c_queue --persist --limit 1.

Release requires P0 gate on the final HEAD, protected merge, one-time Supabase migration, live permissions/trigger readback and a zero-eligible canary before any real producer document.

## What remains
C.2 verified company onboarding and responsive one-page PDF/CSV upload, proof of rights with producer representative identity, independent grant issuer and authenticated private object staging.

C.3 independent source-line PDF proof and exact tuple promotion to source_verified; then careful geometry-based table extraction. A text line is documentary evidence only, never certified factory capability.

C.4 producer AI search, comparison UI, entitlement and source citations. No real catalogues or authorisations should be fabricated to simulate progress.
