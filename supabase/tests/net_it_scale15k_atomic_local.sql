-- NET-IT-SCALE15K C2 isolated end-to-end acceptance.
-- ALL fixture companies/sources are imaginary *.example.test in local Postgres.
-- Everything (including invented approvals and publication) is ROLLED BACK.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.scale15k_assert(ok boolean, msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF NOT COALESCE(ok,false) THEN
   RAISE EXCEPTION 'NET-IT-SCALE15K CI assertion: %',msg;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.scale15k_reject(stmt text, fragment text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 BEGIN
   EXECUTE stmt;
 EXCEPTION WHEN OTHERS THEN
   IF POSITION(LOWER(fragment) IN LOWER(SQLERRM)) > 0 THEN RETURN; END IF;
   RAISE EXCEPTION 'NET-IT-SCALE15K unexpected error: %',SQLERRM;
 END;
 RAISE EXCEPTION 'NET-IT-SCALE15K invalid request unexpectedly succeeded: %',stmt;
END $$;

SELECT pg_temp.scale15k_assert(
 to_regprocedure('public.net_it_scale15k_bulk_publish(uuid[],text,boolean,text,boolean)') IS NOT NULL,
 'bulk publisher SQL migration must be installed in disposable DB'
);
SELECT pg_temp.scale15k_assert(
 NOT has_function_privilege('anon','public.net_it_scale15k_bulk_publish(uuid[],text,boolean,text,boolean)','EXECUTE'),
 'anon must not execute batch publisher'
);
SELECT pg_temp.scale15k_assert(
 NOT EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='net_it_scale15k_bulk_publish' AND p.prosecdef
 ),
 'public wrapper must be SECURITY INVOKER'
);
SELECT pg_temp.scale15k_assert(
 (SELECT enabled FROM private.net_pipeline1b2_settings WHERE singleton=true) IS FALSE,
 'historical publisher must be OFF before any test'
);

DO $owner$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.platform_user_roles WHERE role='platform_superadmin' AND status='active') THEN
  INSERT INTO auth.users(id,email,email_confirmed_at)
  VALUES ('00000000-0000-0000-0000-000000015000'::uuid,
          'net-it-scale15k-owner@example.test',now())
  ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.platform_user_roles(user_id,role,status,granted_by,reason)
  VALUES ('00000000-0000-0000-0000-000000015000'::uuid,
          'platform_superadmin','active',NULL,'SCALE15K isolated CI synthetic user');
 END IF;
END $owner$;

SELECT user_id AS owner_id FROM public.platform_user_roles
WHERE role='platform_superadmin' AND status='active'
LIMIT 1 \gset

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_id',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

SELECT (public.p3_start_company_discovery_batch(
  'IT','["https://it-scale15k-ci-one.example.test/","https://it-scale15k-ci-two.example.test/"]'::jsonb,
  'manual_url','https://it-scale15k-ci-one.example.test/terms',
  'NET-IT-SCALE15K imaginary local source only'
)->>'run_id') AS run_id \gset

SELECT public.pa1_5_review_discovery_run_governance(
 :'run_id'::uuid,'approved','allows_limited_reuse','low_risk',
 'exclude_personal_data',
 'Synthetic CI-only source policy and identity decision, not a real company authorization.'
);
RESET ROLE;

INSERT INTO public.network_company_discovery_candidates(
 id,run_id,source_url,canonical_domain,website_url,legal_name,
 country_code,vat_id,role_keys,subtype_keys,product_relations,
 evidence,source_urls,match_signals,confidence
)
SELECT
 CASE i
  WHEN 1 THEN '00000000-0000-0000-0000-000000015001'::uuid
  ELSE '00000000-0000-0000-0000-000000015002'::uuid
 END,
 :'run_id'::uuid,
 'https://it-scale15k-ci-'||i||'.example.test/company',
 'it-scale15k-ci-'||i||'.example.test',
 'https://it-scale15k-ci-'||i||'.example.test/',
 'NET IT SCALE15K CI SYNTHETIC COMPANY '||i||' S.r.l.',
 'IT','SCALE15KTEST'||i,
 CASE WHEN i=1 THEN ARRAY['producer']::text[]
      ELSE ARRAY['processor_service_provider']::text[] END,
 CASE WHEN i=1 THEN ARRAY['tube_pipe_producer']::text[]
      ELSE ARRAY['fabricator']::text[] END,
 jsonb_build_array(jsonb_build_object('product','steel_tube')),
 jsonb_build_array(jsonb_build_object(
    'url','https://it-scale15k-ci-'||i||'.example.test/company',
    'snippet','Synthetic company-only data in local CI, no actual website'
 )),
 jsonb_build_array('https://it-scale15k-ci-'||i||'.example.test/company'),
 '[]'::jsonb,0.98
