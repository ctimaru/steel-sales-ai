# P0.12 — Production Acceptance Test

Date: 2026-09-16

## Decision

P0 Foundation functional acceptance is **PASS**, subject only to removal of the temporary Railway PAT helper service created during the acceptance exercise. That cleanup is administrative and requires Railway 2FA in the dashboard; it does not affect the production `steel-sales-ai` service.

## Scope

The PAT exercises the production Foundation across:

1. tenant-scoped commercial ingestion/promotion;
2. parser v4 validation and canonical tube identity;
3. Knowledge ingestion, chunking and semantic indexing;
4. hybrid retrieval and source provenance;
5. persisted retrieval/RAG quality gates;
6. tenant/RLS isolation;
7. observability and provider telemetry;
8. lifecycle/export/retention dry-runs and Storage integrity;
9. CI/CD and production runtime health.

No production tenant data was deleted. Synthetic mutation tests were wrapped in database transactions and rolled back.

## Production baseline

At PAT start the production tenant contained:

- 1 organization and 1 active membership;
- 1,350 commercial observations;
- 377 knowledge documents;
- 1,413 knowledge chunks;
- 2 completed durable worker jobs and 0 failed jobs;
- entity-resolution health `critical_issue_count = 0`;
- observability health `critical_issue_count = 0`.

The active embedding model is `multilingual-e5-large-instruct-v1` (1024 dimensions).

## Parser v4 and promotion

A synthetic P265GH round-tube observation was inserted into worker staging inside a transaction and promoted through the real production `promote_worker_job` function.

Expected/observed result:

- parser version: `v4`;
- promoted observation count: 1;
- role method: `worker_v4`;
- grade: P265GH;
- standard: EN 10224 L275;
- OD: 406.4 mm;
- wall: 6.3 mm;
- length: 12,000 mm;
- price: EUR 68.38/m;
- canonical product ID present;
- confidence: 1.0;
- review count: 0;
- job observability event emitted.

The transaction was rolled back and residue checks returned zero jobs, threads, observations and reviews for the PAT marker.

## PAT blocker found and fixed — semantic indexing

The PAT discovered a real Foundation gap: 66 ready chunks from the most recent spreadsheet upload (`CLIENTI ITA ALESSIO.xls`) had no embedding for the active model. Ingestion/chunking had completed, but semantic indexing still depended on an operator-triggered embedding batch.

This was treated as a P0.12 blocker rather than accepted as historical backlog.

PR #49, `fix: complete semantic indexing for P0.12 PAT`, introduced a durable retrying semantic-index loop:

- resolves the active model from Supabase;
- incrementally selects only missing/stale chunks;
- embeds up to 128 chunks per batch;
- runs immediately at worker startup and periodically thereafter;
- retries provider/configuration failures without invalidating already-ingested documents;
- is idempotent and disabled in memory/test mode;
- includes regression tests and bounded environment controls.

PR #49 passed the P0 Required Gate and was merged as commit `620243fa9f97089c3f8b365850665d980f7d5c8e`.

Railway deployment `8a2e663b-45a8-4706-a7a9-3706f251ede6` completed successfully and `/health` returned HTTP 200.

Production provider telemetry then recorded a successful Hugging Face feature-extraction request for exactly 66 texts. Final active-model coverage became:

- chunks total: 1,413;
- chunks embedded with active model: 1,413;
- chunks missing active embedding: 0.

This is 100% active semantic-index coverage at PAT closure.

## Hybrid retrieval and provenance

### Steel tube commercial fact

A production hybrid query for P265GH 406.4 × 6.3 / EN 10224 L275 / EUR 68.38 returned the exact source chunk as result #1:

`P265GH 406,4x6,3x12000 - certificabile EN 10224 L275 - quantità 10 mt - € 68,38/mt`

The result included filename/document provenance and a `source_locator` down to the originating commercial observation.

### Newly indexed spreadsheet

After the semantic-index fix, a query for `A.M. MORSCIA Piacenza` using the newly generated active-model embedding returned the expected chunk from `CLIENTI ITA ALESSIO.xls` as result #1 with:

- vector similarity 1.0;
- lexical contribution present;
- document type `spreadsheet`;
- `source_locator.kind = spreadsheet_sheet`;
- sheet `Dati` and source offsets present.

This proves that the repaired embeddings are not only persisted but participate correctly in hybrid retrieval.

## Retrieval/RAG evaluation

The latest persisted production evaluation run uses:

- set version `v1`;
- embedding model `multilingual-e5-large-instruct-v1`;
- RAG model `Qwen/Qwen3-4B-Instruct-2507`;
- 52 total cases.

Latest run result: **PASS**.

Key metrics:

- case pass rate: 100%;
- positive MRR@10: 1.0;
- positive hit@10: 100%;
- positive recall@10: 96.21%;
- English recall@10: 96.21%;
- Italian recall@10: 96.21%;
- citation validity: 100%;
- provenance completeness: 100%;
- negative fail-closed rate: 100%;
- semantic RAG supported rate: 100%;
- detected fabrication rate: 0%.

