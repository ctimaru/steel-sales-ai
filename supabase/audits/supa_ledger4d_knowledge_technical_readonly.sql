-- SUPA-LEDGER4D — read-only live technical knowledge & reference catalog audit.
-- Executable SELECT only; deliberately kept OUTSIDE supabase/migrations.
-- Assertions reflect structural and source-trust safeguards, not full normative coverage.
WITH checked AS (
  SELECT 'GOLDEN' area,'retrieval_golden_cases_and_targets_exist' check_name,
    (SELECT count(*)>0 FROM public.retrieval_golden_query_cases)
      AND (SELECT count(*)>0 FROM public.retrieval_golden_query_targets) passes
  UNION ALL SELECT 'GOLDEN','target_chunks_have_valid_references',
    NOT EXISTS (SELECT 1 FROM public.retrieval_golden_query_targets t
      LEFT JOIN public.knowledge_chunks k ON k.id=t.chunk_id WHERE k.id IS NULL)
  UNION ALL SELECT 'GOLDEN','target_chunks_have_source_documents',
    NOT EXISTS (SELECT 1 FROM public.retrieval_golden_query_targets t
      JOIN public.knowledge_chunks k ON k.id=t.chunk_id WHERE k.document_id IS NULL)
  UNION ALL SELECT 'GOLDEN','golden_targets_chunk_fk_present',
    EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
      JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='public'
      AND t.relname='retrieval_golden_query_targets'
      AND c.conname='retrieval_golden_query_targets_chunk_id_fkey' AND c.contype='f')
  UNION ALL SELECT 'GOLDEN','retrieval_golden_functions_service_role_only',
    (SELECT count(*)=2 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
     WHERE n.nspname='public' AND p.proname IN
       ('get_retrieval_golden_queries','get_retrieval_golden_query_stats')
     AND has_function_privilege('service_role',p.oid,'EXECUTE')
     AND NOT has_function_privilege('anon',p.oid,'EXECUTE')
     AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE'))
  UNION ALL SELECT 'GOLDEN','golden_query_reader_joins_real_chunks',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname='get_retrieval_golden_queries'
      AND pg_get_functiondef(p.oid) ILIKE '%knowledge_chunks%'
      AND pg_get_functiondef(p.oid) ILIKE '%k.document_id%')
  UNION ALL SELECT 'REFERENCE','source_catalog_has_standards_and_grades',
    (SELECT count(*)>0 FROM public.steel_standards)
    AND (SELECT count(*)>0 FROM public.steel_material_grades)
  UNION ALL SELECT 'REFERENCE','reference_geometry_model_populated',
    (SELECT count(*)>0 FROM public.steel_geometries)
    AND (SELECT count(*)>0 FROM public.steel_dimensional_rows)
  UNION ALL SELECT 'REFERENCE','reference_index_sentinel_matches_current_main',
    (SELECT count(*)=4 FROM pg_indexes
      WHERE schemaname='public'
      AND indexname IN
        ('steel_grade_cross_references_symmetric_uq',
        'steel_grade_cross_references_uq',
        'steel_standard_dimension_applicability_uq',
        'steel_weight_references_source_uq')
      AND indexdef LIKE '%00000000-0000-0000-0000-000000000000%')
  UNION ALL SELECT 'REFERENCE','weight_references_has_unique_source_key',
    to_regclass('public.steel_weight_references_source_uq') IS NOT NULL
  UNION ALL SELECT 'STRUCTURAL','en10210_and_en10219_registered',
    EXISTS (SELECT 1 FROM public.steel_standards WHERE code='EN 10210')
    AND EXISTS (SELECT 1 FROM public.steel_standards WHERE code='EN 10219')
  UNION ALL SELECT 'STRUCTURAL','structural_standards_have_dimension_applicability',
    EXISTS (SELECT 1 FROM public.steel_standard_dimension_applicability a
      JOIN public.steel_standards s ON s.id=a.standard_id WHERE s.code='EN 10210')
    AND EXISTS (SELECT 1 FROM public.steel_standard_dimension_applicability a
      JOIN public.steel_standards s ON s.id=a.standard_id WHERE s.code='EN 10219')
  UNION ALL SELECT 'WEIGHT','published_and_calculated_weight_provenance_separated',
    EXISTS (SELECT 1 FROM public.steel_weight_references WHERE weight_method='published')
    AND EXISTS (SELECT 1 FROM public.steel_weight_references WHERE weight_method='calculated')
  UNION ALL SELECT 'WEIGHT','published_weights_always_have_sources',
    NOT EXISTS (SELECT 1 FROM public.steel_weight_references
      WHERE weight_method='published' AND (knowledge_source_id IS NULL OR weight_kg_m<=0))
  UNION ALL SELECT 'WEIGHT','calculated_weights_not_marked_canonical',
    NOT EXISTS (SELECT 1 FROM public.steel_weight_references
      WHERE weight_method='calculated' AND is_canonical)
  UNION ALL SELECT 'PRESSURE','en10216_and_en10217_series_registered',
    EXISTS (SELECT 1 FROM public.steel_standards WHERE code LIKE 'EN 10216%')
    AND EXISTS (SELECT 1 FROM public.steel_standards WHERE code LIKE 'EN 10217%')
  UNION ALL SELECT 'PRESSURE','p235gh_sample_exists_as_published_weight',
    EXISTS (SELECT 1 FROM public.steel_weight_references w
      JOIN public.steel_geometries g ON g.id=w.geometry_id
      JOIN public.steel_material_grades gr ON gr.id=w.material_grade_id
      WHERE gr.designation_key=public.canonical_steel_token('P235GH')
        AND g.outer_diameter_mm=168.3 AND g.thickness_mm=4.5
        AND w.weight_kg_m=18.180 AND w.weight_method='published'
        AND w.knowledge_source_id IS NOT NULL)
  UNION ALL SELECT 'EN10217','range_envelopes_source_backed_and_incomplete',
    EXISTS (SELECT 1 FROM public.steel_product_range_envelopes)
    AND NOT EXISTS (SELECT 1 FROM public.steel_product_range_envelopes
      WHERE knowledge_source_id IS NULL OR combination_complete)
  UNION ALL SELECT 'EN10217','en_system_normalization_is_lowercase',
    public.canonical_steel_token('EN')='en'
    AND EXISTS (SELECT 1 FROM public.steel_material_grades WHERE standard_system_key='en')
  UNION ALL SELECT 'RECONCILIATION','candidate_function_auth_only',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'
        AND p.proname='p1_shared_steel_weight_reconciliation_candidates'
        AND has_function_privilege('authenticated',p.oid,'EXECUTE')
        AND NOT has_function_privilege('anon',p.oid,'EXECUTE'))
  UNION ALL SELECT 'RECONCILIATION','reconciliation_computes_independent_published_sources',
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public'
        AND p.proname='p1_shared_steel_weight_reconciliation_candidates'
        AND pg_get_functiondef(p.oid) ILIKE '%independence_key%'
        AND pg_get_functiondef(p.oid) ILIKE '%weight_method =%published%')
  UNION ALL SELECT 'REFERENCE','normalized_observations_have_provenance',
    EXISTS (SELECT 1 FROM public.steel_reference_observations)
)
SELECT area,check_name,COALESCE(passes,false) passes
FROM checked ORDER BY area,check_name;