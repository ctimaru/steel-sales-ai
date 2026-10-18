# NET-PROFILE1C.3 — Evidence ingestion

The CLI is **not** a public route, a recurring job or an unattended scraper.

Operator workflow, after verifying the source URL belongs to the given company:

```sh
cd services/worker
python -m app.network_profile_persistence --kind discovered --company-id <known-uuid> --site https://official-company.example
# Review source URL and candidate preview; only then opt in to persistence:
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python -m app.network_profile_persistence --kind discovered --company-id <known-uuid> --site https://official-company.example --persist
```

Production secrets must reside exclusively in the worker environment. Nothing in this flow publishes a profile, changes a claim/verification state, or triggers a connection request.

Safeguards: official HTTPS input only; 1 site/run; maximum 3 pages; robots/SSRF/redirect/response-size controls delegated to established hardened fetcher; personal contacts redacted; maximum 20 candidate fields; server RPC restricts service role; verifies company/discovery UUID exists; dedupe by company/field/source/extractor version; private table with RLS and no browser roles; rejected/accepted fields never supplied by worker.

The discovered-record source is a **view**, not a physical table. The migration intentionally stores the discovered UUID without an invalid foreign-key constraint and checks its existence during privileged ingestion.

**Next step:** small approved pilot with authoritative company sites and quality sampling; automate queue only after validating source-domain binding, deletion requests, and retry/rate budgets.
