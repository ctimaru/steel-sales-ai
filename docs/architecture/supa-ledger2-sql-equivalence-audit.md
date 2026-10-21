# SUPA-LEDGER2 — Byte-exact SQL migration equivalence

Date: 2026-10-20. **Read-only forensic enhancement to SUPA-LEDGER1. No remote history modification.**

## Why byte equality is necessary

Project-wide migration history has 436 local SQL files and 465 remote Supabase entries; only 93 matching name+version pairs, 331 corresponding names with different 14-digit IDs, and multiple orphan/duplicate names. Matching migration *names* alone does not prove that identical SQL was deployed.

The production Supabase `supabase_migrations.schema_migrations` table retains the original SQL statement bytes in a `statements` array. A read-only query confirmed all 465 remote entries have exactly one stored SQL item. PostgreSQL built-in `sha256(convert_to(statements[1],'UTF8'))` returns an SHA-256 fingerprint without exporting SQL statements from the connected database.

The tool saved `supabase/audits/20261020_migration_sql_sha256_snapshot.json`: each remote record's **version, migration name, stored SQL byte count and SHA-256**; no database URL, credentials, personal data or SQL text. It was produced in five read-only batches, with the full `list_migrations` compared before and after extraction; both lists were identical. The checked-in snapshot can become stale as unrelated migrations continue to be applied.

## Directly verified European research migrations

Before this snapshot, the seven TRADER1A–D.2 original production SQL strings were directly compared with the corresponding GitHub file content, with **all seven character-for-character identical** (no whitespace normalization):
- netdata1eu_trader1a_research_foundation
- netdata1eu_trader1b_firstparty_pilot
- netdata1eu_trader1b2_source_research
- netdata1eu_trader1c1_source_research
- netdata1eu_trader1c2_source_research
- netdata1eu_trader1d_review_readiness
- trader1d2_superadmin_review_console

They have different version IDs despite identical recorded SQL. This fact helps design a future official history repair; **it is not permission to run a seven-only fix while the rest of the project's history remains divergent**.

## Automated reproducible classification

`supabase/tools/migration_sql_fingerprint_audit.py` computes `hashlib.sha256(path.read_bytes())` on local source SQL files and compares the original byte count and fingerprint to the recorded remote ledger.

A source file is classified into exactly one:
- `exact_version_and_sql`: same name, timestamp and original SQL bytes.
- `identical_sql_different_version`: same name and SQL bytes, different timestamp.
- `different_sql_same_name`: same name, but original submitted SQL is different (even if versions match). Requires manual engineering investigation of the **migration history**, not human company verification.
- `only_in_local`: migration name absent from remote; do not automatically apply SQL.
- `ambiguous_duplicate_name`: duplicate name on either side; never resolve with simple version rename.
- `only_in_remote`: remote record absent from GitHub by name, reported separately.

This is **metadata equivalence, not schema state equivalence**: even a byte-identical original migration does not prove current relations, function definitions or policies remained unchanged by later DDL. Differences may arise from formatting, SQL updates, superseding migrations or remote replays. The report cannot and must not execute `supabase migration repair` or `db push`.

## CI / execution

`.github/workflows/supa-ledger2-sql-audit.yml` runs tests and produces `migration-sql-equivalence-report.json`, including per-migration categories and aggregate counts, uploaded as a GitHub artifact with a 30-day retention. It fails closed if the **seven known EU migrations** do not classify as byte-identical SQL with mismatched timestamps. No database credentials or API calls required in CI; it operates on the checked-in time-stamped hash snapshot. CI can be rerun without production impact.

A new SHA-256 snapshot is required if new production migrations land or the SQL stored history changes. A full live linked CLI inspection and separately reviewed reconciliation plan remain required by [#780](https://github.com/ctimaru/steel-sales-ai/issues/780). Never infer this branch authorizes a bulk `repair` from its classification.

## Release boundary

This audit does not apply the blocked TRADER1D.3B.2 migration `20261020233000_trader1d3b2_live_source_intelligence.sql` and does not enable `TRADER1D3B2_ENABLED`. Existing bounded HEAD source monitor continues; no company publication, rights updates or centralized human verification.
