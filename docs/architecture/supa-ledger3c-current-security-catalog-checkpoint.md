# SUPA-LEDGER3C — Current Schema & Security Readback, checkpoint A

Date: 20 October 2026 · Project `ecrafjdummcdfycznitx`.

**Status:** audited current PostgreSQL catalog in READ ONLY; not a full browser impersonation test or migration reconciliation. Part of [#796](https://github.com/ctimaru/steel-sales-ai/issues/796), not closure of global [#780](https://github.com/ctimaru/steel-sales-ai/issues/780).

## Production catalog observed

A stable 466-entry remote migration history surrounded the metadata readback. Snapshot: `supabase/audits/20261020_current_security_catalog_snapshot.json` (15 selected current functions, 11 sensitive tables; RLS flags, grants, source `pg_get_functiondef` SHA-256 only, **no body text, company/customer data, secrets or tokens**). Current schema evidence:
- **All 11 selected sensitive tables had RLS enabled**. These include `public.network_companies`, `public.network_company_claims`, `public.network_company_follows`, `public.network_activity_events`, `public.platform_user_roles`, `public.organization_memberships`, `public.company_registration_applications`, and private EU source tables. Do not extrapolate to all tables in the database.
- None of the selected public entry-point functions granted `anon EXECUTE`. Their schema-granted `authenticated` access delegates via SQL wrappers to guarded private functions where applicable. Role grants **alone** do not prove authorization within the function.
- `public.network_companies` is RLS protected. One authenticated SELECT policy limits to `publication_status='published'`; another uses `private.pa1_3_current_network_access_allowed()`. Validate entitlement behavior separately as it may intentionally broaden authenticated discovery.
- Private EU source-research / location-evidence tables are RLS enabled, with no direct anon/authenticated SELECT. No source rights or publication promoted.
- `private.is_platform_superadmin` has fixed empty `search_path`; observed code requires `auth.uid()`, `platform_superadmin` and `status='active'`. One active superadmin was found in production at readback.
- `private.m7_user_can_manage_network_company` requires **active organization-to-Network link, active organization administrator membership, and an approved claim**. `private.m8_update_managed_network_company_impl` explicitly requires authentication and delegates to this manager guard before writing profile fields. These conditions were examined in the current function source, not merely guessed from the name.
- `private.m4_review_company_claim_impl` uses `private.require_platform_permission`, with distinct permissions for `under_review`, `approved`, `rejected`, `revoked`; `private.m4_request_company_claim_impl` delegates to `private.p3_6_request_company_claim_impl`, which checks authenticated active organization admin and source proof. The claim request currently supports unique corporate email proof and otherwise can record pending proof for owner verification. This is a **profile ownership process**; it must not become manual verification of every discovered business.
- Two legacy `private.p2_recover_legacy_message_identity_impl` and `private.p2_finalize_legacy_conversation_identity_impl` functions have **`anon EXECUTE` grants**. However the `anon` role has **no USAGE permission on private schema**, and current function bodies check `auth.uid()` and `public.is_organization_member(...,true)`. They are **defense-in-depth hardening candidates**, not proof of exploitable exposure. Do NOT revoke remotely in an unreviewed audit; verify RPC wrappers/consumers and add versioned, tested migration after migration-history reconciliation.

## Automated acceptance
- `supabase/tools/ledger3c_current_security_audit.py` validates the stored live snapshot: exactly 15 functions + 11 RLS tables, no selected public anon functions, no anon schema USAGE, no unexpected private anon EXECUTE privilege, `SECURITY DEFINER` fixed empty search paths, and protected direct tables not widened to authenticated.
- `supabase/tools/test_ledger3c_current_security_audit.py` regression-tests introduced grants, RLS removal and incomplete snapshots. GitHub Actions `.github/workflows/supa-ledger3c-security-catalog-audit.yml` uses **no DB credentials** and archives a dated report. The test operates on a snapshot and **does not monitor future privilege changes automatically**.

## Risks / next acceptance

1. Remaining **15 P0** original SQL token differences have not each been mapped to effective deployed objects. This checkpoint covers critical superadmin, claim, Network read/manage, legacy message and activity primitives; other catalog/price/pressure SQL families require object-level review.
2. Execute negative and positive auth tests in a **real authenticated browser session** with ordinary company roles, superadmin and multiple tenants. Grants/RLS inspection cannot certify tenant isolation. Avoid synthetic company claims or fake approvals.
3. Inspect affected current function definitions, all downstream wrappers/views, and later superseding migrations against the 21 token-different histories. Identify whether any actual live semantic mismatch exists before preparing corrective DDL.
4. Reconcile all remote/local history (orphans + duplicates + versions) through official CLI with protected credentials. **No migration repair, db push, history SQL manipulation, source-rights grants or new TRADER1D.3B.2 writer activation yet.** Current bounded HEAD monitor remains operational.

Refs: [#796](https://github.com/ctimaru/steel-sales-ai/issues/796), [#780](https://github.com/ctimaru/steel-sales-ai/issues/780), [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).
