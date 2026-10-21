# SUPA-LEDGER5E — Original Baseline Dependency Recovery

**Capture:** 21 October 2026 · **Repo:** `ctimaru/steel-sales-ai` · **Production:** Supabase `ecrafjdummcdfycznitx`.  
**Tracking:** [migration ledger #780](https://github.com/ctimaru/steel-sales-ai/issues/780); gated [Identity2D #798](https://github.com/ctimaru/steel-sales-ai/issues/798).

## Executive result — original source proven, not yet restored

The actual **STRICT repo-only** Supabase CLI replay was attempted on a disposable GitHub P0 CI runner, *before* any injected historical CI baseline. The attempt **failed**, and we can now identify its exact first missing dependency without exporting raw SQL or credentials:

| Datum | Verified |
|---|---|
| `strict_rebuild_passed` | **false** |
| `start_succeeded` | false — Supabase start applies migrations and stops on failure |
| `reset_succeeded` | false / reset was not reached |
| `blocker_category` | `missing_relation` |
| `missing_object` | **`public.commercial_datasets`** |
| `last_migration` | **`20260912150428_promote_worker_jobs_to_commercial_dataset.sql`** |
| First verified historical creator | **`20260907192936_create_app_facing_commercial_read_models`** (production-only) |
| Production writes | **zero** |

The local migration starts with `ALTER TABLE public.worker_jobs ... ADD COLUMN dataset_id uuid REFERENCES public.commercial_datasets(id)` and also references `commercial_threads`. The original 7 September **production-only** applied SQL creates `commercial_datasets`, `commercial_threads`, `commercial_observations`, `commercial_review_queue`, sets up their RLS, and installs five named access policies with explicit grants. Its original SHA256 is `00e92b70df828b761a0b4689455e0568541dcdc92403c926706c27b62d4f65c1`. The SHA and byte size match the frozen 466-record production snapshot.

**Consequence:** The source of the immediate missing relation is identified from the originally executed migration, but the repository is **still not strictly reconstructible**. Simply adding a table or marking the old migration as applied is **not a solution**.

## Original historical foundation scope

Production holds **20 migration records older than the repository's earliest local migration**:

- First production-only: `20260907145044_initial_commercial_schema`.
- Last pre-repo foundation: `20260907193743_add_commercial_search_and_metrics`.
- First repository migration: `20260909160700_worker_jobs_staging`.

All **20/20** original SQL SHA256 + size fingerprints were re-read in Supabase **SELECT only** and verified against `supabase/audits/20261021_migration_content_fingerprints.json`. Their historical SQL includes CREATE TABLE for **38 unique table identifiers**; the two P0 CI-only substitute baselines create **23**, with **15** original table identifiers not created by the substitutes. These include early staging conversations, message ingestion, parser v3, archive runs/messages/extractions, evidence and import token records, plus `public.sample_ingest_gateway`.

**Crucial:** `sample_ingest_gateway` was a temporary historical table and has a matching historical DROP operation. A CREATE in a ledger record **does not prove that table should still exist**, and not all 15 omitted names are required for today's operations. Each successor/drop dependency must be respected.

### The CI substitutions are not fidelity-equivalent

Measured against *only* the original `initial_commercial_schema`:

| Structural attribute | Original production SQL (7 Sep) | P0 `p0_pre_worker_baseline.sql` |
|---|---:|---:|
| `CREATE TABLE` definitions | 17 | 21 (adds later commercial read models) |
| `CREATE POLICY` statements | 17 | 0 |
| `CHECK(...)` constraints | 28 | 0 |
| `REFERENCES public.` occurrences | 31 | 37 |

These are **source-text counts**, not an audit of final reconstructed policy/grant state. Later migrations might introduce other policies. The finding is still decisive: do **not** promote the two CI approximations into `supabase/migrations` as substitutes for historical authorized SQL. Preserve the actual ownership, access and rollback semantics, including original RLS and publication rights.

## Reproducible tools committed to GitHub

1. [Original baseline provenance JSON](../../supabase/audits/supa_ledger5e_original_baseline_provenance.json): immutable original version/name/SHA/byte metadata and **DDL identifiers only**; no production records or raw source SQL. It records 20 historical entries, 38/23 objects, 15 omitted CREATE names.
2. [Original baseline provenance checker](../../supabase/tools/original_baseline_provenance.py): verifies all 20 SHA+bytes against the existing snapshot, checks chronological precedence over the first local migration, and compares CI-only approximation coverage; refuses to authorize a release or historical repair. Six tests validate changed fingerprints, chronological inversion and safe diagnosis.
3. [Strict rebuild probe](../../supabase/tools/strict_rebuild_probe.py): upgraded to extract **only** a whitelisted SQL object identifier and migration filename from the ephemeral CLI failure; retains neither raw migration SQL nor CLI output, passwords, JWTs or connection strings.
4. [First-failure source resolver](../../supabase/tools/resolve_first_baseline_dependency.py): maps the sanitized missing relation to original historical creator version + SHA, local consumer file, chronological ordering and ACL/RLS metadata. Five fail-closed tests ensure invalid names and missing sources are not mistaken for an authorized repair.
5. Existing `P0 Required Gate` runner: executes tests, verifies original snapshot, attempts strict replay, archives the preflight and first-dependency diagnostics, then runs the unchanged **assisted** P0/JWT/worker suite on disposable local Supabase. No second CI runner or paid staging deployment is introduced.

Every report declares `history_mutations_allowed: false`, `repair_commands: []`, and `authorized_for_production: false` (or equivalent explicit no-release flags).

## What true recovery requires — separate review stage

The correct repair plan is **not yet deployable**. The next block must:

1. Map **all 20 original remote-only migrations** in execution order, including schema creation, ownership, RLS policies, FK and CHECK constraints, grants/revokes, unique indexes, transient create/drop migrations and parser/archive objects. Cross-check final catalog equivalence with **read-only** production metadata.
2. Design a **reproducible, version-safe GitHub baseline strategy** in a *separately reviewed branch*. Preserve original historical SQL/provenance where legally and technically suitable, without copying private business records into Git. Avoid new timestamps colliding with the **466** existing versions or creating a migration that could be accidentally pushed to production.
3. Demonstrate pure `supabase/migrations` replay from a clean disposable database **without** the two CI helpers; the first blocker `commercial_datasets` must disappear *because the full correct prerequisite was recreated*, not because a placeholder table was inserted. Then continue until the entire migration chain replays.
4. Compare comprehensive schema/FK/grant/RLS objects, role behavior and the M5/SK4.2/PL1.5 data invariants, plus real signed GoTrue JWT/Network/RFQ/claim negative tests.
5. Obtain an explicit separate authorization, backup/rollback procedure and the official `supabase migration list --linked` using the existing privately managed PostgreSQL password **when accessible**. Do not reset the password merely to accelerate this audit.

**NOT DONE:** strict clean rebuild success, production schema migration, direct history repair, original 20 SQL reproduction in GitHub migration files, all-org role acceptance or Identity2D release. Issue #780 and dependent PRs #799/#801/#803 remain blocked.

**Risk governance:** Production price-list source rights remain private; no raw customer/price/email data, Railway access, paid Supabase branch, password reset or Vercel release took place.
