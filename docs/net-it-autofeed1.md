# NET-IT-AUTOFEED1 — Continuous authorized discovery

## Baseline (24 November 2026)
2,786 canonical Italian published companies; crawler queue empty. MASS11J.A has 65 screened fresh website pointers, not companies. See issue #1341 comment 7133765067. SEED1 owner policy active through 11 December 2026. Prior Overture batch source disabled; do not re-enable it or imitate a Platform user's JWT.

## A — This draft
Pure, bounded selection from licensed Overture audit CSV, with immutable audit URL, explicit industrial categories, unique domains, source license and GERS evidence. No write, no claims, no new permissions. Unit tests included, not yet executed by CI.

## B — Required integration before production
- Register a durable Overture source once using the genuine authorized Platform user via existing net_it_seed1_add_source; source URL exactly https://docs.overturemaps.org/guides/places/#sss-autofeed-v1. Do not use the generic HTML crawler for this marker. Extend existing harvest worker to dispatch the special source to the licensed dataset adapter. Do not change other sources or schedules.
- Recurring collection must keep only website pointers from eligible Italian records; scan pinned dataset release, verify per-record license, retain immutable audit artifact and GERS. Use deterministic pagination/rotation and bounded runtime; no credentials in audit jobs.
- Add an explicitly reviewed atomic intake endpoint only for backend service_role and this owner-registered enabled source. Reuse private.net_it_seed1_stage_impl; require active SEED1 policy; lock the source and enforce max 250 per call and queue low-water/high-water thresholds (proposed 100/500), bounded daily intake. Validate domain, taxonomy, release, GERS, approved audit provenance; dedup across canonical/candidates/seeds/suppression/SEED1. In the same transaction, attach provenance in private.net_it_overture_provenance only to matching staged domains; any provenance failure rolls back the batch. No identity or publication changes. No generic definer endpoint exposed; preserve existing ACL pattern, no anon/auth access.
- Make the recurring worker skip when queue >= low-water, source disabled or policy expired. Log counts, no identities from third-party source. AUTO2/AUTO3 remain unchanged. Existing crawler handles robots/SSRF/first-party verification.
- Keep a single source with durable cursor/checkpoint so already-known early rows cannot starve subsequent pages. Use 65 MASS11J.A domains as first canary after live dedup and audit verification. No manual approval per company.

## Acceptance before merge/deploy
1. Tests: malformed audit, rights, region, taxonomy, dedup, conflicting GERS, immutable source, bounds; database tests for missing source, expired policy, disabled source, anon/auth denial, atomic rollback, duplicate idempotency and concurrent calls, low-water behavior, no publication.
2. Confirm protected CI, migration and worker deployment in normal release window. No new cron.
3. Verify production readback: source registered by actual authorized actor; queued domains = provenance rows; first-party visits, evidence verdicts, actual publications and net canonical totals. Demonstrate automatic refill across two scheduled cycles.
4. Do not report A as a live refill. B, integration tests and authorized source registration remain outstanding.

## C — Resume safety (review draft)
The special source carries a durable audit URL/release/domain cursor in its existing last_result; the source claim returns that checkpoint only for this marker. Successful staging and provenance update the cursor in the same transaction; capacity holds do not move it. A new immutable audit restarts selection, with live dedup still authoritative. URL shorteners are rejected by selector and database. Recurring Overture audit generation, a production migration, CI and Platform source registration remain prerequisites; this is not a live refill.
