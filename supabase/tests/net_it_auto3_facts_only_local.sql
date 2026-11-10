-- NET-IT-AUTO3: isolated real Postgres first-party facts-only autonomous
-- publication with explicit Owner grant and zero fabricated human approvals.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.auto3_assert(ok boolean,msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(ok,false) THEN
 RAISE EXCEPTION 'NET-IT-AUTO3: %',msg; END IF;
END $$;

SELECT pg_temp.auto3_assert(
 (SELECT enabled FROM private.net_it_auto3_policy WHERE singleton=true) IS FALSE,
 'second delegation must always start OFF'
);
SELECT pg_temp.auto3_assert(
 NOT has_function_privilege('anon','public.net_it_auto3_set_policy(boolean,integer,integer,boolean,text)','EXECUTE')
 AND NOT has_function_privilege('service_role','private.net_it_auto3_release(integer,boolean)','EXECUTE')
 AND NOT has_function_privilege('authenticated','private.net_it_auto3_release(integer,boolean)','EXECUTE'),
 'clients/service_role must not impersonate maintenance agent'
);
SELECT pg_temp.auto3_assert(
 (private.net_it_auto3_release(10,false)->>'status')='delegation_disabled',
 'zero publication prior to real owner grant'
);

DO $owner$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.platform_user_roles
    WHERE role='platform_superadmin' AND status='active') THEN
  INSERT INTO auth.users(id,email,email_confirmed_at)
  VALUES('00000000-0000-0000-0000-000000018000'::uuid,
         'auto3-owner@example.test',now()) ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.platform_user_roles(user_id,role,status,granted_by,reason)
  VALUES('00000000-0000-0000-0000-000000018000'::uuid,
    'platform_superadmin','active',NULL,'AUTO3 test owner in rollback');
 END IF;
END $owner$;
SELECT user_id owner_id FROM public.platform_user_roles
WHERE role='platform_superadmin' AND status='active' LIMIT 1 \gset

-- One-time owner authorization of factual-only risk policy.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_id',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT public.net_it_auto3_set_policy(
 true,1,30,true,
 'Local fixture only: the owner grants machine processing of minimal factual first-party public company names and domain names, retaining all restrictions, with daily cap one, zero copied text and immediate revocation.'
) AS owner_grant \gset
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claim.role','',true);
SELECT pg_temp.auto3_assert(
 (:'owner_grant'::jsonb->>'enabled')::boolean,
 'Owner must activate narrow factual policy explicitly'
);

INSERT INTO auth.users(id,email,email_confirmed_at)
VALUES('00000000-0000-0000-0000-000000018001'::uuid,
       'auto3-source-fixture@example.test',now()) ON CONFLICT(id) DO NOTHING;
SELECT gen_random_uuid() run_id \gset
INSERT INTO public.network_company_discovery_runs(
 id,requested_by,country_code,seed_urls,status,source_type,source_reference,label
) VALUES(
 :'run_id'::uuid,'00000000-0000-0000-0000-000000018001'::uuid,
 'IT','["https://auto3-ci.example.test/"]'::jsonb,
 'queued','web_search_curated','NET-IT-AUTO3 isolated','Auto3 first-party facts CI'
);

INSERT INTO public.network_company_discovery_candidates(
 id,run_id,source_url,canonical_domain,website_url,legal_name,
 country_code,vat_id,role_keys,subtype_keys,product_relations,
 evidence,source_urls,match_signals,confidence,quality_flags
) VALUES(
 '00000000-0000-0000-0000-000000018002'::uuid,:'run_id'::uuid,
 'https://auto3-ci.example.test/chi-siamo','auto3-ci.example.test',
 'https://auto3-ci.example.test/','AUTO3 Metalworking S.r.l.',
 'IT','AUTO3TEST019',
 ARRAY['processor_service_provider']::text[],ARRAY['fabricator']::text[],
 '[{"product":"steel_tube"}]'::jsonb,
 '[{"url":"https://auto3-ci.example.test/chi-siamo","snippet":"Synthetic first-party company identity data"}]'::jsonb,
 '["https://auto3-ci.example.test/chi-siamo"]'::jsonb,'[]'::jsonb,
 0.96,ARRAY['product_scope_not_verified']::text[]
);

-- Independent server reviewer records identity evidence, NOT rights approval.
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT public.net_it_auto2_record(
 '00000000-0000-0000-0000-000000018002'::uuid,
 'net-it-auto2-firstparty-v1','identity_supported','{}'::text[],
 'auto3-ci.example.test',true,'AUTO3 Metalworking S.r.l.',
 'https://auto3-ci.example.test/chi-siamo',
 repeat('b',64),0.94,NULL,'unknown'
) AS evidence \gset
RESET ROLE;
SELECT set_config('request.jwt.claim.role','',true);
SELECT pg_temp.auto3_assert(
 (:'evidence'::jsonb->>'verdict')='identity_supported',
 'first-party AI evidence must be registered without human review'
);

