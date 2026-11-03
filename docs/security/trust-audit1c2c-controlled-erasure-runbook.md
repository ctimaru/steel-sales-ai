# TRUST-AUDIT1C.2C — Controlled Erasure & Storage Cleanup

Date: 2026-10-22  
Status: **QUARANTINED / DATA-MAPPING COMPLETE / PHYSICAL ERASURE NOT AUTHORIZED OR EXECUTED**

## Purpose

Prevent accidental use or dissemination of third-party price-list or employer-related commercial materials while preserving the integrity of the product and any evidence that may need to be reviewed under employment/IP law.

**Never rewrite Git history, delete migration history, remove records to hide their origin, upload the raw source to a public repository, or publish the object paths or commercial source contents.**

## Verified environment inventory (aggregate only)

Production is the project named `steel-sales-ai`. No project identifiers, storage object paths, client names or credentials are needed in this document.

| Class | Snapshot | Current control |
| --- | --- | --- |
| Commercial price list | 1 list, 1 review/internal version | List `inactive`; version not publicly published |
| Structured items and components | 1,828 items, 3,656 price components | Retained; not physically removed |
| Import review | 1,831 import rows | Retained, with restricted FK dependencies |
| Knowledge documents | 12 relevant `superseded` records | Quarantined by status and direct-read RLS |
| Derived Knowledge | 93 chunks; 147 embedding rows; 45 entity mentions | Not deleted; authenticated direct-read RLS controls |
| Linked entities | 10 entity identities | **Keep**: all have independent associations with ready documents |
| Storage | 2 name-matched objects in a private bucket | **Do not SQL-delete**; one referenced by Knowledge, one by a consumed re-ingest |
| Worker lineage | 1 completed job, 1 consumed reingest | No evidence of pending work from those specific relations |
| Evidence of source rights | Version references, import decisions, governance, migrations | Preserve until retention/legal decision |

This is a **bounded candidate set**, not a certification of all data in connected apps, backups, Git history or unknown storage objects.

## Already applied safely

1. Retire matching price list (`active -> inactive`).
2. Mark 12 identified Knowledge documents `superseded`.
3. Restrict read access on `knowledge_documents` and `knowledge_chunks` through the preceding TRUST-AUDIT1C.2B migration.
4. Restrict authenticated reads of `knowledge_entity_mentions` and `knowledge_evidence` when their document is `superseded` (this migration), staged first.
5. Keep unrelated Knowledge and Network entities intact.
6. Block inactive-list browsing in frontend via the predecessor PR; independent privileged RPC and service-role checks remain outstanding.

## Hold gate: required before irreversible erasure

The candidate material includes commercially sensitive records potentially relevant to ownership and employment rights. **A designated legal professional / appropriate data controller must determine whether retention is required, what is lawful to purge and who can approve that action.** Log that decision outside the public repo using an access-controlled record containing only the decision, scope, approver and date. If the decision is unresolved, leave records quarantined and do not purge.

Do not treat a generic user request as proof that a legal hold has been cleared. Do not delete merely to conceal the fact that data was previously imported.

## Authorized deletion workflow (instructions only; NOT run)

1. **Legal/data-governance GO:** approve a specifically scoped manifest of document IDs and Storage object paths kept privately. Verify the manifest excludes data supplied by legitimate users, other organizations and any material subject to preservation obligations.
2. **Freeze re-ingest:** disable the exact affected data-import path and verify no pending/running jobs. Confirm no live function or worker replays the source.
3. **Prepare bounded inventory:** calculate all referencing keys and count FK dependencies (especially `price_list_import_runs`, `price_list_versions`, price rules, immutable lifecycle events, import review decisions, source-governance events, knowledge citations and benchmark targets). Check existing backups and legal retention. Never disable integrity triggers casually.
4. **Preservation where required:** keep any legally required evidentiary record in a secure and separately controlled archive, not in operational Knowledge, public Git, or ordinary Notion. Establish custody, access controls and retention.
5. **Database erasure:** only once all FK blocks and preservation decisions are resolved, execute a reviewed transaction targeting the approved set. Do not issue wide wildcard deletes; assert expected counts and rollback on any mismatch. Never delete shared Knowledge entities simply because they were associated with quarantined documents.
6. **Storage erasure:** use the Supabase **Storage API** (e.g. `supabase.storage.from(bucket).remove([approvedPath])`) with exact approved object paths, only after checking references. Do **not** `DELETE FROM storage.objects`: it can orphan underlying bytes. Avoid bulk bucket emptying.
7. **Verify:** check approved document/row/child counts, storage API results and object absence, accessible search routes, privileged RPCs, cache indexes, browser views, backups and re-ingest paths. Record aggregate results only; note backup expiry separately.
8. **Close legal and technical gates independently:** "hidden", "quarantined", "storage deleted", "database purged" and "legal clearance" must be distinct statuses.

## Required security reviews before close

- Verify `SECURITY DEFINER` functions that reference Knowledge and the Private Lab. RLS will not protect against privileged RPCs that bypass it.
- Independently assess any accessible `knowledge_entities` (10 identified entities are reused by clean documents and must not be deleted indiscriminately).
- Confirm non-privileged users cannot retrieve quarantined chunks or mentions, while valid Knowledge queries remain functional.
- Check all Storage buckets, names and cross-table path references *without publishing names*.
- Confirm code PR release and Vercel deployment separately from GitHub CI.
- Reconcile the production migration ledger and repository schema after the stacked PRs are merged. Do not bypass required checks or silently alter migration history.

## Source references

- Predecessor: TRUST-AUDIT1C.2B — Reference Cleanup and Provenance Acceptance (GitHub PR #861).
- Supabase Storage deletion documentation: https://supabase.com/docs/guides/storage/management/delete-objects
- Supabase RLS documentation: https://supabase.com/docs/guides/database/postgres/row-level-security

**Acceptance decision:** reversible access isolation has passed; **physical cleanup remains PENDING explicit scoped legal/governance clearance and a Storage API-capable authorized execution path.**
