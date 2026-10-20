# SUPA-LEDGER1 — Global Supabase migration history reconciliation

**Status:** read-only forensic audit, 20 October 2026. No migration repair, database DDL, deployment or source publication performed.

## Why #780 cannot safely be closed by repairing only 7 EU trader versions

Production Supabase **list_migrations** was compared to GitHub `supabase/migrations/*.sql` from main using the exact migration *name* and *14-digit version*.

At the first complete readback:
- GitHub migration files: **435**.
- Remote migration history rows: **464**.
- Exact name+version: **93**.
- Same name, different version: **330** (including the 7 TRADER1A–D.2 entries).
- Local-only names: **12**.
- Remote-only names: **36**.
- Duplicate remote names: **6**.
- Not checking the underlying SQL byte-for-byte, so identical names **DO NOT** establish identical schema.

The remote list subsequently grew to **465** records while the audit was being prepared: `20261020125416_netit_identity2b_discovery_links` was newly recorded. The checked-in `supabase/audits/20261020_migration_history_snapshot.json` is an explicit **read-only timestamped snapshot**, not a promise that production is static. A live preflight is mandatory immediately before a future fix.

The 7 known pairs are just one part of the 330+ mismatches:
| Remote version | GitHub migration |
|---|---|
| 20261020110925 | 20261020160000_netdata1eu_trader1a_research_foundation |
| 20261020110953 | 20261020160500_netdata1eu_trader1b_firstparty_pilot |
| 20261020110955 | 20261020161000_netdata1eu_trader1b2_source_research |
| 20261020110957 | 20261020161500_netdata1eu_trader1c1_source_research |
| 20261020111000 | 20261020162000_netdata1eu_trader1c2_source_research |
| 20261020111030 | 20261020201000_netdata1eu_trader1d_review_readiness |
| 20261020111032 | 20261020212500_trader1d2_superadmin_review_console |

### Why automated bulk repair is not permitted

Names are not immutable checksums. Additional historic remote-only records and duplicate names mean a bulk "revert remote / apply local" replacement could falsely mark SQL as applied, erase historical sequencing evidence, or make `supabase db push` re-execute an already-applied DDL. A correct repair needs classification and schema equivalence for **the entire history**, not only the seven EU research entries.

The Supabase CLI has a sanctioned history command (`supabase migration repair --status applied|reverted`); the connected Supabase MCP currently does not expose that operation. The CLI command changes **migration history rows only**, not the database schema: https://supabase.com/docs/reference/cli/supabase-migration-repair.

## Implemented: safe repeatable audits

- `supabase/tools/migration_ledger_audit.py`: read-only independent classifier, deterministic 14-digit file parsing, full name+version exact checks, same-name version mismatch, missing on either side, duplicate names/versions; optional `--require-clean` exit code 2. Never accesses a live database or mutates files outside its explicitly selected report output.
- `supabase/tools/test_migration_ledger_audit.py`: offline unit tests covering clean histories, ambiguous names, orphans and input validation.
- `supabase/audits/20261020_migration_history_snapshot.json`: complete observed remote version/name index exported from a **read-only** connector call; no credentials or business records.
- `.github/workflows/supa-ledger1-history-audit.yml`: PR snapshot diagnostic and artifact (30 days). Separately, a manual `workflow_dispatch` option `linked_cli=true` performs an **official read-only Supabase CLI migration list** on main if GitHub repository secrets `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` have been explicitly configured. Project ref hardcoded to `ecrafjdummcdfycznitx`, no DDL, no repair, no push. Does not use the less-privileged company crawler `sb_secret_` key for CLI.

## Controlled next decisions

1. Run the offline audit on main (automatic on PR, available by manual dispatch after merge); archive full machine diff.
2. With **properly protected GitHub secrets**, manually launch [SUPA-LEDGER1 workflow](https://github.com/ctimaru/steel-sales-ai/actions/workflows/supa-ledger1-history-audit.yml) with linked audit checked; inspect actual local/remote migration list. No operational staff should paste secrets into issues, Notion, chat or source code.
3. Classify the 330 mappings by provenance and compare source file SQL to remote history SQL when available; check all 12 local-only, at least 36 remote-only and 6 duplicate names. Distinguish intentional legacy/CI-only baselines from omitted production changes. Importantly, the dynamic remote record count might have increased since the snapshot.
4. Create a separate explicit **protected and reviewed repair plan**, restricted to independently verified equivalent versions. Confirm no unrelated production deploy/migration is running during the repair window. Use official `supabase migration repair` operations only if full history alignment and rollback/audit are planned; do not modify `supabase_migrations.schema_migrations` using SQL.
5. Verify whole-project local/remote alignment via official linked CLI before applying *any* new versioned schema migration (including `20261020233000_trader1d3b2_live_source_intelligence.sql`). No `supabase db push` before reconciliation. The TRADER1D.3B.2 workflow remains opt-in disabled.

## Business / UX constraint

Continue existing published Network and bounded read-only HEAD source monitor; **no human per-company approval requirements**, **no publication of private EU dossiers**, and the claim/self-service ownership model remains the target. Code for 3B.2 is on main but the private ledger and RPCs remain unapplied until the migration blocker is resolved.
