# P1.2 — Bulk import with progress, retry and idempotency

## Goal

Allow a tenant user with write access (`admin` or `member`) to import multiple commercial EML/PDF/XLS/XLSX files as one durable batch, see per-file progress and readable errors, and retry failed processing without duplicating files that already completed.

## Architecture

File bytes do **not** pass through the Vercel server action.

1. Browser validates the selection and computes SHA-256 for each file.
2. Authenticated Next.js server action sends only file metadata/checksums to the trusted Railway worker.
3. Worker validates tenant write membership and persists `import_batches` + `import_batch_items`.
4. Worker creates time-limited Supabase Storage signed upload tokens.
5. Browser uploads each new file directly to the private `commercial-uploads` bucket using `uploadToSignedUrl`.
6. Browser asks the worker to start only successfully uploaded items.
7. Worker downloads each object from private Storage, verifies size + SHA-256, and reuses the existing parser v4 → staging → knowledge ingestion → promotion pipeline.
8. Browser reads batch/item progress directly from Supabase under RLS.
9. Failed processing can be retried selectively from the same Storage object.

## Limits v1

- file formats: EML, PDF, XLS, XLSX
- maximum files per batch: 25
- maximum file size: 25 MB
- maximum aggregate batch size: 100 MB
- duplicate content inside the same batch: rejected
- ZIP remains supported by the legacy single-upload path but is intentionally excluded from P1.2 bulk v1; mailbox/archive connector work is separate.

## Persistence

### `import_batches`

Tenant-scoped aggregate status:

`queued → processing → completed | partial | failed`

Counters are transactionally recalculated from child items:

- total
- queued
- processing
- completed
- failed
- deduplicated

### `import_batch_items`

One row per selected file:

- filename / extension / size
- SHA-256 checksum
- Storage path
- status
- worker job link
- attempt count
- readable last error
- deduplication provenance

`worker_jobs` gains batch/item linkage, attempt number and checksum while preserving the existing parser/promotion contract.

## Tenant isolation

- orchestration tables have RLS enabled;
- authenticated clients receive SELECT only;
- rows are visible only through organization membership;
- client mutation is denied;
- all write/orchestration operations run through the worker with service-role after explicit `admin/member` membership verification;
- batch items are trigger-validated to match the batch tenant/owner context.

## Idempotency

Before issuing a new signed upload, the worker looks for a completed item with the same SHA-256 in the same organization. When found, the new item is completed immediately as `deduplicated=true`, retains provenance to the prior item, and no new parsing/promotion occurs.

A retry only considers `failed` items. If the previous worker attempt already promoted observations, retry reconciles the item to completed rather than promoting again.

## Error model

Per-file failures persist in `last_error` (bounded to 1000 characters). Successful files remain completed when another item fails, so the batch becomes `partial` instead of rolling back successful work.

## Mailbox connectors

Mailbox synchronization is explicitly deferred. P1.2 establishes the durable import-batch contract that P1.3 and later mailbox connectors can reuse with `source='mailbox'` without creating another ingestion pipeline.

## Acceptance

P1.2 is complete only when:

- clean migration rebuild and P0+P1 acceptance suite pass;
- worker and frontend CI pass;
- real production batch progress is tenant-safe;
- selective retry does not duplicate a previously completed item;
- cross-tenant access returns zero rows;
- Security/Performance Advisors show no new structural finding;
- Railway/Vercel production status is healthy.
