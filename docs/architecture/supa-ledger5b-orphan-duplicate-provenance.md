# SUPA-LEDGER5B — Orphan & Duplicate Provenance Deep Audit

**Status:** evidence-only, **NO REPAIR**. Capture 21 October 2026 · repo `ctimaru/steel-sales-ai` · production project `ecrafjdummcdfycznitx` · tracking issue [#780](https://github.com/ctimaru/steel-sales-ai/issues/780).

## 1. Input integrity and safety

- Re-read **466** production migration records and compared each (`version`, `name`, SHA256 original `statements[1]`, byte count) to the immutable `20261021_migration_content_fingerprints.json` snapshot: **0 additions, 0 deletions, 0 changed SQL hashes** at audit time.
- GitHub main: **437 migration files**.
- Local-only migration names: **12**; remote-only names: **36**; remotely duplicate-name groups: **6**; locally duplicate-name groups: **1**.
- All inspections are offline file reads or production **SELECT** of schema/function/trigger metadata and the migration ledger. No credentials, supplier pricing, customer records, full SQL bodies, source documents or database writes are deposited into the report. The automated program never invokes `migration repair` or emits any repair commands.

### Read-only repeatability

[`supabase/audits/supa_ledger5b_provenance_readonly.sql`](../../supabase/audits/supa_ledger5b_provenance_readonly.sql) returned **24 observations**: 12 local-only representative catalog objects, 6 significant remote historical objects, and 6 duplicate remote-group SQL-variant classifications. **10/12** local-only representatives exist in current production, **2/12** do not. The existence of an object **does not certify the entire original migration or its historical version**.

## 2. Twelve GitHub-only migrations — all held

| Migration | Representative production catalog signal | Interpretation / required action |
|---|---|---|
| `add_controlled_pilot_runs` | `public.pilot_runs` present | Current effect exists; original migration history unresolved |
| `add_human_correction_promotion_loop` | `commercial_correction_events` present | Exact **byte-identical** SQL exists under remote name `human_correction_promotion_loop` (different timestamp/name); preserve both identities until reviewed |
| `add_normalization_coverage_backlog` | `p1_normalization_coverage` function present | Function presence does not prove version/whole SQL |
| `add_pilot_exit_readiness` | `p1_pilot_exit_readiness` present | Preserve provenance |
| `add_pilot_human_evidence_checkpoint` | `pilot_human_evidence` present | Preserve evidence/audit provenance |
| `add_pilot_usage_analytics` | `pilot_usage_events` present | Preserve data lineage |
| `bd1_buyer_distinta` | `buyer_distintas` present | Do not replay buyer/RFQ DDL |
| `expand_worker_staging_observations` | `worker_staging_observations` present | Could have been subsumed by a remote foundational migration; verify every column |
| `school6b_ai_budget` | `private.school6b_ai_quota_user` **absent** | **Potential feature deployment gap**. Do NOT mark the migration applied or enable School AI quota without real migration execution/release plan |
| `sec1_public_rpc_privilege_boundary` | `k2_public_knowledge_grade` present | **High security priority:** RPC existence does not imply intended grants/revokes; require role-by-role catalog and negative ACL tests |
| `trader1d3b2_live_source_intelligence` | `private.trader1d3b2_source_observations` **absent** | **Deliberate release hold** under #780. Do not mark applied or enable dependent Network source collection |
| `worker_jobs_staging` | `worker_jobs` present | Remote early foundations may already cover table; no history inference |

The 10/12 count is based on **one representative object per local file**, not full-function/column equivalence. Other absent/deprecated objects may still exist within these migrations.

## 3. Thirty-six production-only records — preserve each historical event

These are **not disposable orphan rows**. Grouped by functional provenance (classification from recorded SQL metadata; names and primary DDL objects inspected, no raw source values retained):

**Early commercial, import and staging foundations (18):**
`initial_commercial_schema`,
`create_private_import_staging`,
`create_temporary_sample_ingest_gateway`,
`remove_temporary_sample_ingest_gateway`,
`add_staging_thread_payloads`,
`add_staging_review_flags`,
`add_parser_v3_audit_tables`,
`add_parser_v3_payload_and_regression`,
`drop_unused_v3_row_table`,
`create_v31_archive_staging`,
`add_archive_payload_columns`,
`secure_staging_and_add_payload_chunks`,
`enable_pg_net_for_internal_import`,
`add_one_time_archive_import_tokens`,
`create_app_facing_commercial_read_models`,
`stage_validated_archive_in_app_read_models`,
`add_app_facing_fk_indexes`,
`add_foreign_key_indexes_for_import_scale`.

**Commercial / operations (9):**
`add_commercial_search_and_metrics`,
`link_review_queue_to_commercial_observations`,
`human_correction_promotion_loop`,
`commercial_unify2c3_entity_search`,
`noop_p14_verification_marker`,
`pa2_30_24_automated_regression_check_alert_surface`,
`pa2_30_25_alert_consumption_operational_escalation_contract`,
`pa2_30_26_operational_alert_read_model_frontend_readiness`,
`pa2_32_global_search_product_navigation_bridge_v2`.

**Network operational fixes (4):**
`netfast_profile_private`,
`netfast_profile_api_grants`,
`netlaunch2_failed_run_recovery`,
`netlaunch5e_fix_authenticated_browse_rpc_permissions`.

**Private price-list and source-rights governance (5):**
`pl1_5_generated_geometry_key_fix`,
`pl1_5_wc31_weight_update_join_fix`,
`pp1_1_publication_rights_source_terms`,
`pp1_1_readiness_rights_event_filter`,
`pp1_1_source_rights_review_rpc`.

**18 + 9 + 4 + 5 = 36.** Their schema, access, rights, RFQ dependencies or subsequent fixes may be materially significant. In particular, retain the **publication-rights** and **generated geometry key** corrections; never delete them to make GitHub and production file counts match. The single remote-only migration with SQL identical to a local differently named file is `human_correction_promotion_loop`; identical SQL alone does not repair name/version ordering.

## 4. Duplicate names: five byte-identical, one semantically different

| Remote name | Remote version pairs | SQL comparison | Action |
|---|---|---|---|
| `add_verified_company_identity` | 20260922102454, 20260922102528 | Same original SHA256 and byte count | HOLD; preserve both recorded timestamps |
| `add_recovery_transfer_chunk_writer` | 20260923150847, 20260923151946 | Same SHA256/bytes | HOLD |
| `p3_7f_real_profile_validation` | 20260928072947, 20260928072951 | Same SHA256/bytes | HOLD |
| `pa1_4_claim_conversion_registration_handoff` | 20261003191704, 20261004051359 | **Two distinct SQL bodies** | **P0 manual review** |
| `pa1_5_public_company_data_governance` | 20261004062640, 20261004063430 | Same SHA256/bytes | HOLD |
| `rfqh13_core_approval_gate_enforcement` | 20261007100440, 20261007111845 | Same remote SHA256/bytes | **P0 RFQ governance review**, because the *two local files are NOT SQL-identical* |

**P0 PA1.4 finding.** Comparing the stored SQL bodies shows that the **second** migration introduces a trigger guard against non-null but conflicting `claim_target_network_company_id` and `matched_network_company_id`, and checks this **before** the privileged role fast path. Live `private.pa1_4_guard_registration_identity_targets` includes this stronger constraint (SQLSTATE `23514`) and its trigger is installed on `public.company_registration_applications`. No evidence of that mismatch being reachable through current guarded registration paths is established; this **does not** prove complete multi-role security. Preserve both versions and test the conflicting-target path in isolated staging.

**P0 RFQH13 finding.** GitHub local `20261007100440_rfqh13_core_approval_gate_enforcement.sql` is a **comment-only tombstone** explicitly saying the interrupted draft was superseded by `20261007111845`. The later file holds the **20.5 KB executable canonical approval-gate SQL**. Both remote history entries hold the **same full canonical SQL**, byte-identical to the **later local file only**. Thus the earlier local tombstone is **not equivalent to SQL stored under that same timestamp in production**. Treat as an intentional local tombstone/history discrepancy, not as a missing migration to replay; verify approval gate functions/roles in a separate negative-ACL acceptance before future recovery.

## 5. Offline repeatable fail-closed index

[`supabase/tools/migration_orphan_duplicate_provenance.py`](../../supabase/tools/migration_orphan_duplicate_provenance.py) reads all `supabase/migrations/*.sql` and the snapshot already tracked in GitHub. It emits `migration-orphan-duplicate-provenance.json`, with every single 12 local-only and 36 remote-only record, the six remote duplicate name groups, one local duplicate group, full version/hash pairs, cross-name byte matches and priority-review hints.

The JSON always states:
- `safe_for_automatic_repair=false`
- `history_mutations_allowed=false`
- `repair_commands=[]`

Review hints are only queues, **not validated security severity or release authorization**. The prior [SUPA-LEDGER5](supa-ledger5-conservative-reconciliation.md) collision at `20261005130000` and 10 version-order inversions remain blockers.

Seven unit tests assert that identical original SQL across differently named migrations, duplicate SQL, divergent duplicate SQL, mismatched local/remote pairs and missing records cannot generate automatic repair or leak SQL contents.

The **existing offline SUPA-LEDGER2 workflow** runs the tests and archives the additional JSON report with the prior comparison reports. No external database credential, new workflow or Vercel app build is required.

## 6. Release decision — what remains

- **No production history repair** is permitted. The 466-record snapshot remains a read-only benchmark, not a writable target.
- **Next SUPA-LEDGER5C:** targeted object/grant/dependency and clean-rebuild tests, starting with **PA1.4**, **RFQH13**, **SEC1**, absent **SCHOOL6B** and held **TRADER1D3B2**, plus staging/table discrepancies in early remote-only foundations.
- Follow the existing §5 procedure: exact official linked CLI list only when existing PostgreSQL credentials are available (no reset), full history preflight, per-version approval/backup/rollback, then multi-role negative acceptance before release of **IDENTITY2D #799/#801/#803**.
- Never confuse public `Crea distinta` functionality with source-rights restricted private price-list contents.

**This microblock classifies and prioritizes historical provenance. It does not close [#780](https://github.com/ctimaru/steel-sales-ai/issues/780) or clear [#798](https://github.com/ctimaru/steel-sales-ai/issues/798).**
