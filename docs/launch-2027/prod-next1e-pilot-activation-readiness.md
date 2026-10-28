# PROD-NEXT1.E — Pilot Activation Readiness
**Owner:** founder / Platform Superadmin · **Status:** Implementation in PR #1022, human/legal GO pending
**Project:** [Notion PROD-NEXT1](https://app.notion.com/p/407f059cecb5811e8abfc399f4a29b3d) · [GitHub #1021](https://github.com/ctimaru/steel-sales-ai/issues/1021) · [Pilot L27.5](https://app.notion.com/p/3eaf059cecb5810fb2a9cfc1adc97b83)

## Existing systems (reused, not duplicated)
- `/platform/pilot`: Superadmin P5.6A control room for admission and statuses, P5.6B telemetry for **historical marketplace activity**, technical readiness and admin actions.
- `/platform/product-analytics`: general public acquisition / aggregate product analytics (not five pilot commercial conversions).
- `/pilot-analytics`: legacy workspace pilot usage/readiness; **not** equivalent to five transaction-state metrics defined below.
- Public GA4 Cookie Consent Mode v2: distinct from optional measurement of private commercial actions. Accepting public cookies **does not** enroll anyone in pilot measurement.

## Implementation (fail-closed)
The existing `/platform/pilot` server page renders `ProdNext1ePilotActivationDashboard`:
- Five business KPI cards show **— / NON MISURATO**; *never* 0 when no verified data source exists.
- Cohort tally and per-company checks reuse `p5_6a_pilot_control` (authorized for superadmin).
- Existing "Attiva" and "Riattiva" buttons are disabled unless both technical readiness and new admission checks pass.
- Most importantly, server action `transitionMarketplacePilotParticipant` checks the **same admission gate before any activate/resume RPC**. Existing pause/remove/complete actions remain usable during NO-GO.
- `PILOT_2027_REAL_METRICS_ENABLED` is hard-coded **false**. No analytics ingestion or private-company event emission was added.

## Company admission (operator attestations only)
On the server the new `evaluatePilot2027Admission` rejects activation unless:
1. `PILOT_2027_ACTIVATION_ENABLED=enabled` was deliberately set on the server, never in `NEXT_PUBLIC_*`; **default OFF**, acts as immediate kill switch for new admission.
2. Exactly one matching organization exists in server-only `PILOT_2027_APPROVALS_JSON`, with valid organization UUID.
3. Evidence window is current, explicit start/end with maximum length 120 days. An expired or future-only approval is rejected.
4. Every below reference exists with a safe document ID or internal DMS reference (never private content or user name).
5. Existing company technical readiness is green for the selected buyer/supplier role; authorized superadmin action is enforced.

**Minimal shape (fictitious refs only — do not use as genuine approval):**
```json
[
  {
    "organization_id": "00000000-0000-0000-0000-000000000001",
    "signed_pilot_agreement_ref": "agreement-demo-placeholder",
    "approved_privacy_notice_ref": "notice-demo-placeholder",
    "lawful_basis_review_ref": "legal-review-demo-placeholder",
    "data_retention_and_deletion_ref": "retention-demo-placeholder",
    "backup_restore_drill_ref": "restore-demo-placeholder",
    "support_and_incident_plan_ref": "support-demo-placeholder",
    "founder_approval_ref": "founder-demo-placeholder",
    "approved_at": "2027-01-01T00:00:00.000Z",
    "expires_at": "2027-02-01T00:00:00.000Z"
  }
]
```
**Never copy this example into real production configuration.** References are operator attestations, not validation of a contract's contents. A legal/privacy professional must review documents; the software only enforces presence/expiry of attested references. For later governance scale, move this evidence to an audited owner-only store with provenance, signature and revocation history; the current JSON configuration is a restricted, initial-release gate, **not an adequate long-term evidence register**.

**Important limits:** kill switch stops *new* activate/resume actions. It does not automatically pause previously active participants or revoke issued supplier capabilities. The founder must inspect any already-active cohort and use `Pausa` / access revocation procedures where needed. The app cannot independently certify that the legal documents are valid.

## Five exact commercial-state KPIs — future optional pilot only
| Key | Eligible event | Why a click is insufficient |
| --- | --- | --- |
| `valid_bill_created` | DB-confirmed, technically valid private bill | Calculator views/clicks can fail to persist |
| `private_rfq_draft_saved` | Authenticated RFQ draft saved with valid bill | A clicked RFQ CTA is not a created RFQ |
| `supplier_selection_reviewed` | Review state confirmed for recipients | Supplier suggestions / clicks alone are not approval |
| `qualified_quote_submitted` | Submission succeeded with normalized quote lines | A price input or saved draft is not a submitted offer |
| `po_confirmed` | Supplier confirmed a specific immutable PO version | An issued but unconfirmed order does not qualify |

### Privacy-safe future data contract (NOT deployed or collecting)
Before implementing *any* server capture:
- Assess and document the lawful basis **separately** for essential service processing vs optional product-activation analytics; obtain legal review and record notice version/purpose. Where consent is the basis, require **freely given, specific, informed, unambiguous opt-in** and **equally easy withdrawal**, with server-verifiable audit of grant/revoke (GDPR Article 7). Refusal cannot block the core product.
- Server verifies `user_id`, tenant and active pilot membership, plus individual permission for that precise purpose on each event. Do not use client localStorage/GA cookies/metadata claims to authorize measurement.
- Track only event key, day/week bucket and a pseudonymous organization cohort reference inside protected storage. Avoid raw `user_id` if aggregate-only measurement suffices; no event-level PII in export.
- **Never send** company names, material specs, quantities, prices, RFQ/PO IDs, recipient data, email addresses, prompts, capability tokens, cookies or page URLs with secrets to analytics.
- Implement suppression for small cells (recommended threshold 5, to be confirmed with privacy reviewer), role-scoped aggregation and retention/revocation/erasure tests before first data collection.
- Distinguish exact source: existing broad GA4 marketing funnel, previous workspace pilot usage telemetry, test-only Chrome timings, and future consented real business events. No backfills or synthetic counts in real dashboards.
- Build an authorization/revocation mechanism before changing `PILOT_2027_REAL_METRICS_ENABLED`; until then all five cards display *not measured*.

References for legal review: [European Commission — lawful basis and consent](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data_en), [EDPB — SME personal data lawfulness](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en). This is an engineering checklist, **not** a legal opinion.

## Release acceptance and remaining NO-GO gates
- [ ] CI P0 (unit/source/TypeScript/build), Chrome isolated and production anonymous smoke green on PR final head.
- [ ] Review live cohort: no existing `active` entries should be silently taken as new-approved 2027 pilot members.
- [ ] Legal officer accepts legal basis, DPIA determination, agreements, controller/processor roles, DPA as applicable, privacy notice, retention, request/withdrawal mechanism.
- [ ] Founder confirms actual restore drill, support incident response, minimum viable pilot cohort and an immediately executable stop/revoke procedure.
- [ ] Granular server-stored user opt-in and withdrawal + RLS tests implemented **before** any real five-event KPI capture.
- [ ] Explicit product owner GO, separately from legal pilot GO.

**Decision:** technical admission dashboard and default-deny gate may be release-reviewed; **real pilot and live customer activation metrics remain NO-GO**.
