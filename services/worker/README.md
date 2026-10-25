# Steel Sales AI Worker

Python/FastAPI service for document ingestion and commercial extraction.

## Current scope

- ZIP / EML / PDF / XLS / XLSX upload through POST /v1/uploads
- private Supabase Storage bucket: commercial-uploads
- 25 MB upload limit
- durable job status through Supabase `worker_jobs`
- extracted staging rows through Supabase `worker_staging_observations`
- parser v3.1 input classification boundary
- structured latest-price query through POST /v1/ai/latest-price
- Railway-ready Docker deployment
- PL1 governed manufacturer price-list PDF preview/staging through `/v1/price-lists/import/preview` and `/v1/price-lists/import/stage`

## Configuration

Required production environment:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY` (preferred backend-only key; never expose to the browser)
- `SUPABASE_SERVICE_ROLE_KEY` (temporary legacy fallback during verified cutover)
- `SUPABASE_UPLOAD_BUCKET=commercial-uploads`
- `WORKER_INTERNAL_TOKEN`

The worker uses durable Supabase mode by default. For local tests only, set:

```text
WORKER_STORAGE_MODE=memory
```

The web app calls the worker through the server-side variables:

- `WORKER_URL`
- `WORKER_INTERNAL_TOKEN`

The token must be configured in Railway and Vercel, never in client-side code.

The API consumers use the shared credential resolver; new `sb_secret_` keys are
sent as `apikey`, not as a Bearer JWT. Migrating the API does not retire legacy
keys used by operator scripts, Edge Functions or CI. Follow the
[SEC-P0 closure dossier](../../docs/security/sec-p0-launch-closure-20261025.md)
before revocation.

## Railway

Create a Railway service from the repository root. Railway uses `railway.json` and `services/worker/Dockerfile`, exposes the `/health` endpoint, and supplies the public `PORT`.

Set the production variables above, deploy, then verify:

```text
GET https://<worker-domain>/health
```

After deployment set `WORKER_URL` in the web deployment to the worker's HTTPS URL and redeploy the web app.

## Local checks

```bash
cd services/worker
pip install -e '.[test]'
WORKER_STORAGE_MODE=memory pytest
```


## PL1 price-list import

The PL1 import boundary is deliberately separate from the general commercial-document parser.

- `POST /v1/price-lists/import/preview` parses a supported manufacturer PDF without persistence and returns metadata, validation diagnostics, pricing-rule extraction, summary counts and a bounded row sample.
- `POST /v1/price-lists/import/stage` requires a draft/review `price_list_version_id` plus its immutable `source_document_id`. The uploaded PDF SHA-256 must match the source document before staging can be accepted.
- The first adapter is `padana_ptc` (`pl1.4-padana-ptc-v1`).
- The parser uses embedded PDF text via pypdf. It does not silently fall back to OCR.
- Staged rows remain isolated from published `price_list_items`; PL1.5 owns controlled promotion after review.

The Padana adapter preserves Base and fixed Extra as separate components, extracts the cover commercial-discount rule, stages the logistics-efficiency rule with a bundle-master-data review requirement, and preserves source ambiguities instead of guessing a standard or grade.
