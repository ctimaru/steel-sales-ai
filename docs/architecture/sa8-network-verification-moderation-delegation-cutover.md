# SA8 — Network Verification & Moderation Delegation Cutover

## Goal

SA8 closes the final operational delegation boundary of the Platform Control Plane by moving Network trust operations from direct Platform Owner checks to the SA2 capability model.

It delegates evidence curation, evidence-backed verification, provenance/change-review moderation and identity-resolution review while keeping People & Access, global settings and tenant-private break-glass authority root-only.

## Role boundary

SA8 introduces the fixed role template `network_trust_admin` — **Network Trust Admin**.

Its capabilities are:

- `network_trust.read`
- `network_trust.assert`
- `network_trust.verify`
- `network_trust.revoke`
- `network_trust.review_changes`
- `network_trust.identity_refresh`
- `network_trust.identity_review`

Platform Auditor receives only `network_trust.read`.

The stable legacy key `claims_verification_admin` is retained for compatibility, but its display label becomes **Claims & Ownership Admin** so ownership-proof verification cannot be confused with Network verification.

## Evidence boundary

`m4_create_data_assertion` is delegated through `network_trust.assert`.

Delegated staff may create append-only assertions only from controlled source classes:

- `platform_curated`
- `public_web`
- `document`
- `manual_review`

and only with `platform_curated` or `platform_verified` ownership types plus `pending` / `accepted` review state.

Platform Owner keeps the broader legacy vocabulary where required by system migrations or controlled internal workflows.

Raw governance tables remain inaccessible to browser roles; all Platform operations use capability-checked RPCs.

## Network verification

`m4_record_verification` now branches on explicit high-risk permissions:

- `pending`, `verified`, `rejected` → `network_trust.verify`
- `expired`, `revoked` → `network_trust.revoke`

Every verification transition requires an **accepted evidence assertion whose entity type and target exactly match the verification scope**.

Verification remains scoped to company, facility, facility capability or company certification. The previous current verification is retained with `is_current = false`; a new immutable historical verification row becomes current and the target read-model status is updated.

Claim approval remains independent from Network verification.

## Provenance moderation

`m4_open_change_review` and `m4_decide_change_review` now require `network_trust.review_changes`.

Opening a company change review requires a matching company assertion. Review decisions may be `accepted`, `rejected` or `superseded`.

Critically, an accepted change review records the governance decision but **does not silently overwrite canonical/source data**. A separate evidence-aware write flow is still required to change the public profile.

## Identity resolution

`m5_refresh_identity_candidates` requires `network_trust.identity_refresh`.

`m5_review_identity_candidate` requires `network_trust.identity_review`.

Identity candidate generation continues to use deterministic PB6/M5 signals such as exact VAT/registration/domain/name matches.

`confirmed_match` remains evidence only. SA8 performs **no automatic merge, redirect, archive or identity collapse**.

## Platform UI

`/platform/network-trust` requires `network_trust.read` and surfaces:

- current counters for accepted evidence, verification states, open provenance reviews, identity candidates and unverified companies;
- append-only evidence creation for authorized staff;
- evidence-backed verification/rejection and explicit verification revocation;
- current verification history/status;
- change-review opening and decisions;
- identity refresh plus confirmed-match/dismissed decisions;
- a read-only experience for Platform Auditor.

Platform Home and Platform Navigation expose the area only when `network_trust.read` is present.

## Audit

SA8 records every delegated mutation in `platform_access_events` through the common SA2 audit helper.

Audited actions include:

- `network_assertion_created`
- `network_verification_verified`
- `network_verification_rejected`
- `network_verification_pending`
- `network_verification_expired`
- `network_verification_revoked`
- `network_change_review_opened`
- `network_change_review_accepted`
- `network_change_review_rejected`
- `network_change_review_superseded`
- `network_identity_candidates_refreshed`
- `network_identity_match_confirmed`
- `network_identity_candidate_dismissed`

Audit metadata explicitly preserves the no-auto-merge/no-auto-overwrite guarantees.

## Root-only boundaries after SA8

SA8 does not delegate:

- Platform Staff invitations;
- Platform role assignment/removal;
- staff suspension/revocation;
- global Platform settings;
- tenant-private break-glass access;
- any future destructive company merge unless separately designed and approved.

Platform Staff roles still grant no Organization membership and no access to tenant-private Commercial Memory.

## Acceptance

SA8 acceptance proves:

1. Network Trust Admin receives exactly the Trust capability family plus Platform Console access.
2. Claims & Ownership Admin receives no Network Trust capability.
3. Network Trust Admin cannot obtain any root-only permission.
4. Raw Trust governance tables remain inaccessible to authenticated browser roles.
5. Delegated evidence creation rejects disallowed source classes.
6. Accepted matching evidence can create a current verified state.
7. Revocation creates a new current state while retaining prior verification history.
8. Provenance acceptance does not overwrite the company profile.
9. Identity refresh performs no automatic merge.
10. Confirming an identity candidate preserves both company identities.
11. Every privileged mutation records its effective capability in the global Platform audit ledger.
12. Network Trust Admin receives no tenant membership.
13. Platform Auditor is read-only.
14. Ordinary authenticated users cannot read the Trust control plane.
15. Platform Owner retains implicit access to all known Trust capabilities.

## Superadmin delegation block closure

With SA8, the intended operational domains are delegated through fixed role templates:

- Registration Admin → onboarding/activation;
- Network Operations Admin → discovery/public enrichment;
- Claims & Ownership Admin → ownership claim lifecycle;
- Knowledge Editor / Publisher → governed public Knowledge workflow;
- Network Trust Admin → verification/provenance/identity moderation;
- Platform Auditor → cross-domain read-only oversight;
- Platform Owner → People & Access, global governance and emergency authority.

SA8 therefore closes the SA1–SA8 Superadmin delegation hardening block. Future work should be treated as a new product/governance initiative rather than extending the delegation cutover sequence.