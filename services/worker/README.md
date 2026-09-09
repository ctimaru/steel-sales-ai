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

## Configuration

Required production environment:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only; never expose to the browser)
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
