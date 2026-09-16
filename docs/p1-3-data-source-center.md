# P1.3 — Data source center and import history

P1.3 adds the operational view for every commercial source that feeds Steel Sales AI.

## Product surface

`/data-sources` shows:

- all imported files and email records in one timeline;
- semantic indexing coverage against the currently active embedding model;
- duplicates detected by the P1.2 SHA-256 import contract;
- failed imports and readable errors;
- discarded/no-document imports;
- last synchronization time globally and per source;
- source, state and text filters with server-side pagination.

The source center intentionally includes both generations of data:

1. **P1.2+ batch imports** from `import_batches` / `import_batch_items`;
2. **legacy Commercial Memory documents** already present in `knowledge_documents` before P1.2 existed.

This prevents a newly deployed P1.3 page from appearing empty when the tenant already has a populated commercial archive.

## Indexing state

Document readiness and semantic indexing are separate dimensions.

The P1.3 aggregation counts chunks in `knowledge_chunks` and embeddings for the single active row in `knowledge_embedding_models`. A document is:

- `indexed` when every chunk has an embedding for the active model;
- `indexing` when only part of the document is embedded;
- `pending` when chunks exist but the active-model embeddings are not complete;
- `no_content` when the document has no chunks;
- `not_applicable` for failed/discarded records;
- `not_available` when a deduplicated record cannot be linked to the original knowledge document.

## Trust boundary

The browser never receives the Supabase service-role credential.

1. The authenticated Next.js server action derives `actor_user_id` from verified Supabase claims.
2. It calls `POST /v1/data-sources/history` through the server-only `WORKER_INTERNAL_TOKEN` boundary.
3. Railway re-resolves the user's active admin/member organization membership.
4. Only then does the worker invoke `public.p1_data_source_center(...)` with the resolved `organization_id`.
5. The database function is `SECURITY INVOKER`, revoked from `public`, `anon` and `authenticated`, and executable only by `service_role`.

The organization id supplied to the database is therefore not browser-controlled.

## Status mapping

P1.3 normalizes pipeline state for the UI without changing authoritative source rows:

- P1.2 `deduplicated=true` → `duplicate`;
- failed batch item / worker job / knowledge document → `error`;
- queued or processing work → `processing`;
- completed legacy worker job without a knowledge document → `discarded`;
- superseded knowledge document → `discarded`;
- otherwise → `ready`.

The original error, attempts, sizes, batch/document identifiers and timestamps remain available in the response.

## Acceptance

The required CI gate covers:

- SQL aggregation over batch imports, legacy documents and legacy documentless jobs;
- cross-tenant organization filtering;
- direct RPC denial to `authenticated` and grant only to `service_role`;
- worker internal-token enforcement and server-side tenant resolution;
- frontend actor derivation through Supabase claims;
- frontend route/navigation and required operational states;
- full existing P0/P1 regression suites, typecheck, build and database lint.
