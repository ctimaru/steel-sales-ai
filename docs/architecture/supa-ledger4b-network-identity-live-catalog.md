# SUPA-LEDGER4B — Network & Company Identity final-catalog adjudication

**Captured:** 21 October 2026 · **Repo:** `ctimaru/steel-sales-ai` · **Production:** Supabase `ecrafjdummcdfycznitx`.

**Scope:** five names among the 17 remaining SQL-token-divergent historical migrations from [#780](https://github.com/ctimaru/steel-sales-ai/issues/780): P0A, M4, M6, M7, M8. Read-only `pg_catalog`, `pg_policies`, `pg_get_functiondef`, `to_regclass` and aggregate counts. **No DDL, migration repair, Railway connection, production deploy, auth impersonation, credential retrieval or data modification.**

## Decision matrix

| Historical SQL migration | Source-vs-applied difference | Proven current catalog | Decision |
|---|---|---|---|
| `p0a_1_platform_superadmin_foundation` | Source seeds role via an `auth.users` lookup; remote historical version used direct fixed-ID `VALUES`. Semantically distinct *for a clean rebuild*. | Exactly **1** active superadmin; unique partial index `platform_user_roles_one_active_superadmin_idx`; privileged `private.is_platform_superadmin` uses `auth.uid()` + active role. | **Current-state gate passes; historical versions still differ**. Preserve evidence; never rerun seed SQL or amend role grants. |
| `m4_governance_trust` | Original and local DDL contain syntactic and formatting changes, including claim status comparisons. | Proof-verified check on approval in `m4_review_company_claim_impl`; unique partial index for approved company claims; unique active organization/company links; claim/assertion tables RLS enabled and no direct `authenticated` SELECT. | **Catalog safeguards confirmed**. Role-based negative tests required. Do not replay historical DDL. |
| `m6_network_read_model` | Changes include SQL aliases/`AS` and formatting. | Both `m6_search_network` and `m6_network_company_profile` require `publication_status='published'`. **Network read RLS combines a PERMISSIVE published-only policy and a RESTRICTIVE entitlement policy**, therefore normal authenticated reads require both. RPC anon EXECUTE false. | **No unpublished-row exposure demonstrated** by this policy; verify Free/Pro UX and entitlement flows. |
| `m7_registration_bridge` | Earlier source contained `v_normalized_name`; live implementation does **not** because subsequent HP4 logic superseded it. | `private.m7_application_candidates_impl` uses `hp4_company_name_key`, `hp4_normalize_identifier`, `hp4_normalize_domain`; weighs VAT/registration/name/domain and marks previously linked or claimed candidates not selectable. `m7_bridge_registration_impl` requires `registrations.bridge_network` and activated application; rejects conflicting ownership. | **Superseded safely in current catalog**, not a missing source patch. Never restore old code. Run authenticated negative test before new Identity release. |
| `m8_managed_profile_cutover` | Historical text includes unused variable/comments; live function later evolved with P3.7A events. | `m8_update_managed_network_company_impl` calls `m7_user_can_manage_network_company` which requires active company link, approved claim and active organization admin membership; write targets trading name, URL and description, records assertions and events. It does not explicitly update legal name, VAT, verification or publication. | **Owner-controlled update protections present**. Verify the UI supplies intended field values (NULL can clear existing optional values) and test wrong-organization attempts. |

## Automated repeatable read-only probe

Run [`supabase/audits/supa_ledger4b_network_identity_readonly.sql`](../../supabase/audits/supa_ledger4b_network_identity_readonly.sql) through a permitted read-only Supabase SQL connection. The script does not write anything, does not select customer row values or identifier values, and returns `block/check_name/passes`.

**Observed result on 21 October 2026:** **14/14 catalog assertions passed**.

Other read-only population evidence: **34** canonical `network_companies`, of which **32 published**; **3** organizations and **3** active memberships; **3** approved claims and **3** active company links. `network_access` currently has **0** entitlement events, including no grants. These are point-in-time observations, **not acceptance of Free/Pro functionality**.

## Release / business implications

1. Do **not** apply the historical P0A/M4/M6/M7/M8 SQL on top of production: live schema may be a later, safer implementation and SQL equivalence is **not** established.
2. Do **not** use these read-only results to mass-repair `supabase_migrations.schema_migrations`. [#780](https://github.com/ctimaru/steel-sales-ai/issues/780) remains OPEN pending official CLI history (currently blocked by the existing wrong PostgreSQL secret), ordering/provenance verification and approved selective repair.
3. For the future Network and freemium model, check authentic Free/Pro/Platform sessions. Because there are **no Network entitlement events**, test whether a non-superadmin can see the intended teaser and whether Pro activation actually grants `network_access`. Do not remove or bypass RLS to achieve a visual demo.
4. Run negative acceptance for owner claim mismatches, foreign organization M8 update, unauthenticated M4/M7 RPC calls, and platform permission enforcement in a **nonproduction** test environment.
5. Preserve #799, #801, #803 IDENTITY2D release hold until history, migration execution and acceptance pass. No Railway work or password reset at this time.

**This block is a verified current-catalog adjudication, not a production release or runtime penetration test.**