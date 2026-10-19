# NET-PROFILE1E — First bounded worker batch

The program runs one approved official website at a time (25 companies maximum, 3 pages/site). The manifest is an operator-reviewed JSON array of `{"kind":"discovered","company_id":"UUID","site":"https://official.example"}`. Do not accept caller-supplied company IDs or arbitrary URLs from a public API.

```sh
cd services/worker
python -m app.network_profile_batch --manifest /secure/approved-company-sites.json
# After dry-run quality review only:
python -m app.network_profile_batch --manifest /secure/approved-company-sites.json --persist
```

Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server-side only when `--persist` is set. This produces **candidate** evidence only, never publishes or verifies companies. Existing robots, SSRF and HTML limits are enforced by the shared company fetcher. Errors in one site currently stop the batch if not caught by the extractor; record the failed site and resume with a smaller manifest. Never schedule unattended ingestion before a successful Railway CLI invocation, live database receipt verification, site-domain binding and rollback validation.

The 3-company / 6-evidence earlier pilot was manually sourced. It does **not** verify this batch runner's real network or database execution.
