# Steel Sales AI Worker

Python/FastAPI service for document ingestion and commercial extraction.

## Current scope

- ZIP / EML / PDF / XLS / XLSX upload through POST /v1/uploads
- private Supabase Storage bucket: commercial-uploads
- 25 MB upload limit
- job status through GET /v1/jobs/{job_id}
- parser v3.1 input classification boundary
- structured latest-price query through POST /v1/ai/latest-price

## Required production environment

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (server-side only; never expose to the browser)
- SUPABASE_UPLOAD_BUCKET=commercial-uploads
- WORKER_INTERNAL_TOKEN

For local tests, set WORKER_STORAGE_MODE=memory.

## Next implementation slice

1. Replace the in-memory job registry with a durable jobs table.
2. Invoke the existing parser v3.1 implementation for each classified input.
3. Persist staging output and expose Review Queue records.
4. Add authenticated frontend upload route.
5. Deploy privately on Railway with the environment variables above.
