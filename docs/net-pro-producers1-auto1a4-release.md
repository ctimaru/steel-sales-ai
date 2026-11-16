# NET-PRO-PRODUCERS1.AUTO1.A.4.2 — Protected release / canary

## Scope and safety
- Source: `ctimaru/steel-sales-ai`, PR #1371, Railway service `net-producers-auto1`, Supabase production project `ecrafjdummcdfycznitx`.
- A.4 creates only **private candidates** with `pending_verification`; do not show them as proven tube producibility.
- A.3 migration must already be present. `NETPRODUCERS_A4_ENABLED` is **false by default**.
- Do not modify AUTO2/AUTO3 or create another SKU. No Vercel release required for backend-only code.

## Preconditions (stop if any check fails)
1. Branch contains current `main` and required CI `P0 Required Gate` is successful on the exact head SHA. Protected merge; never force.
2. Remote migration list includes A.3 queue/verifier once, but excludes A.4 queue. **Never run A.4 twice**. Compare git file hash and remote version history; beware existing history drift.
3. Verify Railway service source is `ctimaru/steel-sales-ai`, deployment uses the existing `services/worker/Dockerfile`, start command `python -m app.net_pro_producers_auto1 --persist --limit 10`, and only this worker gets updated. Preserve existing secret keys and cron.

## Apply and read back
- Apply `supabase/migrations/20261116201000_net_pro_producers1_auto1a4_detail_queue.sql` using the protected production migration channel **once**; note remote version might differ, so identify by migration name and installed schema, not just timestamp.
- Read back `private.network_producer_auto1_detail_pages` and `private.network_producer_auto1_detail_candidates` existence, RLS enabled, counts, and service-only RPC privileges. Verify SELECT/EXECUTE denied to `anon` and `authenticated`. Do not run test SQL designed for local rollback against production.
- Preserve existing Railway pin until the DB is ready, then pin **only** `net-producers-auto1` to merged SHA and verify Dockerfile build/run.
- Canary should first run **1–3 first-party pages**, not hundreds, and check website robots, HTTPS and source domain; set `NETPRODUCERS_A4_ENABLED=true` only after deployment with compatible schema.
- Read back source page `id/source_url/last_sha256`, parent page hash, detail page `status/last_sha256`, private candidate `source_url/source_sha256/locator/shape/grade/standard/dimensions_mm/evidence_status`, and `published_capabilities=0`. Zero matches is valid, report candidly.
- Confirm unchanged pages were not repeatedly fetched and stale page hashes do not remain eligible. Record actual processed, blocked, failed, pending; do not invent counts. Restore stable cron 20 min if temporarily adjusted.
- Fail closed: disable `NETPRODUCERS_A4_ENABLED` on unexpected parser, rights, schema or origin errors. Do not publish any technical tuple until claim-by-claim evidence verifier AUTO1.A.4.3 exists.

## Edge cases
- If `main` changes before merge: integrate its changes again and rerun checks.
- If local Supabase rebuild passes but production migration fails: leave Railway flag off; do not retry blindly or manually patch migration history.
- If Railway source pin won't deploy selected merged SHA: stop; never use an old `redeploy` build to claim a new version.
