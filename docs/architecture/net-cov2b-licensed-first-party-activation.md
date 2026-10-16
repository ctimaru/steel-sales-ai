# NET-COV2B — First-Party Licensed Source Activation

**Goal:** convert NET-COV2A research leads into rights-controlled, manual website acquisition without auto-publication. The 16 October baseline is 31 published Italian companies, zero published end-users and 10 research targets still awaiting qualification. No mass-site license has been secured.

## Shipped contract

- Per-domain permission table `network_netcov2b_domain_permissions` records source, first-party permission URL (separate from product evidence), authenticated reviewer, note, expiry and revocation; RLS denies all browser access.
- `netcov2b_record_permission` requires Platform governance, a previously qualified first-party steel-tube target, source registry already approved for `company_submission`, and a human attestation of direct website-owner permission for automated retrieval AND business-profile reuse.
- `netcov2b_activate_source` permits activation only after independently approved source rights and at least one unexpired domain permission. Activation never dispatches work.
- `netcov2b_prepare_run` builds queued **unreviewed** runs for 1–10 explicitly selected, deduplicated, independently qualified and consented leads. Independent run approval in Platform Governance is mandatory.
- `netcov2b_link_run` atomically binds all exact seeds only after the run is approved, by its original operator, and revalidates source and consent.
- Manual GitHub Action `netcov2b-controlled-first-party.yml` and Python worker check source, permission expiry/revocation, run and seeds before website retrieval. The existing safe fetcher enforces DNS/public-IP/robots/HTML restrictions. Max 10 sites × 3 pages with sequential pacing; candidate-only staging via `netcov2b_stage_candidate` rechecks domain consent at write time.
- Consent-only lead transfer checks each target's exact source/domain grant, with a domain-lead insert trigger that blocks unlicensed records even through generic callers. Generic weekly source claimant excludes `company_submission`; generic discovery worker excludes NET-COV2B runs. Source-registry trigger blocks activation without consent. Consent can be revoked immediately through the Source Registry, storing operator, reason and time; future worker checks and candidate inserts then reject that domain. No scheduled execution, no auto-publish, no Company Memory changes.

## Operator procedure

1. Qualify company targets in [Platform End-Users](https://www.smartsteelsales.com/platform/company-discovery/end-users); research is not verified buying activity.
2. Register a `company_submission` source in [Source Registry](https://www.smartsteelsales.com/platform/company-discovery/sources); review terms, rights and privacy there **with Enable OFF**.
3. Verify **explicit direct company authorization** for website automation and reuse. Register a separate HTTPS same-domain permission URL, expiry and meaningful review note. Public website visibility or robots allowance alone does not grant reuse rights.
4. Activate the source deliberately. Use NET-COV2B's dedicated `netcov2b_enqueue_consented` action to enqueue **only those qualified lead domains with a live, source-specific permission**; do not use the generic NET-COV1 bridge for this consented source. Each remains pending review.
5. Prepare a 1–10-lead run in Source Registry, independently approve its run governance, then atomically link it.
6. Manually dispatch NET-COV2B GitHub Action on main using run UUID. Inspect run counts and Candidate Gate. Only publish after independent company review.

## No-go and next step

There is **no real licensed source or direct company consent activated by this PR**. Wikidata CC0 licensing does not cover visits to third-party company websites. RNA restricted and Registro Imprese unreviewed remain disabled. NET-COV2C: investigate commercially redistributable provider datasets with a dedicated API ingestion adapter, *not* rights-laundered corporate website crawling.

## Acceptance

P0 Required Gate, SQL negative permission/worker-isolation smoke, frontend contract, worker pytest. After CI green: additive migrations, production security check, merge and deployment. First real authorized website pilot remains a separate operator decision.
