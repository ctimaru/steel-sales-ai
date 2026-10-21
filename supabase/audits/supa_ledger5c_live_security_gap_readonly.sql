-- SUPA-LEDGER5C: LIVE READ-ONLY security/rebuild gap snapshot. NOT a migration.
-- A FALSE means a missing catalog condition, not by itself an exploit.
WITH fn AS (
 SELECT n.nspname,p.proname,p.oid,p.prosecdef,pg_get_functiondef(p.oid) AS body
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname IN ('public','private','sec1_public')
),
checks AS (
SELECT 'PA1.4' area,'trigger_installed' gate,
 EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
  WHERE c.oid='public.company_registration_applications'::regclass
  AND NOT t.tgisinternal AND pg_get_triggerdef(t.oid)
    ILIKE '%pa1_4_guard_registration_identity_targets%') observed
UNION ALL SELECT 'PA1.4','conflicting_target_rejected_before_privileged_fast_path',
 EXISTS(SELECT 1 FROM fn WHERE nspname='private'
  AND proname='pa1_4_guard_registration_identity_targets'
  AND body ILIKE '%claim_target_network_company_id<>new.matched_network_company_id%'
  AND body ILIKE '%23514%')
UNION ALL SELECT 'RFQH13','award_approval_assert_and_consume',
 EXISTS(SELECT 1 FROM fn WHERE nspname='private' AND proname='rfqh7_confirm_award_impl'
  AND body ILIKE '%rfqh13_assert_award_approval%'
  AND body ILIKE '%rfqh13_consume_approval%')
UNION ALL SELECT 'RFQH13','po_approval_assert_and_consume',
 EXISTS(SELECT 1 FROM fn WHERE nspname='private' AND proname='rfqh9_prepare_issue_impl'
  AND body ILIKE '%rfqh13_assert_po_approval%'
  AND body ILIKE '%rfqh13_consume_approval%')
UNION ALL SELECT 'RFQH13','anon_governance_api_denied',
 EXISTS(SELECT 1 FROM fn WHERE nspname='public' AND proname='rfqh13_governance_state'
  AND NOT has_function_privilege('anon',oid,'EXECUTE'))
UNION ALL SELECT 'SEC1','public_11_invoker_facades',
 (SELECT count(*)=11 FROM fn WHERE nspname='public' AND NOT prosecdef
  AND proname IN ('k2_public_knowledge_grade','k2_public_knowledge_grades',
   'k2_public_knowledge_standard','k2_public_knowledge_standards',
   'k5_public_tube_weight_references','k6_public_tube_dimension_page',
   'k6_public_tube_dimension_pages','k7_public_tube_family_hubs',
   'k7_public_tube_size_hub','k7_public_tube_size_hubs','sp4_public_steel_pulse_feed'))
UNION ALL SELECT 'SEC1','internal_11_definer_implementations',
 (SELECT count(*)=11 FROM fn WHERE nspname='sec1_public' AND prosecdef)
UNION ALL SELECT 'SEC1','internal_sec1_schema_present',
 EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='sec1_public')
UNION ALL SELECT 'SCHOOL6B','ai_budget_table_present',
 to_regclass('private.school6b_ai_quota_user') IS NOT NULL
UNION ALL SELECT 'TRADER1D3B2','source_intelligence_table_present',
 to_regclass('private.trader1d3b2_source_observations') IS NOT NULL
UNION ALL SELECT 'KNOWLEDGE','golden_chunk_fk_integrity',
 NOT EXISTS(SELECT 1 FROM public.retrieval_golden_query_targets t
  LEFT JOIN public.knowledge_chunks k ON k.id=t.chunk_id
  WHERE k.id IS NULL OR k.document_id IS NULL)
UNION ALL SELECT 'SK4.2','no_false_normative_complete',
 NOT EXISTS(SELECT 1 FROM public.steel_standard_dimension_applicability
  WHERE is_normative_complete)
UNION ALL SELECT 'PL1.5','geometry_key_stored_generated',
 EXISTS(SELECT 1 FROM pg_attribute a
  WHERE a.attrelid='public.steel_geometries'::regclass AND a.attname='geometry_key'
  AND a.attgenerated='s')
)
SELECT area,gate,observed FROM checks ORDER BY area,gate;