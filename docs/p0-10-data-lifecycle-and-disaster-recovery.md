# P0.10 — Backup, disaster recovery, retention, export & delete

## Goal

P0.10 defines the minimum data-lifecycle and disaster-recovery contract for Steel Sales AI before external pilot tenants are onboarded.

Contract version: `p0.10-v1`.

The implementation covers:

- tenant export manifest and customer-authoritative JSON snapshot;
- export archive with the database snapshot plus every referenced private Storage object;
- tenant deletion with a dry-run preview, exact `DELETE:<tenant-slug>` confirmation, Storage-first erasure, database erasure and metadata-only audit evidence;
- conservative retention for expendable operational data only;
- a health contract for lifecycle policy and Storage versioning;
- a documented backup/restore operating procedure and an explicit production-plan gate.

## Data classes

### Customer-authoritative tenant data

Retained until an explicit tenant deletion request. P0.10 never expires these rows automatically.

Examples include:

- organizations and memberships;
- companies, contacts and conversations;
- RFQs, offers, orders and line items;
- products, prices, availability and certificates;
- commercial datasets, threads and normalized observations;
- private knowledge sources, documents, evidence, entities and aliases;
- uploaded source objects in Supabase Storage.

### Rebuildable derived data

These are intentionally excluded from the portable export payload because they can be regenerated from authoritative data and raw source objects:

- `knowledge_chunks`;
- `knowledge_chunk_embeddings`;
- `knowledge_entity_mentions`;
- parser staging rows;
- operational observability events.

The export manifest still reports their counts so an operator can validate the rebuild scope.

### Global product/network data

Global market data, model registries and retrieval evaluation fixtures are not part of a tenant export and are not deleted when one tenant is erased.

If a global evaluation target happens to point at a private tenant chunk, tenant deletion removes that cross-scope target before deleting the private chunk.

## Internal operations API

All endpoints require `X-Worker-Token`.

### Lifecycle health

`GET /v1/ops/data-lifecycle/health`

Returns the `p0.10-v1` policy, current retention candidates, latest lifecycle audit timestamp and Storage bucket versioning status.

### Retention

Dry run by default:

`POST /v1/ops/data-lifecycle/retention`

Apply:

`POST /v1/ops/data-lifecycle/retention?dry_run=false`

P0.10 only purges:

- `observability_events` older than 30 days;
- `worker_staging_observations` whose parent job has been completed/failed for more than 30 days.

It never automatically purges authoritative commercial/customer data.

### Tenant export

Manifest only:

`GET /v1/ops/data-lifecycle/tenants/<organization-uuid>/export-manifest`

Portable ZIP:

`GET /v1/ops/data-lifecycle/tenants/<organization-uuid>/export`

The ZIP contains:

- `manifest.json`;
- `database.json`;
- `storage/...` raw uploaded files;
- restore notes.

Export completion is recorded in `data_lifecycle_audit` without storing customer payload.

### Tenant deletion

Preview:

`GET /v1/ops/data-lifecycle/tenants/<organization-uuid>/delete-preview`

The preview returns the required confirmation token:

`DELETE:<tenant-slug>`

Destructive call:

`DELETE /v1/ops/data-lifecycle/tenants/<organization-uuid>?confirmation=DELETE:<tenant-slug>`

The worker:

1. loads the authoritative manifest;
2. verifies the exact confirmation token;
3. removes every referenced object through the Supabase Storage API;
4. only after successful Storage deletion, invokes the database erasure RPC;
5. the database deletes tenant roots in dependency-safe order;
6. a metadata-only deletion audit row survives the tenant.

A failed Storage deletion prevents database deletion. A failed database deletion rolls the database transaction back; the operation must be retried and investigated because raw objects may already have been removed.

## Backup and disaster recovery

### Current production constraint

The Steel Sales AI Supabase organization is currently on the Free plan.

Supabase documents that downloadable automatic database backups are available on paid plans, while Free projects should use logical exports/dumps. Supabase also documents that database backups do not include the actual files in Storage, so Storage must be backed up separately.

Official references:

- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/going-into-prod
- https://supabase.com/docs/guides/storage/management/delete-objects

### Current internal-stage recovery model

Until the platform is upgraded:

- schema is reproducible from the committed `supabase/migrations` chain;
- application code is reproducible from GitHub;
- tenant-authoritative data can be exported as a P0.10 ZIP;
- raw Storage source objects are included in that tenant ZIP;
- before any high-risk schema/data operation, operators should create a logical PostgreSQL dump with the Supabase CLI or `pg_dump` and separately copy Storage to an encrypted offsite location.

A tenant ZIP is a portability/customer-data export. It is not a substitute for a full PostgreSQL physical/PITR backup.

### External-pilot gate

Before onboarding external design partners:

1. upgrade the production Supabase project to a plan with managed downloadable backups at minimum;
2. choose the required RPO:
   - daily backup is acceptable only if an RPO of roughly 24 hours is acceptable;
   - enable PITR when the target RPO is materially shorter;
3. define an encrypted offsite Storage backup destination;
4. execute and record one restore rehearsal;
5. record measured RPO/RTO and the restore evidence on the P0.10 monday.com item.

P0.10 software is designed so this infrastructure upgrade does not require a data-model change.

## Restore rehearsal

Run the rehearsal against an isolated non-production project/database.

1. Record source project version, migration commit and backup timestamp.
2. Restore database dump into the isolated target.
3. Restore the Storage objects into the matching private bucket.
4. Run the full migration chain if the dump predates current schema.
5. Run P0 Foundation CI acceptance SQL.
6. Call:
   - `observability_health(60)`;
   - `data_lifecycle_health()`;
   - `tenant_export_manifest(<test-tenant>)`.
7. Run a representative commercial query and a grounded RAG query.
8. Compare row counts and Storage object counts with the pre-backup manifest.
9. Record measured RTO and any data gap (RPO).
10. Delete the isolated rehearsal environment after evidence is captured.

## RPO/RTO policy

For the current internal-development stage:

- desired RPO: best effort; create a logical dump before risky data/schema operations;
- desired RTO: one working day for internal recovery.

Before external pilots:

- managed backup becomes mandatory;
- target RPO and RTO must be explicitly approved based on pilot/customer requirements;
- restore rehearsal evidence is mandatory.

## Acceptance gate

P0.10 can pass the software gate when all of the following are true:

- DB lifecycle migration applies cleanly;
- RLS and function grants are service-role-only;
- tenant export manifest/snapshot are correct;
- tenant deletion is dry-run by default and requires explicit confirmation plus Storage deletion;
- synthetic tenant deletion removes only that tenant and preserves global/other-tenant data;
- retention deletes only expendable operational data;
- worker ZIP export includes referenced Storage objects;
- worker deletion removes Storage before invoking DB erasure;
- Supabase Advisors show no newly introduced security error;
- production dry-run/manifest/health smoke passes.

Managed automatic backup/PITR and an offsite Storage backup are separately tracked as an external-pilot infrastructure gate because the current Free plan cannot provide the final managed-backup posture.
