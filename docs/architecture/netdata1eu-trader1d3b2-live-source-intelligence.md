# TRADER1D.3B.2 — Live Source Intelligence

2026-10-20 · Private EU trader research; automated source monitoring, company-claim-first product policy.

## Shipped implementation (PR)
- Service-only live feed: public.trader1d3b2_source_batch reads current private.netdata1eu_trader_research role/product source URLs (distinct first-party pages only), max 5/run, with deterministic UTC-day rotation over a dynamically counted inventory. Updated dossiers enter automatically; no GitHub snapshot dependency.
- Existing safe robots/SSRF-guarded corporate HEAD method checks only HTTP metadata; no website HTML/company-content downloads, scraping, contact collection, legal verification, license assumption or claims.
- Idempotent, immutable private.trader1d3b2_source_observations ledger: one observation per research UUID / source kind / UTC date; source URL and domain rechecked against the CURRENT private dossier at commit, preventing stale-URL evidence. Reject stale (>24h)/future (>5min) observations, invalid status, fingerprints or batches >5. Duplicate same-day submissions do not rewrite history.
- Server computes latest per-source URL and metadata fingerprint change class; old URL observations never validate a new source. Distinguish HTTP HEAD availability from semantic company or steel-product facts.
- Owner-only public.trader1d3b2_owner_health(p_ids uuid[]) checks active singleton owner in SQL and returns latest metadata for at most 25 private dossier IDs. Dashboard displays each sourced date/status, or explicit unavailable state when backend not activated. No new browser table grants.
- Production workflow is gated by GitHub repository variable TRADER1D3B2_ENABLED=true. Until explicitly enabled, old bounded manifest monitor remains the active daily job, and new workflow cannot write to Supabase. Both share a concurrency scope after cutover.
- Existing dedicated service-only CRAWL_IT65B_SUPABASE_URL / CRAWL_IT65B_SUPABASE_SECRET_KEY environment is reused after schema activation. Never expose or log keys.
- No publication, source-rights update, company claim modification or mandatory human review.

## Blocker #780: reconciled migration history BEFORE ANY deployment

Supabase remotely recorded generated timestamps for seven TRADER1A–D.2 migrations which differ from the committed SQL filenames. The seven mappings:

Remote timestamp -> repository timestamp / migration
- 20261020110925 -> 20261020160000 netdata1eu_trader1a_research_foundation
- 20261020110953 -> 20261020160500 netdata1eu_trader1b_firstparty_pilot
- 20261020110955 -> 20261020161000 netdata1eu_trader1b2_source_research
- 20261020110957 -> 20261020161500 netdata1eu_trader1c1_source_research
- 20261020111000 -> 20261020162000 netdata1eu_trader1c2_source_research
- 20261020111030 -> 20261020201000 netdata1eu_trader1d_review_readiness
- 20261020111032 -> 20261020212500 trader1d2_superadmin_review_console

Safe operator release checklist (NOT executed in this PR):
1. Use the officially documented Supabase CLI and approved production project credentials in a protected linked release environment. Run supabase migration list --linked and compare all migrations and applied schema objects; retain audit evidence.
2. Once approved and only for confirmed mappings, use supabase migration repair <remote-version> --status reverted followed by supabase migration repair <repo-version> --status applied. These commands adjust the migration HISTORY ONLY, not schemas. Do NOT run db reset/push, edit supabase_migrations.schema_migrations via raw SQL or rerun the original seven migrations.
3. Re-run supabase migration list --linked and validate full local/remote alignment including other project migrations; resolve any additional drift before proceeding. Docs: https://supabase.com/docs/reference/cli/supabase-migration-repair.
4. After reconciliation, apply the new single versioned migration supabase/migrations/20261020233000_trader1d3b2_live_source_intelligence.sql via the same approved release path. Verify source count, RLS, anon/auth deny, service grants, owner-only RPC and zero initial observation rows.
5. Only then set TRADER1D3B2_ENABLED=true and dispatch the live workflow. Read back first real observations, 0 manual decisions, 0 source-rights approvals and unchanged canonical published companies. Inspect the owner console with a real authenticated superadmin session.

## Acceptance automation
- SQL: supabase/tests/trader1d3b2_live_source_intelligence.sql runs inside ROLLBACK transaction, tests live bounded page, non-owner read/write denial, forged URL rejection, same-UTC-day replay idempotency and immutability.
- Python: services/worker/tests/test_trader1d3b2_live_refresh.py tests safe source validation, daily rotation, inventory-change abort, no publishing and service response limits.
- Frontend: apps/web/tests/trader1d3b2-live-source-intelligence.test.mjs; UI-specific live/unavailable status; existing P0 checks, typed build, SEC1/HP13 source-only allowlist.
- No automatic semantic-content relevance extraction yet; this is transparent HTTP metadata intelligence, not confirmed company identity or legal rights.

Related: TRADER1D.3B.1 PR #784, production migration drift issue #780, roadmap #782. Next: rights-safe company publication 3C, self-service claim 3D.
