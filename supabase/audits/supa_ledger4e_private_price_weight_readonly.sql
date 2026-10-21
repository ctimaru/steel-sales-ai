-- SUPA-LEDGER4E — private price list & WC3.1 weight intelligence live audit.
-- SELECT ONLY. This is NOT a migration or publishing authorization.
-- Reads metadata and aggregate booleans only; no price values or source document text.
WITH f AS (
  SELECT n.nspname AS schema_name,p.proname,p.oid,pg_get_functiondef(p.oid) AS body
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE (n.nspname='private' AND p.proname IN
    ('pl1_promote_import','pl1_resolve_wc31_en10219_weights',
     'pl1_guard_price_list_version','pl1_guard_weight_link'))
    OR (n.nspname='pl1_private' AND p.proname='version_visible_to')
    OR (n.nspname='public' AND p.proname='pl1_version_visible_to')
), checks AS (
SELECT 'PRIVACY' area,'all_price_list_tables_rls_on' check_name,
  (SELECT count(*)=13 AND bool_and(c.relrowsecurity)
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind IN ('r','p') AND c.relname LIKE 'price_list%') passes
UNION ALL SELECT 'PRIVACY','import_staging_tables_not_anon_readable',
  (SELECT count(*)=4 AND bool_and(NOT has_table_privilege('anon',c.oid,'SELECT'))
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname IN
    ('price_list_import_runs','price_list_import_rows',
     'price_list_import_review_decisions','price_list_import_anomalies'))
UNION ALL SELECT 'PRIVACY','internal_scope_not_visible_to_public_or_authenticated',
  NOT EXISTS (
    SELECT 1 FROM public.price_list_versions v
    WHERE v.publication_scope='internal'
      AND (public.pl1_version_visible_to(v.id,'public')
        OR public.pl1_version_visible_to(v.id,'authenticated'))
  )
UNION ALL SELECT 'PRIVACY','public_read_policy_requires_visibility',
  EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='price_list_versions' AND cmd='SELECT'
    AND 'anon'=ANY(roles) AND qual ILIKE '%pl1_version_visible_to%')
  AND EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public'
    AND tablename='price_list_items' AND cmd='SELECT'
    AND 'anon'=ANY(roles) AND qual ILIKE '%pl1_version_visible_to%')
UNION ALL SELECT 'PRIVACY','visibility_checks_publication_and_source_governance',
  EXISTS (SELECT 1 FROM f WHERE schema_name='pl1_private'
    AND proname='version_visible_to'
    AND body ILIKE '%status = %published%'
    AND body ILIKE '%price_list_source_governance_events%'
    AND body ILIKE '%approved_public%'
    AND body ILIKE '%structured_data_visibility%')
UNION ALL SELECT 'PRIVACY','visibility_public_wrapper_uses_governance_helper',
  EXISTS (SELECT 1 FROM f WHERE schema_name='public'
    AND proname='pl1_version_visible_to' AND body ILIKE '%pl1_private.version_visible_to%')
UNION ALL SELECT 'GOVERNANCE','publication_guard_checks_document_and_governance',
  EXISTS (SELECT 1 FROM f WHERE schema_name='private'
    AND proname='pl1_guard_price_list_version'
    AND body ILIKE '%price_list_source_governance_events%'
    AND body ILIKE '%approved_public%'
    AND body ILIKE '%structured_data_visibility%'
    AND body ILIKE '%knowledge_documents%')
UNION ALL SELECT 'GOVERNANCE','import_promotion_service_role_only',
  EXISTS (SELECT 1 FROM f WHERE schema_name='private' AND proname='pl1_promote_import'
    AND has_function_privilege('service_role',oid,'EXECUTE')
    AND NOT has_function_privilege('authenticated',oid,'EXECUTE')
    AND NOT has_function_privilege('anon',oid,'EXECUTE'))
UNION ALL SELECT 'GOVERNANCE','import_requires_review_ready_and_decisions',
  EXISTS (SELECT 1 FROM f WHERE schema_name='private' AND proname='pl1_promote_import'
    AND body ILIKE '%review_ready%'
    AND body ILIKE '%price_list_import_review_decisions%'
    AND body ILIKE '%validation_status%'
    AND body ILIKE '%price_list_import_rows%')
UNION ALL SELECT 'GOVERNANCE','import_promotion_preserves_source_and_geometry_candidate',
  EXISTS (SELECT 1 FROM f WHERE schema_name='private' AND proname='pl1_promote_import'
    AND body ILIKE '%source_document_id%'
    AND body ILIKE '%geometry_candidate_key%'
    AND body ILIKE '%insert into public.steel_geometries(%')
UNION ALL SELECT 'GOVERNANCE','nonpublic_import_review_decisions_have_rls',
  EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='price_list_import_review_decisions'
    AND c.relrowsecurity AND NOT has_table_privilege('anon',c.oid,'SELECT'))
