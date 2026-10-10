# RFQH14 — Real Procurement Pilot & Acceptance

Status: **RFQH14.1 technical baseline in progress; real external pilot NOT STARTED**. This document must never be interpreted as proof of a live commercial order.

## Scope and sources of truth

RFQH14 verifies one procurement transaction across buyer and supplier in the existing RFQH1–13 engine. It does **not** introduce a parallel RFQ/order model, a new role or an automatic dispatch/award. It complements [RFQH13 production pilot runbook](./rfqh13-production-pilot-runbook.md).

- Buyer: `/rfq-hub` → `/rfq-hub/distinta` → `/rfq-hub/[rfqId]` → `/rfq-hub/inbox` → `/rfq-hub/suppliers` → `/rfq-hub/intelligence`.
- Supplier RFQ: capability-bound `/rfq/respond/[token]`.
- Supplier PO: capability-bound `/po/respond/[token]`.
- Marketplace is an **optional** bridge; it is not the owner of procurement objects.
- Commercial, approved price targets are never disclosed to other suppliers; supplier tokens must never be pasted into issues, Notion, screenshots or analytics.
- Final award, supplier selection, PO issuance, RFQ dispatch and supplier confirmation require explicit human action.

## Production baseline — 2026-10-10, direct Supabase read-only query

Supabase project `ecrafjdummcdfycznitx` is ACTIVE_HEALTHY. The production database returned:

| Domain | Production count |
| --- | ---: |
| RFQ campaigns | 0 |
| RFQ supplier targets | 0 |
| RFQ dispatches | 0 |
| Supplier quotes | 0 |
| Awards | 0 |
| PO drafts | 0 |
| PO versions | 0 |
| Supplier PO responses | 0 |
| Supplier CRM profiles | 0 |
| Procurement approvals | 0 |

Vercel production for `smartsteelsales.com` and `www.smartsteelsales.com` was READY at commit `6d22114a20f3c076e65ee581e24c9aeaf1524541` (RFQH11.1). Code deployed is not evidence of a real buyer/supplier acceptance. This baseline is a point-in-time snapshot; use read-only checks again before and after the real pilot.

## Microblocks

### RFQH14.1 — Baseline & guardrails
- Read-only production counts, RLS/function grants and source route checks, including anonymous supplier capabilities and private buyer views.
- Verify delivery / bounce / suppression / audit and current Vercel/Railway runtime health.
- No synthetic persistent data; no external send. Log observations, unresolved risks and evidence provenance.
- Exit: repeatable tests and documented zero-data/production baseline.

### RFQH14.2 — Browser acceptance (controlled, no external send)
- In Chrome, with permitted buyer/company test accounts and separate supplier test profiles, validate mobile 390×844 and 430×932 plus desktop.
- Validate authenticated roles (owner, collaborator, approver), RLS isolation across tenants, unauthenticated access to private routes, supplier invitation visibility and absence of buyer target prices.
- Test accessible interactions: mobile overflow, error states, loading/empty states, forms, keyboard and focus, invalid/expired capability links.
- If a test requires creating real data, use an isolated test environment or an explicitly controlled reversible fixture; log cleanup and **never** claim production real-pilot acceptance.
- Exit: screenshots/evidence retained in a private trusted store and defects triaged.

### RFQH14.3 — External pilot preflight
- Before inviting any company, verify ICP/value proposition, packaging hypothesis, legal/privacy notices and terms, consent, data processing/security baseline, delivery domain, support owner and rollback process. Align with Notion L27.5 launch gate; RFQH14 does not override it.
- In Supabase console verify actual database backups/PITR, restore owner and Storage backup/recovery separately. Connector metadata alone is insufficient.
- Identify one buyer and at least two authorized suppliers (preferably three) who explicitly agree to a pilot; confirm target product, recipient email and expected response window.
- Confirm third-party quote and attachment retention terms, access boundaries, supply source rights and consent to communications.
- Exit: written preflight approval by the platform owner; otherwise **NO-GO**.