-- Try to forge an agent publication while the Owner policy is enabled,
-- but without an exact private AUTO3 attestation: PA1.5 MUST reject it.
SAVEPOINT no_agent_attestation;
INSERT INTO public.network_companies(
 legal_name,country_code,website_url,website_domain,
 publication_status,claimed_status,verification_status
) VALUES (
 'AUTO3 Metalworking S.r.l.','IT','https://auto3-ci.example.test/',
 'auto3-ci.example.test','published','unclaimed','unverified'
) RETURNING id AS fake_company_id \gset
DO $reject_without_proof$
BEGIN
 UPDATE public.network_company_discovery_candidates
 SET review_status='published',
     publication_actor_type='delegated_agent',
     promoted_company_id=:'fake_company_id'::uuid,
     reviewed_at=now(),reviewed_by=NULL
 WHERE id='00000000-0000-0000-0000-000000018002'::uuid;
 RAISE EXCEPTION 'PA1.5 unexpectedly accepted a forged agent release';
EXCEPTION WHEN SQLSTATE '42501' THEN
 NULL;  -- expected: PA1.5 insists on exact attestation and evidence
END
$reject_without_proof$;
ROLLBACK TO SAVEPOINT no_agent_attestation;
SELECT pg_temp.auto3_assert(
 (SELECT count(*) FROM public.network_companies
   WHERE website_domain='auto3-ci.example.test')=0,
 'unattested synthetic company rollback must remove all possible duplicates'
);

SELECT private.net_it_auto3_release(10,true) AS preflight \gset
SELECT pg_temp.auto3_assert(
 (:'preflight'::jsonb->>'ready')::integer=1
 AND (:'preflight'::jsonb->>'published')::integer=0,
 'preflight confirms one first-party fact-only profile and zero mutation'
);
SELECT private.net_it_auto3_release(10,false) AS commit_result \gset
SELECT pg_temp.auto3_assert(
 (:'commit_result'::jsonb->>'published')::integer=1
 AND (:'commit_result'::jsonb->>'daily_published')::integer=1,
 'automatic publisher must release one company within cap'
);
SELECT pg_temp.auto3_assert(
 (SELECT count(*) FROM public.network_companies n
  WHERE n.website_domain='auto3-ci.example.test' AND n.country_code='IT'
   AND n.publication_status='published' AND n.claimed_status='unclaimed'
   AND n.verification_status='unverified')=1,
 'only minimal unclaimed/unverified factual profile is published'
);
SELECT pg_temp.auto3_assert(
 (SELECT count(*) FROM public.network_company_discovery_candidates
  WHERE id='00000000-0000-0000-0000-000000018002'::uuid
    AND publication_actor_type='delegated_agent' AND reviewed_by IS NULL
    AND review_status='published' AND governance_status='unreviewed')=1,
 'the machine is never misrepresented as a human source reviewer'
);
SELECT pg_temp.auto3_assert(
 (SELECT count(*) FROM public.network_company_discovery_runs
  WHERE id=:'run_id'::uuid AND governance_status='unreviewed'
    AND governance_reviewed_by IS NULL)=1,
 'agent policy never fabricates an approved source or license'
);
SELECT pg_temp.auto3_assert(
 (SELECT count(*) FROM private.net_it_auto3_publications
  WHERE candidate_id='00000000-0000-0000-0000-000000018002'::uuid
  AND actor_type='delegated_agent')=1,
 'machine proof and owner authorization must be auditable'
);
SELECT pg_temp.auto3_assert(
 (SELECT enabled FROM private.net_pipeline1b2_settings
  WHERE singleton=true) IS FALSE,
 'historic global publisher stays disabled'
);
SELECT pg_temp.auto3_assert(
 (private.net_it_auto3_release(10,false)->>'status')='daily_limit_reached',
 'daily cap cannot be bypassed'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_id',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT public.net_it_auto3_set_policy(false) AS revocation \gset
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claim.role','',true);
SELECT pg_temp.auto3_assert(
 (private.net_it_auto3_release(10,false)->>'status')='delegation_disabled',
 'owner revocation blocks next run'
);
SELECT pg_temp.auto3_assert(
 (SELECT count(*) FROM private.net_it_auto3_events
  WHERE event_kind IN ('owner_grant','agent_release','owner_revoke'))=3,
 'all three events must have separate attribution'
);
ROLLBACK;
