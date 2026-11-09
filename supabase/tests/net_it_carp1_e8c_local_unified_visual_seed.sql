-- NET-IT-CARP1.E.8.C — synthetic 121 private E8 rows. Never run on hosted DB.
-- Execute after the Growth100 100-row fixture in an ephemeral local Supabase.
\set ON_ERROR_STOP on
BEGIN;
DO $local$
BEGIN
 IF current_database()<>'postgres' OR inet_server_port() NOT IN (54322,5432)
 THEN RAISE EXCEPTION 'E8C disposable synthetic local fixture only'; END IF;
 IF (SELECT count(*) FROM private.netit_carp1_growth100_bridge)<>100
 THEN RAISE EXCEPTION 'E8C requires original local Growth100 fixture'; END IF;
END $local$;
INSERT INTO public.network_company_discovery_runs(
 id,requested_by,country_code,seed_urls,source_reference,label,status,candidate_count,started_at,completed_at)
SELECT
 CASE x.cohort WHEN 'E8A' THEN '00000000-0000-0000-0000-00000000e8a1'::uuid
               WHEN 'E8B' THEN '00000000-0000-0000-0000-00000000e8b1'::uuid
               ELSE '00000000-0000-0000-0000-00000000e8c1'::uuid END,
 :'netgrowth_auditor_user_id'::uuid,
 'IT',jsonb_build_array('https://synthetic-e8c-qa.invalid/'),
 'NET-IT-CARP1.E.8.'||right(x.cohort,1)||' — synthetic Chrome QA only',
 'FICTIONAL E8 unified Console QA only', 'completed',
 x.n,now()-interval '1 minute',now()
FROM (VALUES ('E8A',21),('E8B',50),('E8C',50)) x(cohort,n);

WITH rows AS (
SELECT r.id AS run_id,
 CASE WHEN r.id='00000000-0000-0000-0000-00000000e8a1'::uuid THEN 'E8A'
      WHEN r.id='00000000-0000-0000-0000-00000000e8b1'::uuid THEN 'E8B'
      ELSE 'E8C' END cohort,
 n
FROM public.network_company_discovery_runs r
CROSS JOIN LATERAL generate_series(1,r.candidate_count) n
WHERE r.id IN (
 '00000000-0000-0000-0000-00000000e8a1'::uuid,
 '00000000-0000-0000-0000-00000000e8b1'::uuid,
 '00000000-0000-0000-0000-00000000e8c1'::uuid)
),
v AS (
SELECT *,
 lower(cohort)||'-synthetic-'||lpad(n::text,3,'0')||'.invalid' domain,
 CASE WHEN n%4=0 THEN 'BL' WHEN n%4=1 THEN 'RI' WHEN n%4=2 THEN 'IS' ELSE 'PN' END province,
 CASE WHEN n%4=0 THEN 'Veneto' WHEN n%4=1 THEN 'Lazio' WHEN n%4=2 THEN 'Molise' ELSE 'Friuli-Venezia Giulia' END region
FROM rows)
INSERT INTO public.network_company_discovery_candidates(
run_id,source_url,canonical_domain,website_url,legal_name,country_code,
role_keys,subtype_keys,product_relations,evidence,source_urls,facility_candidates,
identity_quality,enrichment_quality,quality_flags,review_status,governance_status)
SELECT v.run_id,
'https://'||v.domain||'/',
v.domain,
'https://'||v.domain||'/',
'FICTIONAL E8C '||v.cohort||' Shop '||lpad(v.n::text,3,'0'),
'IT',
ARRAY['processor_service_provider']::text[],ARRAY['fabricator']::text[],
'[{"key":"unverified_product_scope","relationship_type":"not_assessed"}]'::jsonb,
jsonb_build_array(jsonb_build_object('type','synthetic_source','source_url','https://'||v.domain||'/')),
jsonb_build_array('https://'||v.domain||'/'),
jsonb_build_array(jsonb_build_object(
 'region',v.region,'province_code',v.province,'site_kind',
 CASE WHEN v.cohort='E8C' AND v.n<=43 THEN 'research_area_to_verify' ELSE 'source_reported' END
)),
jsonb_build_object('source_kind','synthetic_only','provenance_lane',
 CASE WHEN v.cohort='E8C' AND v.n<=43 THEN 'E8C_RECONCILED_RESEARCH' ELSE 'E8C_NEW_WEB' END),
jsonb_build_object(
 CASE WHEN v.cohort='E8C' THEN 'cohort_intake_e8c' ELSE 'official_contact_20261109' END,
 jsonb_build_object(
 'email',CASE WHEN v.n%2=0 THEN 'team-'||v.n||'@'||v.domain ELSE NULL END,
 'phone',CASE WHEN v.n%3=0 THEN '+39 02 0000'||lpad(v.n::text,3,'0') ELSE NULL END,
 'source_url','https://'||v.domain||'/',
 'source_kind','synthetic_local_only',
 'industrial_capabilities_observed',jsonb_build_array('welding','steel_structures')
)),
CASE WHEN v.cohort='E8C' AND v.n<=43
 THEN ARRAY['province_area_to_verify','legal_identity_not_verified']::text[]
 ELSE ARRAY['legal_identity_not_verified']::text[] END,
'pending_review','unreviewed'
FROM v;

INSERT INTO private.network_web_research_seeds(
country_code,canonical_domain,display_name,proposed_role,source_url,source_summary,research_id,batch_key)
SELECT 'IT','e8c-synthetic-'||lpad(n::text,3,'0')||'.invalid',
'FICTIONAL E8C E8C Shop '||lpad(n::text,3,'0'),
'processor_service_provider',
'https://e8c-synthetic-'||lpad(n::text,3,'0')||'.invalid/',
'FICTIONAL linked research fixture; no real company, data or permissions.',
'NET-IT-E8C-CHROME-'||lpad(n::text,3,'0'),
'NET-IT-CARP1.E.8.C-SYNTHETIC'
FROM generate_series(1,43) n;

DO $assert$
DECLARE v integer;
BEGIN
 SELECT count(*) INTO v
 FROM public.network_company_discovery_candidates c
 JOIN public.network_company_discovery_runs r ON r.id=c.run_id
 WHERE c.country_code='IT' AND
 (r.source_reference LIKE 'NET-IT-CARP1.D.%'
 OR r.source_reference LIKE 'NET-IT-CARP1.E.8.%');
 IF v<>221 THEN RAISE EXCEPTION 'Expected 221 synthetic combined candidates, got %',v; END IF;
 IF (SELECT count(*) FROM public.network_company_discovery_candidates
 WHERE run_id='00000000-0000-0000-0000-00000000e8c1'::uuid
 AND quality_flags @> ARRAY['province_area_to_verify']::text[])<>43
 THEN RAISE EXCEPTION 'Expected 43 marked research-area provinces'; END IF;
END $assert$;
COMMIT;
