# SUPA-LEDGER3 — Migration SQL divergence triage

**20 October 2026 — read-only audit**; no database migration, CLI repair, SQL writes, company approvals or Network publications.

## Why
SUPA-LEDGER2 proved all seven TRADER1A–D.2 applied SQL strings are identical to GitHub, and found a global production/repository drift: 436 GitHub migrations, 465 remote SQL entries, 269 identical original SQL bytes with changed timestamp, 33 exact byte+name+version matches, 115 same-name-but-different-original-SQL bytes, 7 ambiguous local duplicate-name cases, 12 local-only and 36 remote-only. Those 115 SQL differences must be triaged before the global migration repair design.

## Evidence captured
From the original SQL stored in `supabase_migrations.schema_migrations.statements[1]`, read-only SQL generated three additional **SHA-256 fingerprints** and one byte length per each of 465 original migration statements:
- LF-normalized text: converts CRLF/CR to LF.
- LF text with only outer ASCII space/tab/newline trimmed.
- LF text after *all* ASCII whitespace runs collapsed to a single space. **Only a forensic candidate:** does NOT prove SQL semantics; whitespace in a string or dollar-quoted SQL function can change its meaning.
- Byte length of LF text.

No SQL body, personal/organization data, contacts, prices, credentials, or migration repair authorization was exported. Production `list_migrations` snapshots were equal both **before and after** five bounded read-only fingerprint queries. Snapshot: `supabase/audits/20261020_migration_normalized_sql_sha256_snapshot.json`. This is a dated forensic observation; refresh before any production release.

## CLI-free repeatable report
Run offline from repository root:

```bash
python -m unittest discover -s supabase/tools -p 'test_migration_sql_divergence_audit.py' -v
python supabase/tools/migration_sql_divergence_audit.py \
  --local supabase/migrations \
  --raw-remote supabase/audits/20261020_migration_sql_sha256_snapshot.json \
  --normalized-remote supabase/audits/20261020_migration_normalized_sql_sha256_snapshot.json \
  --report migration-sql-divergence-report.json
```

GitHub Actions `.github/workflows/supa-ledger3-divergence-audit.yml` runs this analysis in CI without tokens, DB access or writes, and archives the full per-migration classification.

## Strict classification

1. `line_endings_only`: CRLF/CR vs LF difference, with normalized bytes identical. Original stored SQL text differs but line-ending transformation matches exactly.
2. `outer_whitespace_only`: same after removing ONLY outer ASCII spaces, tabs and newlines. Common file-end formatting; not an authorization to alter history.
3. `global_whitespace_candidate_UNSAFE`: same only after collapsing ALL whitespace, **including within string literals/dollar-quoted blocks/comments**. THIS IS NOT SEMANTIC EQUIVALENCE and requires inspecting SQL in a controlled environment.
4. `substantive_text_divergence_or_comments`: all three fingerprints differ. May be comments, changed SQL, DDL/DML permissions, data seeds, or something else; deeper differential review required.
5. `ambiguous_duplicate_name`, `only_in_local`, `only_in_remote`: remain separately blocked; no silent inference of what SQL should exist in production.

Results are descriptive only. No automated `supabase migration repair`, `supabase db push`, or change in the private EU research data is permitted by this classification.

## Next release-safe steps
- Assess clusters in category 4 with human **engineering** review of migrations (NOT per-company human verification). Query only **specific stored migration SQL** via approved read-only Supabase tool and compare against repository source. Store minimal summaries/object-level differences, not content or secrets.
- Evaluate duplicate-name records and remote-only entries independently. The CLI tool currently connected cannot launch an official `migration repair`; use the protected `SUPA-LEDGER1` linked `migration list` workflow after configuring appropriate GitHub secrets. It is read-only.
- Create a separately reviewed **full 436/465-repository history reconciliation plan**, ensuring the current database objects and permissions correspond to recorded migrations; only then use an approved official Supabase CLI repair. No seven-entry partial fix or blind bulk repair.
- After global alignment verify, the already-merged TRADER1D.3B.2 migration can be applied once via approved release pipeline; then enable the opt-in live source monitor. Current legacy bounded HEAD monitor remains active; no public/rights/claim changes.

Links: [SUPA-LEDGER1 #790](https://github.com/ctimaru/steel-sales-ai/pull/790), [SUPA-LEDGER2 #793](https://github.com/ctimaru/steel-sales-ai/pull/793), [global dependency #780](https://github.com/ctimaru/steel-sales-ai/issues/780).
