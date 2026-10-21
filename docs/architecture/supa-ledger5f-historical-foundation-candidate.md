# SUPA-LEDGER5F — Source-Verified Historical Foundation Reconstruction Gate

**Smart Steel Sales · 21 October 2026 · Supabase issue [#780](https://github.com/ctimaru/steel-sales-ai/issues/780)**

## Outcome and boundary

SUPA-LEDGER5E identified the first strict-rebuild blocker, `public.commercial_datasets`, while applying `20260912150428_promote_worker_jobs_to_commercial_dataset.sql`; the authentic production predecessor is `20260907192936_create_app_facing_commercial_read_models`, including the associated schema, RLS policies and grants.

**This microblock implements a fail-closed, confidential candidate-replay toolchain. It does not yet prove source-faithful replay or repair the strict rebuild.** No production migration is changed or published.

The intended foundation comprises **20** chronological production-only SQL migrations from 7 September 2026, older than GitHub's first local migration on 9 September. Their fingerprints are already established in `supa_ledger5e_original_baseline_provenance.json` and the frozen 466-record snapshot.

## Source security discovery

A careful, read-only inspection of these original SQL statements found that:

- Original SQL is schema/access-control-heavy and contains 17 original owner RLS policies in `initial_commercial_schema`. The temporary CI baseline has none of those policy CREATE statements and is **not an interchangeable historical migration**.
- `stage_validated_archive_in_app_read_models` uses `INSERT ... SELECT` from historical staging and archive tables. On an empty disposable schema this should copy zero rows, but behavior still needs to be checked.
- `add_one_time_archive_import_tokens` contains a historic import-run UUID and issues a fresh token through an `INSERT` into `staging.archive_import_tokens`. That operational data-flow **must not** be copied into GitHub or an isolated candidate. The verified schema/ACL preamble has SHA256 `5384d510f0216d9b95d94028c0a0e35fb7add2dd7adc05d48a77e108b5a078fe`; the candidate will preserve that verified prefix and **explicitly omit** the token-issuing statement.
- The original SQL has not been exported or committed to GitHub. An attempt to transfer production SQL directly into the repository was blocked by security safeguards; **no bypass was attempted**.

Consequently, any eventual candidate **cannot honestly be described as byte-for-byte identical to all 20 historical executions**. It will be *source-verified, operationally sanitized, schema-replay candidate*, not an authorized production migration.

## Reproducible tooling in repository

`supabase/tools/prepare_original_foundation_candidate.py` accepts **only privately provisioned** original SQL files in a local folder. It:

1. Requires exactly 20 original version/name pairs; verifies every source file's raw SHA256 and byte size against the frozen production ledger snapshot **before** transformations.
2. Refuses symlinks, missing files, mismatched names, uncertain project identity, changed SQL, suspicious embedded credentials, already linked Supabase project or timestamp collisions.
3. For the single token-issuing historical migration, checks a second fixed **prefix SHA** and drops the historic operational `INSERT`; raises rather than guessing if the statement differs.
4. Produces an isolated temporary Supabase project containing copies of the checked-in migration files and 20 source-verified historical predecessors. It **refuses to write inside the repository's `supabase/` directory**.
5. Writes only safe aggregate provenance metrics to JSON. Never prints SQL, customer data, user tokens, passwords or literal run IDs.

`supabase/tools/run_original_foundation_disposable.py` adds the **opt-in** local Docker replay. It requires explicit `--confirm-disposable-local-only`, removes known remote credentials from the subprocess environment, runs `supabase start` followed by `supabase db reset --local` only in its throwaway project, stops with `--no-backup`, and writes a sanitized success/failure report. It does **not** claim schema equivalence to production, tenant authorization completeness, or production deploy safety even on a green candidate run.

`supabase/tools/test_prepare_original_foundation_candidate.py` covers happy-path integrity for synthetic private SQL fixtures, token-literal omission, output isolation, tamper detection, project mismatch, timestamp/chronology fail-closed checks and source-symlink refusal. The existing P0 Required Gate runs these **offline tests only**, adding no new infrastructure or repeat Docker staging. No private source SQL is available or required in GitHub Actions.

## Controlled local command — only when source is independently authorized

The private directory is **not** a repo folder and must not be uploaded to the chat, the frontend, GitHub artifacts or a public Cloud Browser. Its files must use `<original_version>_<original_name>.sql` basenames. Get them through an authorized private Supabase procedure after access has been restored; **do not reset the production DB password merely for this task**.

```bash
python supabase/tools/run_original_foundation_disposable.py \
  --private-source-dir /path/to/authorized-private-historical-sql \
  --report /tmp/ledger5f-disposable-result.json \
  --confirm-disposable-local-only
```

This command is a **local-only optional acceptance**; it has **not been run against the real 20 original SQL files** in this microblock. Any report must distinguish `candidate_replay_passed` from `repository_only_clean_rebuild_fixed` (always false until original migration strategy is independently approved).

## What must happen before release

- **Gate 5F-A (implemented):** source lineage verifier, explicit token sanitization and local-only replay harness with unit tests green.
- **Gate 5F-B (pending):** trusted operator privately supplies the 20 original SQL migration files, then runs the disposable candidate (no production credentials in repo). Inspect every failure in sanitized reports. No declaration of successful rebuild until observed.
- **Gate 5F-C (pending):** run detailed schema/RLS/GRANT/ownership/FK/CHECK and transient create/drop diff against production *read-only* catalog. Validate with real GoTrue signed JWT across Network, Company Claims, RFQ approvals, untrusted metadata and internal listino. The existing 5D 16/16 local acceptance is not complete role acceptance.
- **Gate 5F-D (pending):** choose a version-aware future migration integration that respects the 466 production records, existing `20261005130000` collision, remote-only predecessors, 6 duplicate names and 10 relative-order warnings. Plan backup and rollback and obtain explicit version-by-version approval, not blanket `repair`.

**Release status:** STRICT repository-only rebuild is **still failing**; #780 remains open; Identity2D #799/#801/#803, SEC1 deployment and any automatic history repair remain on hold. No production writes, Railway, Vercel deployment or PostgreSQL password reset.
