# SUPA-LEDGER3B — Critical SQL Difference Analysis

20 October 2026. This block prioritizes **59 internally differing stored migration SQL texts** after SUPA-LEDGER1/2/3. No database DDL, migration repair, public Network mutation, personal data extraction or per-company human verification.

## Evidence and limitations

- Read-only historical snapshots show 436 repository migrations and 465 recorded remote migrations at extraction; the live ledger later advanced to 466. The report is **time-bound**.
- Of the original 115 same-name byte-different SQL pairs, 56 differ only in outer ASCII whitespace; **59 contain internal text differences** and cannot be declared equivalent.
- `supabase/tools/migration_sql_critical_risk.py` uses existing provenance reports and checks only **local SQL text** for security/authorization, company identity, Network entities and data-write keywords. This creates a **review priority**, not a claim that remote SQL differs in behavior.
- Explicit categories: `P0_SECURITY_OR_OWNERSHIP`, `P1_NETWORK_OR_DML`, `P2_GENERAL_SQL_OR_COMMENTS`. Keyword hits inside comments are intentionally treated conservatively. All 59 remain `requires_actual_remote_sql_comparison` until their **specific original remote stored SQL** is inspected securely.
- GitHub Actions `.github/workflows/supa-ledger3b-critical-sql-audit.yml` runs a no-secret/no-DB unit suite, regenerates the exact 59-case source report, prints limited priority names and archives a full per-migration queue. No `supabase db push`, `migration repair`, SQL history edits or promotion.
- The existing 7 EU TRADER1A–D.2 migrations were directly compared, **7/7 SQL character-identical** with only mismatched versions; they are not a substitute for full project migration-history repair.
- Priorities for follow-up comparison: RLS policies and grants first; SECURITY DEFINER RPCs and ownership/claim functions next; company/network DML and data migrations; then ordinary SQL and comments. For each case compare original remote SQL and GitHub source, extract *only* minimal structural differences into reviewed evidence, and cross-check current database object definitions and authorization.

## Release gates

1. Run the SUPA-LEDGER3B risk report and review all 59 category assignments.
2. For any proposed equivalent migration, compare actual executed SQL and local SQL using a SQL-aware tokenization procedure, respecting quoted strings, dollar-quoted blocks, block comments, and semicolon/order sensitivity. Simple whitespace collapsing is **not proof**.
3. Classify local-only, remote-only and duplicated historical names independently; verify current database schema and data effects, do not replay already applied DDL.
4. Run official protected linked Supabase CLI `migration list --linked` against the **current** project, inspect any intervening migrations and prepare a separate fully reviewed repair plan.
5. Keep new TRADER1D.3B.2 live source writeback disabled until full history alignment and its versioned SQL deployment are verified. The legacy bounded HEAD monitor remains functional.

References: [issue #780](https://github.com/ctimaru/steel-sales-ai/issues/780), [SUPA-LEDGER3 #794](https://github.com/ctimaru/steel-sales-ai/pull/794).
