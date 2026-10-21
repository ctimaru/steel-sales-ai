-- SUPA-LEDGER5B: production provenance probes, SELECT ONLY.
-- The presence of an object is NOT proof its historical migration was executed.
WITH candidates(origin,migration_name,schema_name,object_name,kind) AS (
 VALUES
 ('LOCAL_ONLY','add_controlled_pilot_runs','public','pilot_runs','table'),
 ('LOCAL_ONLY','add_human_correction_promotion_loop','public','commercial_correction_events','table'),
 ('LOCAL_ONLY','add_normalization_coverage_backlog','public','p1_normalization_coverage','function'),
 ('LOCAL_ONLY','add_pilot_exit_readiness','public','p1_pilot_exit_readiness','function'),
 ('LOCAL_ONLY','add_pilot_human_evidence_checkpoint','public','pilot_human_evidence','table'),
 ('LOCAL_ONLY','add_pilot_usage_analytics','public','pilot_usage_events','table'),
 ('LOCAL_ONLY','bd1_buyer_distinta','public','buyer_distintas','table'),
 ('LOCAL_ONLY','expand_worker_staging_observations','public','worker_staging_observations','table'),
 ('LOCAL_ONLY','school6b_ai_budget','private','school6b_ai_quota_user','table'),
 ('LOCAL_ONLY','sec1_public_rpc_privilege_boundary','public','k2_public_knowledge_grade','function'),
 ('LOCAL_ONLY','trader1d3b2_live_source_intelligence','private','trader1d3b2_source_observations','table'),
 ('LOCAL_ONLY','worker_jobs_staging','public','worker_jobs','table'),
 ('REMOTE_ONLY','initial_commercial_schema','public','rfqs','table'),
 ('REMOTE_ONLY','netfast_profile_api_grants','public','netfast_free_profile','function'),
 ('REMOTE_ONLY','netlaunch5e_fix_authenticated_browse_rpc_permissions','public','netlaunch4b_browse_page','function'),
 ('REMOTE_ONLY','pp1_1_publication_rights_source_terms','public','price_list_source_governance_events','table'),
 ('REMOTE_ONLY','pp1_1_readiness_rights_event_filter','public','pl1_publication_readiness','function'),
 ('REMOTE_DUPLICATE','pa1_4_claim_conversion_registration_handoff','private','pa1_4_guard_registration_identity_targets','function')
),
presence AS (
 SELECT origin,migration_name,
 CASE WHEN kind='table' THEN EXISTS(
   SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname=schema_name AND c.relname=object_name AND c.relkind IN ('r','p'))
 ELSE EXISTS(
   SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname=schema_name AND p.proname=object_name) END AS present
 FROM candidates
),
duplicates AS (
 SELECT name,count(*) AS versions,count(DISTINCT (
   encode(extensions.digest(statements[1],'sha256'),'hex'),
   octet_length(statements[1])
 )) AS distinct_original_sql
 FROM supabase_migrations.schema_migrations
 GROUP BY name HAVING count(*)>1
)
SELECT 'OBJECT_PRESENCE' evidence_type,origin, migration_name,
 CASE WHEN present THEN 'OBJECT_FOUND' ELSE 'OBJECT_NOT_FOUND' END observation,
 NULL::integer variants
FROM presence
UNION ALL
SELECT 'DUPLICATE_SQL_VARIANTS','REMOTE_DUPLICATE',name,
 CASE WHEN distinct_original_sql=1 THEN 'SAME_SQL_DIFFERENT_HISTORY_VERSIONS'
 ELSE 'DIFFERENT_SQL_SAME_NAME' END,
 distinct_original_sql
FROM duplicates
ORDER BY evidence_type,origin,migration_name;