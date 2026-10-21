-- SUPA-LEDGER4B: READ ONLY live catalog assertions for Network identity.
-- Do not run as a migration. No data writes, history edits, or credentials.
-- Check current schema + grants; NOT proof of cross-tenant functional acceptance.
WITH defs AS (
  SELECT n.nspname, p.proname, pg_get_functiondef(p.oid) body
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE (n.nspname, p.proname) IN (
    ('private','m7_application_candidates_impl'),
    ('private','m7_bridge_registration_impl'),
    ('private','m8_update_managed_network_company_impl'),
    ('private','m4_review_company_claim_impl'),
    ('public','m6_search_network'),
    ('public','m6_network_company_profile')
  )
), checks AS (
SELECT 'P0A' block, 'one_active_superadmin' check_name,
  (SELECT count(*) = 1 FROM public.platform_user_roles
    WHERE role='platform_superadmin' AND status='active') passes
UNION ALL SELECT 'P0A','one_active_superadmin_unique_index',
  to_regclass('public.platform_user_roles_one_active_superadmin_idx') IS NOT NULL
UNION ALL SELECT 'M4','verified_proof_required_for_claim_approval',
  EXISTS (SELECT 1 FROM defs WHERE proname='m4_review_company_claim_impl'
    AND body ILIKE '%proof_status<>%verified%')
UNION ALL SELECT 'M4','approved_claim_unique_index',
  to_regclass('public.network_company_claims_one_approved_company_uidx') IS NOT NULL
UNION ALL SELECT 'M4','active_company_link_unique_index',
  to_regclass('public.organization_network_company_links_active_company_uidx') IS NOT NULL
UNION ALL SELECT 'M4','active_organization_link_unique_index',
  to_regclass('public.organization_network_company_links_active_org_uidx') IS NOT NULL
UNION ALL SELECT 'M6','published_only_permissive_select_policy',
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='network_companies'
    AND permissive='PERMISSIVE'
    AND cmd='SELECT' AND qual ILIKE '%publication_status%published%')
UNION ALL SELECT 'M6','no_other_permissive_select_policy',
  NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='network_companies'
    AND permissive='PERMISSIVE' AND cmd IN ('SELECT','ALL')
    AND qual NOT ILIKE '%publication_status%published%')
UNION ALL SELECT 'M6','network_entitlement_restrictive_policy',
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='network_companies' AND permissive='RESTRICTIVE'
    AND qual ILIKE '%pa1_3_current_network_access_allowed%')
UNION ALL SELECT 'M6','search_and_profile_filter_published',
  (SELECT count(*)=2 FROM defs WHERE nspname='public'
    AND proname IN ('m6_search_network','m6_network_company_profile')
    AND body ILIKE '%publication_status%published%')
UNION ALL SELECT 'M7','hp4_normalization_used_for_candidates',
  EXISTS (SELECT 1 FROM defs WHERE proname='m7_application_candidates_impl'
    AND body ILIKE '%hp4_company_name_key%'
    AND body ILIKE '%hp4_normalize_identifier%'
    AND body ILIKE '%hp4_normalize_domain%')
UNION ALL SELECT 'M7','platform_permission_required_for_bridge',
  EXISTS (SELECT 1 FROM defs WHERE proname='m7_bridge_registration_impl'
    AND body ILIKE '%require_platform_permission%registrations.bridge_network%')
UNION ALL SELECT 'M8','owner_claim_and_membership_gate_used',
  EXISTS (SELECT 1 FROM defs WHERE proname='m8_update_managed_network_company_impl'
    AND body ILIKE '%m7_user_can_manage_network_company%')
UNION ALL SELECT 'M8','company_managed_field_change_audit',
  EXISTS (SELECT 1 FROM defs WHERE proname='m8_update_managed_network_company_impl'
    AND body ILIKE '%p3_7_record_profile_event_impl%'
    AND body ILIKE '%update public.network_companies%')
)
SELECT block, check_name, passes
FROM checks ORDER BY block,check_name;
