# SUPA-LEDGER5 — Conservative Migration History Reconciliation

**Status:** pre-repair **READ-ONLY** decision system; no database changes authorized.  
**Captured:** 21 October 2026 · Repo `ctimaru/steel-sales-ai` · Production `ecrafjdummcdfycznitx` · Parent issue [#780](https://github.com/ctimaru/steel-sales-ai/issues/780).  
**Release dependencies:** [IDENTITY2D #798](https://github.com/ctimaru/steel-sales-ai/issues/798); PRs #799, #801, #803 remain unapplied/unmerged. Railway inspection and database-password reset deferred by user.

## 1. Independently confirmed source freshness

Live production `supabase_migrations.schema_migrations` SHA256 readback on 21 October 2026 was compared to every entry in `supabase/audits/20261021_migration_content_fingerprints.json` using (`version`, `name`, `sha256(statements[1])`, `octet_length(statements[1])`). **466 snapshot records = 466 live records, 0 additions, 0 removals, 0 SQL checksum changes.** This is a **point-in-time independent verification**; the offline workflow **cannot** repeat it by itself.

GitHub `main` currently contains **437 migration files / 436 unique names**; Supabase history has **466 records / 460 unique names**.

| SQL byte/content evidence, from SUPA-LEDGER2 | Local files | Conservative decision |
|---|---:|---|
| Exact local version/name/SQL fingerprint | **33** | RETAIN; do not touch |
| Same SQL SHA256 and name, timestamp differs | **270** | HOLD: review migration-order, target timestamps, remote-only prerequisites before selective history action |
| Normalized prefix/trailing text comparable but original SQL differs | **68** | HOLD: text/provenance; no assumption of SQL semantic equality |
| Other original SQL/text mismatch under SHA method | **47** | HOLD: historical versus current-catalog adjudication recorded across SUPA-LEDGER4B–4E; no blanket repair |
| Ambiguous duplicate-name **local files** | **7** | HOLD: must resolve duplicate identity |
| Repo-only names | **12** | HOLD: not proof of missing schema |
| Remote-only history entries | **36** | HOLD: preserve original provenance; do not delete |

Counts above describe the preserved fingerprint snapshot and should be regenerated after any `main` migration change.

## 2. Critical discovery: Supabase CLI operates on timestamps

Supabase documentation says `supabase migration list` compares local/remote migration **timestamps**, not SQL text; `supabase migration repair --status ...` adjusts recorded migration history **without** applying/reverting schema SQL. It is not a safe way to turn historically different SQL into equivalent DDL.

References:
- [Supabase official migration guide](https://supabase.com/docs/guides/deployment/database-migrations)
- [Official migration list CLI reference](https://supabase.com/docs/reference/cli/supabase-migration-list)

This is why **none of 270 byte-identical-but-renumbered files is authorized for immediate repair**. Repairing only one of a matched version pair could leave conflicting timestamps and cause future `db push` to execute an already-applied mutation or miss a necessary prerequisite. Every candidate needs version collision, sequence and live catalog checks, before an explicitly reviewed history-only change.

## 3. Duplicate groups and one-sided histories

**Local duplicate:** `rfqh13_core_approval_gate_enforcement` has two GitHub versions (`20261007100440`, `20261007111845`). **Remote duplicate names (6 groups):**
- `add_verified_company_identity`
- `add_recovery_transfer_chunk_writer`
- `p3_7f_real_profile_validation`
- `pa1_4_claim_conversion_registration_handoff`
- `pa1_5_public_company_data_governance`
- `rfqh13_core_approval_gate_enforcement`

All duplicate-name histories are **identity ambiguous**, regardless of SQL hashes. Preserve each remote entry.

**12 GitHub-only names** include `sec1_public_rpc_privilege_boundary`, `school6b_ai_budget`, `bd1_buyer_distinta`, `trader1d3b2_live_source_intelligence`, research pilot and worker-staging migrations. **Never mark them applied based only on GitHub existence or a working endpoint.** First determine whether each was intentionally held, superseded or applied under another remote identifier. The single Identity2D release gate prevents copying these migrations into production opportunistically.

**36 production-only names** include the first commercial/import-schema foundation, amendments to publication-rights governance, NetFast profile grants and old listino fixes. Key examples:
- `pl1_5_generated_geometry_key_fix` explains why the live `geometry_key` is generated even though the historical applied PL1.5 import SQL inserted it explicitly.
- `pl1_5_wc31_weight_update_join_fix` supports the production follow-up for WC3.1 join behavior.
- `pp1_1_publication_rights_source_terms` and other publication-rights rows are **not candidates for history deletion**, especially while the price-list source remains private.
- Initial commercial staging foundations may contain actual schema operations that have **no one-to-one file match in GitHub**.

Names supply leads, **not independent proof of exact effects**. Analyze full original statements and live dependencies before changing anything.

## 4. What already passed and what remains unproven

Read-only current-catalog audits merged into `main`:
- [SUPA-LEDGER4B](supa-ledger4b-network-identity-live-catalog.md) (Network, identity, claim): **14/14** catalog assertions.
- [SUPA-LEDGER4C](supa-ledger4c-commercial-network-activity-live-catalog.md) (RFQ, commercial activity): **20/20**.
- [SUPA-LEDGER4D](supa-ledger4d-knowledge-technical-catalog.md) (School, norms, technical weights): **22/22**.
- [SUPA-LEDGER4E](supa-ledger4e-private-price-weight-intelligence.md) (private price-list + WC3.1): **23/23**.

The **17 SQL-token divergences have been catalog-adjudicated**. That means live invariants were checked, **not** historical migration-by-migration equality. Strongest remaining clean-build risks:
1. M5 golden AI chunk-target insertion with/without joined `knowledge_chunks`.
2. SK4.2 EN 10210/10219 structural seed (CTE versus temporary staging table and source/row differences).
3. PL1.5 old explicitly inserted `geometry_key` vs live stored-generated column and original historical order.
4. Cross-version precedence when SQL/body/security functions were later replaced; restore in isolated clone only, not production.

Catalog and RLS checks are **not authenticated user-negative tests**; run isolated multi-organization/role acceptance before Identity2D release.

## 5. Machine-enforced offline NO-REPAIR decision ledger

`supabase/tools/migration_reconciliation_plan.py` reuses `migration_sql_fingerprint_audit.py` inputs. It emits JSON with every local migration, exact original SHA classification, remote same-name versions, matching SHA candidates, **timestamp collision names**, duplicate identities, remote-only orphans, and timestamp ordering conflicts. It **always** declares:
- `safe_for_automatic_repair: false`
- `history_mutations_allowed: false`
- `repair_commands: []`

It intentionally **cannot log in to Supabase**, apply changes, rewrite migrations, or generate repair shell commands. Its output is diagnostic only. Unit tests cover timestamp collisions, ordering conflicts, duplicates, same-SQL-version drift, SQL-body changes and same-SQL-different-name false inference. The pre-existing **single low-cost offline SUPA-LEDGER2 workflow** now also emits `migration-conservative-history-plan.json` alongside the SQL equality report, retaining the 30-day artifact.

The offline report **does not assert snapshot freshness**; the separate production read-only comparison captured today must be repeated at any later actual release gate.

## 6. Sequential protected reconciliation policy

1. **Freeze and inventory:** no other schema deploy/SQL writer during a future maintenance window; record SHA of `main`, full current migration history and hashes; export a private database schema/metadata backup using approved platform process and ensure recovery is independently tested.
2. **Establish provenance:** categorize 12 local-only and 36 remote-only records; audit all 6 remote duplicate-name groups, 1 local duplicate-name group, and any timestamp target collision. Verify dependencies, data rights, platform superadmin and tenant RLS.
3. **Prove replay safety:** rebuild isolated disposable database at the same migration toolchain version and test M5, SK4.2, PL1.5, Network/RFQ grants. Compare schema objects, critical row counts and sample hashes against read-only production baselines without copying restricted business data into test output. Resolve failures before touching prod.
4. **Fix connectivity safely:** revalidate the **existing** PostgreSQL secret through a private credential inventory when infrastructure is accessible. Do **not** reset production DB password just to accelerate this audit; don't retry GitHub workflow with the unchanged rejected secret.
5. **Separate written approval:** prepare a second PR listing each **individual** candidate timestamp and justified action after full evidence. Explicit superadmin approval and recovery plan required. Never auto-generate/apply a bulk `repair` script from these reports.
6. **Official guarded execution only after approval:** follow the supported Supabase CLI procedure for independently confirmed history-only corrections, with controlled rollback plan; never direct SQL modification of `supabase_migrations.schema_migrations`.
7. **Re-audit and release:** rerun official `migration list --linked` and project-wide SQL/schema history checks. Only then stage IDENTITY2D #799/#801/#803, test cross-tenant owner-versus-outsider behavior, review Vercel preview and release in the correct migration order.

### Completion conditions for #780

Close #780 **only if** latest `main` and production have a defensible full-version mapping with no unexplained duplicate or orphan history, data/tenant policy tests pass, official linked status is verified and the recovery runbook exists. **Neither SUPA-LEDGER5 nor its CI report closes #780**.

### Cost/UX principles

Use existing offline CI rather than new paid external deployment workflows. Do not trigger Vercel redeploy merely for this runbook. The goal is to unlock high-quality self-service Network company intelligence and Identity2D safely, not to spend on repetitive infra experiments.