FROM generate_series(1,2) i;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_id',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT public.pa1_5_review_discovery_candidate_governance(
 '00000000-0000-0000-0000-000000015001'::uuid,
 'approved_company_data',false,'{}'::text[],
 'SYNTHETIC CI only: I have checked this imaginary business record for unit testing.'
);
SELECT public.pa1_5_review_discovery_candidate_governance(
 '00000000-0000-0000-0000-000000015002'::uuid,
 'approved_company_data',false,'{}'::text[],
 'SYNTHETIC CI only: I have checked this imaginary business record for unit testing.'
);

SELECT pg_temp.scale15k_assert(
 (SELECT count(*) FROM public.network_company_discovery_candidates c
  WHERE c.id IN ('00000000-0000-0000-0000-000000015001'::uuid,
                '00000000-0000-0000-0000-000000015002'::uuid)
  AND c.governance_status='approved_company_data'
  AND (private.net_pipeline1b2_eligibility(c.id)->>'eligible')::boolean)=2,
 'synthetic reviewers must qualify both imaginary candidates'
);

SELECT public.net_it_scale15k_bulk_publish(
 ARRAY['00000000-0000-0000-0000-000000015001'::uuid,
       '00000000-0000-0000-0000-000000015002'::uuid],
 NULL,false,NULL,false
) AS wave_preview \gset

SELECT pg_temp.scale15k_assert(
 (:'wave_preview'::jsonb->>'status')='ready_for_attested_commit'
 AND (:'wave_preview'::jsonb->>'eligible')::integer=2
 AND (:'wave_preview'::jsonb->>'published_now')::integer=0,
 'dry-run must confirm two approvals but zero publication'
);

SELECT pg_temp.scale15k_reject(
 $$SELECT public.net_it_scale15k_bulk_publish(
   ARRAY['00000000-0000-0000-0000-000000015001'::uuid,
         '00000000-0000-0000-0000-000000015001'::uuid],
   NULL,false,NULL,false)$$,
 'Repeated candidate'
);
SELECT pg_temp.scale15k_reject(
 $$SELECT public.net_it_scale15k_bulk_publish(
   ARRAY['00000000-0000-0000-0000-000000015001'::uuid,
         '00000000-0000-0000-0000-000000015002'::uuid],
   '0000000000000000000000000000000000000000000000000000000000000000',
   true,
   'Synthetic CI-only editor attestation: rejected because the preview fingerprint is stale.',
   true)$$,
 'Fresh preview'
);

SELECT public.net_it_scale15k_bulk_publish(
 ARRAY['00000000-0000-0000-0000-000000015001'::uuid,
       '00000000-0000-0000-0000-000000015002'::uuid],
 :'wave_preview'::jsonb->>'manifest_fingerprint',
 true,
 'Synthetic CI-only review: all fictional company identity and role fields have been checked against imaginary test sources. This is not an authorization to republish real records.',
 true
) AS committed_wave \gset
RESET ROLE;

SELECT pg_temp.scale15k_assert(
 (:'committed_wave'::jsonb->>'status')='published'
 AND (:'committed_wave'::jsonb->>'published_count')::integer=2
 AND jsonb_array_length(:'committed_wave'::jsonb->'company_ids')=2,
 'exactly two imaginary companies must commit atomically'
);
SELECT pg_temp.scale15k_assert(
 (SELECT count(*) FROM public.network_companies
  WHERE website_domain LIKE 'it-scale15k-ci-%.example.test'
  AND country_code='IT' AND publication_status='published'
  AND claimed_status='unclaimed' AND verification_status='unverified')=2,
 'both profiles must be canonical published, unclaimed and unverified'
);
SELECT pg_temp.scale15k_assert(
 (SELECT count(*)
  FROM public.network_company_role_assignments a
  JOIN public.network_companies c ON c.id=a.company_id
  JOIN public.network_data_assertions proof ON proof.id=a.source_assertion_id
  WHERE c.website_domain LIKE 'it-scale15k-ci-%.example.test'
    AND proof.asserted_value->>'role_confirmed_by_company'='false')=2,
 'both industrial roles must have auditable, unverified evidence'
);
SELECT pg_temp.scale15k_assert(
 (SELECT count(*) FROM private.net_it_scale15k_publication_waves
  WHERE company_count=2)=1,
 'one append-only audit wave must record the two committed companies'
);
SELECT pg_temp.scale15k_assert(
 (SELECT enabled FROM private.net_pipeline1b2_settings WHERE singleton=true) IS FALSE,
 'historical publisher must be OFF after full success'
);
SELECT pg_temp.scale15k_assert(
 (SELECT count(*) FROM public.network_company_discovery_candidates
  WHERE id IN ('00000000-0000-0000-0000-000000015001'::uuid,
               '00000000-0000-0000-0000-000000015002'::uuid)
    AND review_status='published' AND promoted_company_id IS NOT NULL)=2,
 'both discovery candidates must link to their exact canonical profile'
);

-- All local test approvals, company inserts and ledger records disappear.
ROLLBACK;