### RFQH14.4 — Real end-to-end procurement case (only after GO)
1. Buyer compiles and validates mixed EN 10210/EN 10219 Buyer Distinta, accurate geometric kg/m, quantities and private target.
2. Buyer creates RFQ campaign, selects consenting suppliers; verify canonical identity, no duplicate CRM and isolation.
3. Buyer explicitly dispatches governed invitations; inspect provider delivery, message ledger, suppression and bounce.
4. Each supplier opens only their capability link; compare their visible requested lines and verify no competing supplier identities or buyer-only targets.
5. Supplier submits a structured quote (€/t or €/m) with optional attachment; buyer sees consistent price/quantity coverage and revision history.
6. Buyer optionally requests clarification / counter-target / BAFO and records revision; check notifications and isolated thread.
7. Buyer reviews RFQH5 comparison, records justified full/split award (with second-person approval if company policy requires it), confirms manually.
8. Buyer explicitly issues versioned PO (approval when required); supplier confirms or requests a change; issue a new immutable version if appropriate.
9. Buyer verifies Inbox, Supplier CRM and Intelligence. Download sanitized audit export; compare event chronology and financial totals to the source objects.
10. Record observed elapsed times, friction, failures and final user feedback without storing PII in public GitHub.

### RFQH14.5 — Evidence review & rollout decision
- Record each step as PASS / FAIL / NOT TESTED, environment, UTC timestamp, role, anonymized RFQ ID, evidence location, responsible tester and remediation issue.
- Mandatory evidence: invite-delivery, supplier submission, comparison, award and approval, versioned PO, supplier confirmation, governance, cross-tenant negatives and audit reconstruction.
- Gate is **ACCEPTED** only with a genuine external buyer-supplier-PO confirmation and no privacy/tenant critical incident. **TECHNICAL READY** is distinct from **PILOT ACCEPTED**.
- Pilot outcome after review: ACCEPTED, ACCEPTED WITH FOLLOW-UP or FAILED. No automatic commercial rollout.

## Acceptance matrix

| Check | Evidence | Expected |
| --- | --- | --- |
| Buyer authentication / membership | Chrome and audit | Only active authorized company members access buyer workspace |
| Tenant isolation and cross-user reads | 4-tenant negative browser/API case | Zero foreign RFQ, offers, contacts, supplier price history |
| Supplier isolation | Separate RFQ capability per supplier | Other recipients and private targets never present |
| Delivery | Provider status + RFQH3 message ledger | One private invitation per supplier; retries idempotent |
| Quote / comparison | Revision snapshots + RFQH5 | €/m ↔ €/t consistent; partial quote cannot win complete award |
| Approval | Second person + fingerprint | No self-approval; payload changes invalidate prior approval |
| Award → PO | Immutable award and PO versions | Exact quantity, unit prices and totals; no implicit send |
| Supplier confirmation | PO capability + response timestamp | Explicit confirmation linked to immutable PO version |
| Supplier CRM & Intelligence | User-scoped UI + SQL | Correct price and response history; empty state if no data |
| Audit / recovery / backup | Sanitized export, provider ledger, restore plan | Chain reconstructable, no secrets, recovery documented |
| Mobile/accessibility | Chrome 390×844 / 430×932 | No horizontal body overflow or hidden critical actions |

## Pilot record template (copy into **private** evidence location)

- Case ID / anonymized buyer tenant / tester / UTC start:
- Supplier count / opt-in confirmation / environment:
- Product shape, standard and grade / expected kg/m:
- RFQ reference / dispatch delivery timestamps:
- Quote references / coverage / normalized price:
- Award mode / approver evidence / reason / savings:
- PO version / supplier confirmed timestamp:
- Browser, viewport / cross-tenant security result:
- Sanitized audit export checksum and location:
- Support tickets, risks, unexpected email/bounce:
- Final decision / owner / date:

## Current blockers / risk register

1. **Pilot data absent:** all production RFQ counters were 0 at baseline; external acceptance is NOT TESTED.
2. **Backup/PITR and Storage recovery:** provider-side verification and restore plan still required.
3. **Real-user commercial preflight:** L27.5 explicitly delays real-company pilots until value proposition, legal/trust, GTM and support are ready.
4. **Legacy RLS performance:** `multiple_permissive_policies` warning exists; do not remove policies without a tenant regression.
5. **Anonymous supplier link:** scope token and validity carefully; do not persist or display capability values in evidence.

## Run modes

- **Read-only baseline:** execute `supabase/tests/rfqh14_pilot_readiness.sql` through the P0 required gate or the authorized SQL connection. Produces counts and verifies security grants/RLS, but never declares a pilot complete.
- **Synthetic smoke:** existing RFQH13 test fixtures/transaction rollback. Always label synthetic and keep persistent production records untouched.
- **Real pilot:** only with above preflight GO and consent; deliberate buyer and supplier actions; trace actual delivery and purchase-order confirmation.