UNION ALL SELECT 'GEOMETRY','geometry_key_generated_by_database',
  EXISTS (SELECT 1 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='steel_geometries'
    AND a.attname='geometry_key' AND a.attgenerated='s')
UNION ALL SELECT 'GEOMETRY','current_geometries_have_unique_nonempty_keys',
  (SELECT count(*)=count(DISTINCT geometry_key)
      AND count(*)=count(geometry_key)
      AND count(*)>0
      AND count(*) FILTER (WHERE btrim(geometry_key)='')=0
   FROM public.steel_geometries)
UNION ALL SELECT 'GEOMETRY','import_items_retained_source_candidate_column',
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='price_list_items'
    AND column_name='geometry_candidate_key')
UNION ALL SELECT 'GEOMETRY','accepted_geometry_link_matches_candidate_if_declared',
  NOT EXISTS (
    SELECT 1 FROM public.price_list_item_weight_links wl
    JOIN public.price_list_items i ON i.id=wl.price_list_item_id
    JOIN public.steel_geometries g ON g.id=wl.geometry_id
    WHERE wl.resolution_status='accepted'
      AND i.geometry_candidate_key IS NOT NULL
      AND i.geometry_candidate_key<>g.geometry_key
  )
UNION ALL SELECT 'WC31','wc31_resolver_service_role_only',
  EXISTS (SELECT 1 FROM f WHERE schema_name='private'
    AND proname='pl1_resolve_wc31_en10219_weights'
    AND has_function_privilege('service_role',oid,'EXECUTE')
    AND NOT has_function_privilege('authenticated',oid,'EXECUTE')
    AND NOT has_function_privilege('anon',oid,'EXECUTE'))
UNION ALL SELECT 'WC31','wc31_requires_specific_standard_and_candidate_state',
  EXISTS (SELECT 1 FROM f WHERE schema_name='private'
    AND proname='pl1_resolve_wc31_en10219_weights'
    AND body ILIKE '%weight_standard_key=%EN10219%'
    AND body ILIKE '%resolution_status=%candidate%'
    AND body ILIKE '%weight_resolution_mode=%unresolved%')
UNION ALL SELECT 'WC31','wc31_formula_evidence_retained',
  EXISTS (SELECT 1 FROM f WHERE schema_name='private'
    AND proname='pl1_resolve_wc31_en10219_weights'
    AND body ILIKE '%wc3.1-en10219-v1%'
    AND body ILIKE '%standard_formula%'
    AND body ILIKE '%0.00785%')
UNION ALL SELECT 'WC31','wc31_resolved_rows_not_cross_standard',
  NOT EXISTS (SELECT 1 FROM public.price_list_item_weight_links wl
    JOIN public.price_list_items i ON i.id=wl.price_list_item_id
    JOIN public.price_list_sections s ON s.id=i.section_id
    WHERE wl.formula_version='wc3.1-en10219-v1'
      AND s.weight_standard_key IS DISTINCT FROM 'EN10219')
UNION ALL SELECT 'WC31','wc31_accepted_weights_valid_and_scoped',
  NOT EXISTS (SELECT 1 FROM public.price_list_item_weight_links wl
    JOIN public.price_list_items i ON i.id=wl.price_list_item_id
    WHERE wl.formula_version='wc3.1-en10219-v1'
      AND (wl.resolution_status<>'accepted'
       OR wl.resolved_weight_kg_m IS NULL
       OR wl.resolved_weight_kg_m<=0
       OR wl.geometry_id IS NULL))
UNION ALL SELECT 'WC31','accepted_weight_links_have_resolved_weight',
  NOT EXISTS (SELECT 1 FROM public.price_list_item_weight_links wl
    WHERE wl.resolution_status='accepted'
      AND (wl.resolved_weight_kg_m IS NULL OR wl.resolved_weight_kg_m<=0))
UNION ALL SELECT 'WC31','resolved_weight_links_are_immutable',
  EXISTS (SELECT 1 FROM f WHERE schema_name='private'
    AND proname='pl1_guard_weight_link'
    AND body ILIKE '%snapshot is immutable%'
    AND body ILIKE '%weight reference geometry mismatch%')
UNION ALL SELECT 'WC31','all_wc31_formulas_reference_known_geometry',
  NOT EXISTS (SELECT 1 FROM public.price_list_item_weight_links wl
    LEFT JOIN public.steel_geometries g ON g.id=wl.geometry_id
    WHERE wl.formula_version='wc3.1-en10219-v1'
      AND (g.id IS NULL OR g.thickness_mm<=0))
)
SELECT area,check_name,coalesce(passes,false) passes
FROM checks ORDER BY area,check_name;