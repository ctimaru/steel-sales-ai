# SA6 — Claims & Verification Delegation Cutover

## Goal

SA6 delegates Company Claims and **ownership-proof verification** to Platform Staff through the SA2 capability model.

The Claims & Verification Admin can inspect claim requests, validate or reject ownership proof, move a claim into review, approve or reject ownership, and revoke existing control without receiving authority over Registration, Company Discovery, Knowledge, People & Access, tenant-private workspaces, or the separate Network verification state machine.

## Critical terminology

In SA6, **Verification** means verification of the ownership proof attached to a company claim.

It does **not** mean Network verification.

The following remain separate:

- `network_company_claims.proof_status` — evidence that the claimant is entitled to control the profile;
- `network_companies.verification_status` and `network_verifications` — Platform-controlled verification of Network facts.

Therefore:

- claim approval never sets a company to `verified`;
- Claims & Verification Admin cannot call the Network verification workflow;
- `public.m4_record_verification(...)` remains Platform Owner-only.

## Delegated capabilities

SA6 consumes the fixed SA2 permissions already assigned to `claims_verification_admin`:

- `claims.read`
- `claims.review_proof`
- `claims.approve`
- `claims.reject`
- `claims.revoke`

Platform Owner retains implicit access to every capability.

Platform Auditor receives only `claims.read`.

No new permission, per-user override, or ad-hoc role is introduced.

## UI and route boundary

`/platform/company-claims` now requires `claims.read`.

The route resolves the effective Platform capability set and progressively exposes controls:

- ownership-proof verify/reject only with `claims.review_proof`;
- move to `under_review` only with `claims.review_proof`;
- approval only with `claims.approve` and an already verified ownership proof;
- claim rejection only with `claims.reject`;
- revocation only with `claims.revoke`.

Platform Auditor receives the same queue visibility without mutation controls.

Platform Home and Platform Navigation expose Company Claims whenever `claims.read` is present.

## Server actions

Every Company Claims Server Action rechecks authorization before invoking Supabase.

`reviewCompanyClaimProof` requires `claims.review_proof`.

`reviewCompanyClaim` maps each transition to one exact capability:

- `under_review` → `claims.review_proof`
- `approved` → `claims.approve`
- `rejected` → `claims.reject`
- `revoked` → `claims.revoke`

The UI is never treated as the security boundary.

## Database authorization

SA6 cuts the following private implementations over from direct Platform Owner checks:

- `p3_6_admin_claim_queue_impl`
- `p3_6_review_claim_proof_impl`
- `m4_review_company_claim_impl`

They now enforce explicit SA2 permissions with `private.require_platform_permission(...)`.

The following are intentionally **not** cut over:

- `m4_record_verification_impl`;
- data assertion creation;
- change-review governance;
- unrelated Network moderation.

Those remain Platform Owner-controlled.

## Ownership-proof gate

The existing P3.6 invariant is preserved: a claim cannot be approved until `proof_status = verified`.

A delegated Claims Admin therefore cannot bypass ownership evidence simply because they hold `claims.approve`.

Corporate-email automatic verification remains unchanged. Manual proof review records the delegated Platform actor.

## Claim approval semantics

Approval continues to:

- require verified ownership proof;
- reject competing approved claims;
- reject conflicting active Organization↔Network Company control links;
- create or reactivate exactly one `organization_network_company_links` row with claim provenance;
- set `claimed_status = claimed`;
- leave `verification_status` unchanged.

Revocation continues to revoke the Organization↔Network Company control link, set `claimed_status = revoked`, and leave Network verification unchanged.

Claim rejection restores `unclaimed` only when no competing active claim exists.

## Audit

Delegated mutations write the common Platform audit ledger through `private.sa2_record_platform_event(...)`.

Audited actions include:

- `company_claim_review_started`
- `company_claim_proof_verified`
- `company_claim_proof_rejected`
- `company_claim_approved`
- `company_claim_rejected`
- `company_claim_revoked`

Each event records actor identity, Platform authority type, active role snapshot, exact permission used, claim id, target organization id, before/after state, optional review reason, and `company_claims` surface metadata.

## Tenant isolation

Claims & Verification Admin receives no `organization_membership`.

Approving a claim grants control to the **claimant organization**, not to the Platform operator.

Delegated Platform authority does not expose Commercial Memory or tenant-private workspace data.

## Acceptance

SA6 acceptance verifies that the delegated Claims Admin can read and process claim ownership proofs and decisions; approval remains proof-gated; approval/revocation preserve Network verification; the operator cannot call `m4_record_verification`; no tenant membership is granted; mutations are permission-audited; Platform Auditor is read-only; ordinary users cannot read the control plane; and Platform Owner remains uninterrupted.

## Security boundary after SA6

The Platform operating model is now split across explicit bounded domains:

- Registration Admin → company onboarding and activation;
- Network Operations Admin → public Company Discovery and controlled enrichment;
- Claims & Verification Admin → ownership proof and company-claim lifecycle;
- Platform Auditor → read-only cross-domain oversight;
- Platform Owner → root governance plus still-undelegated Network verification and moderation.

Commercial Memory remains tenant-private throughout.

## Next boundary

SA7 should delegate Knowledge Operations using the same capability-first pattern while keeping publication authority distinct from editorial preparation: route visibility → draft/edit/review capabilities → publish separation → Postgres enforcement → audit → public-content acceptance.