All configured quality gates passed.

## Tenant isolation / RLS

Production RLS was exercised by setting authenticated JWT claims inside rollback transactions.

Active organization member visibility:

- organizations: 1;
- commercial observations: 1,350;
- knowledge documents: 377.

Authenticated but unaffiliated user visibility:

- organizations: 0;
- commercial observations: 0;
- knowledge documents: 0.

Tenant isolation therefore fails closed for an authenticated user with no membership.

## Observability

Production `observability_health(1440)` returned:

- contract `p0.9-v1`;
- `critical_issue_count = 0`;
- server 5xx = 0;
- request errors = 0;
- stale processing jobs = 0;
- failed jobs in window = 0.

The PAT semantic-index repair also emitted provider telemetry containing provider, model, input-character usage, latency/status metadata and no provider error.

Railway raw stderr severity is not used as a health signal because normal Uvicorn INFO startup messages are written to stderr by the runtime.

## Entity resolution health

Production entity-resolution health remained `critical_issue_count = 0` with:

- no canonical duplicates;
- no alias collisions;
- no cross-tenant grounding;
- no confidence overclaim;
- no stale resolver mentions;
- no canonical-key mismatch.

Six historical mentions without exact chunk grounding remain informational because their source-observation provenance is present; they are not classified as a critical issue.

## Data lifecycle / export / retention

P0.10 controls were exercised in non-destructive mode:

- tenant export manifest generated successfully;
- tenant export snapshot generated successfully (~2.54 MB JSON at PAT time);
- manifest represented 10,340 rows including rebuildable/operational data;
- Storage objects declared: 2;
- Storage objects physically present: 2;
- Storage objects missing: 0;
- retention dry-run candidates: 0;
- retention deleted rows: 0;
- tenant delete dry-run: true;
- authoritative tenant rows deleted: 0;
- delete contract still requires exact tenant confirmation and Storage-first deletion.

No destructive lifecycle action was executed.

## CI/CD and production runtime

The P0.12 blocker fix passed the protected-main `required` GitHub Actions gate before merge and again after merge.

Production Railway:

- source branch: `main`;
- P0.12 fix deployment: SUCCESS;
- `/health`: HTTP 200;
- path-scoped deploy rules remain active.

## Supabase Advisors

Security Advisor:

- no new P0 structural security finding;
- only pre-existing `Leaked Password Protection Disabled` warning remains.

Leaked-password protection is a paid/pre-pilot control and is intentionally not a Free-tier internal P0 blocker.

Performance Advisor:

- only `unused_index` INFO findings;
- no new structural performance warning.

## PAT harness note

An attempt to create an isolated Railway helper to issue a brand-new multipart HTTP upload initially used the wrong form-field name (`file` instead of the worker contract's `upload`) and correctly received HTTP 422. The corrected helper deployment required Railway dashboard 2FA and was not used as acceptance evidence.

Therefore the final PAT evidence deliberately combines:

- real production uploads and knowledge corpus;
- current parser-v4/promotion behavior exercised in rollback;
- current production semantic-index behavior after the P0.12 fix;
- direct current hybrid retrieval;
- persisted current RAG evaluation;
- current RLS, observability and lifecycle checks.

No claim is made that a new v4 document was uploaded through the HTTP ingress during this PAT session.

## Remaining administrative cleanup

A temporary Railway helper service named `p0-12-smoke-test` was created solely for the abandoned HTTP harness. Its removal is staged in Railway but committing that deletion requires dashboard 2FA. The helper has no role in production application traffic and the main `steel-sales-ai` service is unaffected.

P0.12 should be marked fully complete after that temporary service is removed and the Railway environment shows no staged changes.

## Pre-pilot gates intentionally outside internal P0 closure

The following controls remain mandatory before external/customer pilot, but do not require paid infrastructure during internal P0/P1 development:

- managed database backup / PITR;
- offsite Storage backup;
- measured restore rehearsal;
- Supabase leaked-password protection / appropriate paid Auth controls.

## Repeatable PAT checklist

1. Verify protected `main` and green `required` gate.
2. Verify Railway main deployment and `/health`.
3. Record tenant corpus counts and P0 health contracts.
4. Exercise parser v4 + promotion in rollback and verify canonical product identity/review behavior.
5. Assert every knowledge chunk has the active embedding or wait for the semantic-index retry loop to drain backlog.
6. Run a direct hybrid retrieval against a known commercial fact and verify `source_locator` provenance.
7. Confirm the latest retrieval/RAG evaluation passes all quality gates.
8. Execute member and unaffiliated RLS visibility tests in rollback.
9. Verify observability/entity-resolution critical issue counts are zero.
10. Generate export manifest/snapshot; validate Storage paths; execute retention/delete only as dry-runs.
11. Run Supabase Security and Performance Advisors.
12. Remove PAT-only infrastructure and confirm no staged environment changes remain.
