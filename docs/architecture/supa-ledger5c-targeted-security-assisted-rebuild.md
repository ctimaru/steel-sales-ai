# SUPA-LEDGER5C — Targeted Security & **Assisted** Rebuild Acceptance

**Date:** 21 October 2026 · **Repo:** `ctimaru/steel-sales-ai` · **Production Supabase:** `ecrafjdummcdfycznitx`.  
**Scope:** PA1.4 Company Claim, RFQH13 award and PO approvals, SEC1 public RPC split, M5 AI target references, SK4.2 EN structural seed, PL1.5 generated geometry, and absent SCHOOL6B / TRADER1D3B2 migrations.

**No production writes, migration history repair, database password reset, Railway access, Vercel build/deploy or alteration of private price-list content.** All negative tests use a disposable CI PostgreSQL database and a transaction rolled back at the end.

## Verified production snapshot — 13 read-only metadata checks

[`supabase/audits/supa_ledger5c_live_security_gap_readonly.sql`](../../supabase/audits/supa_ledger5c_live_security_gap_readonly.sql) returned **13 observations, 8 present, 5 not present**. Non-present markers are **intended release gaps**, not test failures of the production SQL audit.

| Area | Live finding | Decision |
|---|---|---|
| PA1.4 | `pa1_4_guard_registration_identity_targets` installed on company registration, mismatched `claim_target_network_company_id` and `matched_network_company_id` rejected with 23514 before privileged role fast path | Current guard present; negative trigger acceptance still needed |
| RFQH13 | `rfqh7_confirm_award_impl` and `rfqh9_prepare_issue_impl` call approval assertion and consumption; anon cannot EXECUTE public governance state | Current role/catalog checks present; not complete cross-tenant proof |
| SEC1 | **11/11** selected public RPC implementations remain `SECURITY DEFINER`, `sec1_public` internal schema **absent**; local repo contains migration `20261009140500_sec1_public_rpc_privilege_boundary.sql` defining 11 public SECURITY INVOKER facades + 11 internal SECURITY DEFINER implementations | **P0 deployment/security migration gap**, no exploit proved. Do not directly replay migration without reconciliation and ACL impact review |
| SCHOOL6B | `private.school6b_ai_quota_user` absent | Local-only planned quota migration not recorded as applied; no activation |
| TRADER1D3B2 | `private.trader1d3b2_source_observations` absent | Local-only held source intelligence migration, not available for production use |
| M5 | All present golden target links reference existing document-backed chunks | Current referential integrity present, historic clean-build equivalence unproved |
| SK4.2 | No supplier dimensions falsely marked `is_normative_complete` | Data provenance boundary present, historical seed/CTE discrepancy still needs independent comparison |
| PL1.5 | `public.steel_geometries.geometry_key` STORED GENERATED | Current catalog uses new form; old historical explicit insert not safe to replay |

**SEC1 consideration:** Public SECURITY DEFINER is a meaningful review surface, but the existence of 11 such functions **alone is not a proven privilege escalation**. The source/migration may have separate published-only filters. The proposed SEC1 split must preserve public read behavior and enforce tenant/privacy boundaries, with browser JWT negative tests before production.

## Local CI negative tests added (no production impact)

[`supabase/tests/supa_ledger5c_security_negative.sql`](../../supabase/tests/supa_ledger5c_security_negative.sql) runs after local migrations in existing **P0 Required Gate**, with a rolled-back PostgreSQL test transaction:
- Registers the **current PA1.4 trigger** on a temporary fixture table. Expects a conflicting target/registration pair to fail with SQLSTATE **23514 even as privileged postgres**.
- Changes to `authenticated` and rejects forged pair creation **42501** and contradictory changes **23514**. No real company/user/claim created.
- Verifies RFQ award and PO implementation has both approval-assert and approval-consume calls, checks public RPC grants and tries anonymous governance access expecting **42501**.
- Verifies all **11 SEC1 public facades are invoker**, all **11 internal implementations are definer**, checks allowed anon public knowledge endpoint remains functional on a non-existent slug and private schema isn't available to anon.

[`supabase/tests/supa_ledger5c_assisted_rebuild_invariants.sql`](../../supabase/tests/supa_ledger5c_assisted_rebuild_invariants.sql) executes read-only assertions after the same reset:
- M5 target/chunk foreign key, absence of dangling chunk/document links, privileged golden benchmark RPC boundary.
- SK4.2 EN 10210 (**32**) and EN 10219 (**50**) manufacturer-range dimension applicability, none presented as full normative standard.
- PL1.5 generated geometry key existence, uniqueness and not empty; internal supplier price lists remain inaccessible by public/ordinary authenticated publication predicate.
- Local schema contains SCHOOL6B quota and TRADER1D3B2 evidence objects, explaining the **local vs production** feature deployment difference.

These two tests are wired to the **existing** `.github/workflows/p0-required-gate.yml` and run after the canonical RFQH13 suite. No new workflow/runner type, no database credentials beyond existing local disposable fixture.

## **Critical qualification: P0 is an *assisted* rebuild**

Read the workflow before interpreting a green gate:
```
cp supabase/ci/p0_pre_worker_baseline.sql supabase/migrations/20260908000000_ci_pre_worker_baseline.sql
cp supabase/ci/p0_staging_baseline.sql supabase/migrations/20260908000001_ci_staging_baseline.sql
supabase start
supabase db reset --local
```

The two injected baselines are **not files in the real production migration chain**. The first reconstructs early company/contact/RFQ foundational schema, the second historical parser staging tables, because remote-only migrations predate the tracked GitHub files. Therefore **even a green P0 suite proves only the assisted local history can rebuild and meet tests**. It does **NOT** prove a clean rebuild with `supabase/migrations` alone, nor prove 466 remote-history entries equivalent to 437 local migration files.

Do not remove these CI baseline files or substitute them with guessed historical SQL in this audit. A separate controlled, disposable **strict clean rebuild without helper baselines** is a future task; expected errors should be captured, with exact prerequisite order and provenance, rather than failing open or guessing replacements.

## Release blockers and next decisions

1. **SEC1 is the highest-priority release-gap review.** Stage an ACL-accurate, role-based browser/RPC regression before its migration is applied in any shared environment. Do not infer complete authorization from signature checks alone.
2. **PA1.4, RFQH13** must pass complete multi-user/multi-organization negative acceptance in isolated staging, including outsider, claimant, superadmin, buyer, approver and unauthorized supplier.
3. **SCHOOL6B, TRADER1D3B2** must remain disabled until exact eligible deployment migration and release-plan approval.
4. Strict rebuild needs an exact, provenance-backed representation of remote-only foundational migrations; historical M5 chunk link, SK4.2 row-level source, and PL1.5 generated-key ordering require fixture/row-equality comparison.
5. Keep [#780](https://github.com/ctimaru/steel-sales-ai/issues/780) open, linked-CLI authentication still held until existing privately controlled PostgreSQL password is recovered (without reset); no mass repair and no IDENTITY2D deployment.

This PR is **an expansion of acceptance coverage**, not permission to execute SQL against production. If local CI fails, preserve the failing evidence and fix only tests/fixtures or a separately reviewed underlying defect.
