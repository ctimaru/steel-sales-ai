# SA5 — Network Operations Delegation Cutover

## Goal

SA5 delegates Company Discovery to Platform Staff through the SA2 capability model.

The Network Operations Admin can operate discovery runs, review candidates, publish new public Network profiles, apply selected public-web enrichment and close exact duplicates without receiving authority over Registrations, Claims, Knowledge, People & Access or tenant-private workspaces.

## Delegated capabilities

- discovery.read
- discovery.run
- discovery.review
- discovery.publish
- discovery.enrich
- discovery.close_duplicates

Platform Owner retains implicit access to every capability.

Platform Auditor receives only discovery.read.

## UI and route boundary

/platform/company-discovery now requires discovery.read.

The page resolves effective permissions and progressively exposes controls:

- new crawl form only with discovery.run;
- reject / duplicate review only with discovery.review;
- publish-new only with discovery.review + discovery.publish;
- selective enrichment only with discovery.review + discovery.enrich;
- exact-duplicate bulk closure only with discovery.close_duplicates.

Read-only staff can inspect queue, run telemetry, quality flags, evidence and candidate details without mutation controls.

The authenticated tenant Network shortcut remains visible only to Platform Owner. Platform Staff authority does not imply organization membership.

## Server actions

Every Company Discovery Server Action rechecks its capability before invoking Supabase.

reviewCompanyDiscovery always requires discovery.review and additionally requires:

- discovery.publish for publish_new;
- discovery.enrich for enrich_existing.

The UI is never treated as the security boundary.

## Database authorization

The following private implementations are cut over from direct Superadmin checks:

- p3_start_company_discovery_impl
- p3_start_company_discovery_batch_impl
- p3_admin_discovery_queue_impl
- p3_admin_discovery_runs_impl
- p3_admin_discovery_detail_impl
- p3_review_company_discovery_impl
- p3_close_exact_discovery_duplicates_impl
- p3_enrich_existing_company_discovery_impl
- p3_enrich_existing_company_discovery_selected_impl

Each path calls private.require_platform_permission(...).

The service-role worker queue claim remains service-role-only and is not delegated to Platform Staff.

## Decision separation

Discovery review stays intentionally split by risk.

Reject and duplicate classification use discovery.review.

Publishing a new public Network company additionally requires discovery.publish.

Applying accepted public evidence to an existing company additionally requires discovery.enrich.

Bulk duplicate closure uses discovery.close_duplicates and never merges legal identities.

## Audit

Mutating delegated operations write Platform audit events containing:

- actor identity;
- role snapshot;
- permission used;
- action;
- discovery run or candidate id;
- before / after state;
- optional review note.

Audited actions include run creation, rejection, publication, enrichment and exact-duplicate closure.

## Tenant isolation

Network Operations Admin receives no organization_membership from Company Discovery and no access to tenant-private Commercial Memory.

Publishing a discovered company creates an unclaimed + unverified public Network profile, exactly as before.

Enrichment remains additive and selective:

- no identity merge;
- no overwrite of company-managed identity fields;
- only explicitly approved facility / capability / market evidence is materialized.

## Domains intentionally not delegated in SA5

- Company Claims
- Knowledge Operations
- People & Access
- Platform settings
- tenant break-glass access

## Acceptance

SA5 acceptance verifies that:

1. Network Operations Admin can read queue, runs and candidate detail.
2. Network Operations Admin can start runs.
3. discovery.review can reject a candidate.
4. publication creates only unclaimed + unverified Network profiles.
5. exact duplicate closure never merges identities.
6. selective enrichment stays additive and non-overwriting.
7. Platform Auditor can read but cannot mutate.
8. ordinary authenticated users cannot read the discovery control plane.
9. delegated operators receive no tenant membership.
10. every privileged mutation records the effective permission in the global audit trail.
11. Platform Owner retains uninterrupted access.

## Next boundary

SA6 should delegate Company Claims & Verification using the same pattern:

route visibility → proof-review capability → claim decision capabilities → Postgres enforcement → audit → tenant-isolation acceptance.
