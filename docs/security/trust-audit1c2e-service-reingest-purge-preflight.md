# TRUST-AUDIT1C.2E — Service Role, Re-ingest & Purge Preflight

Date: 2026-10-22. State: **PREVENTIVE HASH QUARANTINE PASS / PHYSICAL PURGE NOT AUTHORIZED**.

## Scope and verified evidence

- Production had 12 superseded Knowledge documents, each with a distinct 64-character SHA256 checksum. None of these fingerprints also belongs to a ready document (368 ready documents at the audit date).
- There was no pending/running worker job in the exact checksum set; one previous price-list import matched a held fingerprint. A name-matched reingest was consumed and a linked worker job completed. These are scoped observations, not a universal inventory of connected-provider copies.
- The production service_role has BYPASSRLS by design. It must be restricted to trusted server/worker environments; RLS cannot guarantee that a privileged admin cannot inspect quarantined records. Security-definer function privileges require individual review.
- Worker source inspection: the role secret is read from environment in server-side worker modules such as storage.py and repository.py. Neither source inspection nor successful SQL smoke tests prove infrastructure secret hygiene or deployed-runtime behavior.
- The historic list-price parser contains supplier-specific adapter logic; modified bytes or re-encoding can have a new checksum. This guard is **byte-fingerprint specific** and is not a semantic/DLP engine.

## Non-destructive reimport guard

- Private table `private.trust_c2e_quarantined_checksums` retains exact hashes, no source file contents or names; REVOKE for public, anon and authenticated roles. It seeds dynamically from currently superseded SHA256 knowledge documents at migration execution. Fresh staging with no held documents correctly seeds none.
- Private SECURITY DEFINER trigger returns only a generic denial; it does not log or emit the matched hash.
- Four triggers deny new/re-activated exact-match data at `knowledge_documents`, `worker_jobs`, `commercial_offer_source_reingests` and `price_list_import_runs`.
- Existing historic records can remain superseded or receive status-preserving metadata corrections; new checksum matches cannot enter the active pipeline.
- Verified first on staging using synthetic test data within a rollback transaction, then production. Production test with one existing held checksum rejected a queued worker insertion and a document reactivation; both tests rolled back. Existing 12 superseded and 368 ready docs unchanged.

## Remaining privileged-access risk

1. service_role/postgres may intentionally inspect quarantined database rows for audit and cleanup; do not imply RLS applies to these roles.
2. A modified/renamed source can yield a distinct content checksum. Add source-rights and provenance checks before processing, and consider normalized-content fingerprints only after carefully controlling false positives.
3. Other ingestion mechanisms, external backup copies and any connected cloud app must be inventoried separately.
4. Audit all SECURITY DEFINER functions for actor authorization and direct data-return paths; avoid blanket privilege revocation that breaks legitimate tools.
5. Complete authenticated multi-tenant acceptance before claiming SaaS isolation.

## Explicit purge GO / NO-GO (not yet authorized)

**NO-GO** until a lawyer/data-controller decides which materials are legally required to be preserved, confirms the absence or scope of a legal hold, and approves exact identifiers in a restricted manifest. Production currently retains 1,828 pricing items, 3,656 components, 12 superseded documents, derived chunks/embeddings and 2 private Storage objects.

Once authorized: verify FK dependencies, stop reingest, perform scoped database transactions with count assertions, use Supabase Storage API `remove()` for exact object paths (not SQL DELETE on storage.objects), independently verify API reads, caches, backups and the audit log. Never rewrite Git history to conceal origin.

## Deployment

This PR is stacked on #869 → #867 → #861, and remains DRAFT until all required checks, clean rebuild and production acceptance have passed. SQL database changes were applied and tested separately in staging and production; repository merge or frontend deployment has not been performed.

Official guidance: https://supabase.com/docs/guides/database/postgres/row-level-security
