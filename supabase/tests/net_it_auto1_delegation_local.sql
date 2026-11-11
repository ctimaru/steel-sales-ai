-- NET-IT-AUTO1: One-time owner grant, automated already-reviewed release,
-- provenance, revocation and daily cap, entirely on disposable local DB.
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.auto1_assert(ok boolean, msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF NOT coalesce(ok,false) THEN
   RAISE EXCEPTION 'NET-IT-AUTO1 CI: %',msg;
 END IF;
END $$;

SELECT pg_temp.auto1_assert(
 NOT has_function_privilege('anon',
   'public.net_it_auto1_set_delegation(boolean,integer,integer,boolean,text)','EXECUTE')
 AND NOT has_function_privilege('anon','public.net_it_auto1_status()','EXECUTE'),
 'anonymous users must not use owner agent controls'
);
SELECT pg_temp.auto1_assert(
 NOT has_function_privilege('authenticated',
   'private.net_it_auto1_release(integer,boolean)','EXECUTE')
 AND NOT has_function_privilege('service_role',
   'private.net_it_auto1_release(integer,boolean)','EXECUTE'),
 'no user browser or service API may execute agent publication'
);
SELECT pg_temp.auto1_assert(
 (SELECT enabled FROM private.net_it_auto1_delegation WHERE singleton=true) IS FALSE,
 'agent starts disabled, independent of old publisher'
);

DO $owner$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.platform_user_roles WHERE role='platform_superadmin' AND status='active') THEN
  INSERT INTO auth.users(id,email,email_confirmed_at)
  VALUES('00000000-0000-0000-0000-000000016000'::uuid,
        'net-it-auto1-owner@example.test',now()) ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.platform_user_roles(user_id,role,status,granted_by,reason)
  VALUES('00000000-0000-0000-0000-000000016000'::uuid,
    'platform_superadmin','active',NULL,'NET-IT-AUTO1 temporary local owner');
 END IF;
END
$owner$;

SELECT user_id owner_id FROM public.platform_user_roles
WHERE role='platform_superadmin' AND status='active' LIMIT 1 \gset

SELECT (private.net_it_auto1_release(50,false)->>'status') AS before_grant \gset
SELECT pg_temp.auto1_assert(:'before_grant'='delegation_disabled',
 'executor must refuse before a real owner grant'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_id',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

SELECT (public.net_it_auto1_set_delegation(
 true,1,30,true,
 'In this imaginary isolated database test, the owner delegates only previously human-approved minimal company publications for thirty days, with a daily cap of one.'
)->>'enabled')::boolean AS granted \gset

RESET ROLE;
SELECT pg_temp.auto1_assert(:'granted'::boolean,
 'owner grant must be accepted');
SELECT pg_temp.auto1_assert(
 (SELECT enabled FROM private.net_it_auto1_delegation WHERE singleton=true),
 'owner grant must be stored'
);

-- Create one fully synthetic source and company using normal governance RPCs.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_id',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);

SELECT (public.p3_start_company_discovery_batch(
 'IT','["https://it-auto1-ci.example.test/"]'::jsonb,
 'manual_url','https://it-auto1-ci.example.test/terms',
 'NET-IT-AUTO1 imaginary source for CI only'
)->>'run_id') AS run_id \gset

SELECT public.pa1_5_review_discovery_run_governance(
 :'run_id'::uuid,'approved','allows_limited_reuse','low_risk','company_data_only',
 'Local synthetic legal/rights review; not a claim about any real website.'
);
RESET ROLE;

INSERT INTO public.network_company_discovery_candidates(
 id,run_id,source_url,canonical_domain,website_url,legal_name,
 country_code,vat_id,role_keys,subtype_keys,product_relations,
 evidence,source_urls,match_signals,confidence
) VALUES (
 '00000000-0000-0000-0000-000000016001'::uuid,:'run_id'::uuid,
 'https://it-auto1-ci.example.test/company','it-auto1-ci.example.test',
 'https://it-auto1-ci.example.test/',
 'NET IT AUTO1 LOCAL TEST COMPANY S.r.l.','IT','NETITAUTO1TEST',
 ARRAY['producer']::text[],ARRAY['tube_pipe_producer']::text[],
 '[{"product":"steel_tube"}]'::jsonb,
 '[{"url":"https://it-auto1-ci.example.test/company","snippet":"Imaginary company in a local database only"}]'::jsonb,
 '["https://it-auto1-ci.example.test/company"]'::jsonb,
 '[]'::jsonb,0.95
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_id',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT public.pa1_5_review_discovery_candidate_governance(
 '00000000-0000-0000-0000-000000016001'::uuid,
 'approved_company_data',false,'{}'::text[],
 'Local synthetic company identity verification for the NET-IT-AUTO1 isolated test.'
);
RESET ROLE;
-- Remove the JWT claim: the agent runs as postgres, not on behalf of owner.
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claim.role','',true);

SELECT private.net_it_auto1_release(50,true) AS preview \gset
SELECT pg_temp.auto1_assert(
 (:'preview'::jsonb->>'status')='dry_run'
 AND jsonb_array_length(:'preview'::jsonb->'results')=1
 AND (:'preview'::jsonb->>'published')::integer=0,
 'agent must preview one approved company with zero writes'
);
SELECT private.net_it_auto1_release(50,false) AS result \gset
SELECT pg_temp.auto1_assert(
 (:'result'::jsonb->>'status')='published'
 AND (:'result'::jsonb->>'published')::integer=1
 AND (:'result'::jsonb->>'daily_published')::integer=1,
 'agent must publish exactly one already approved company'
);
SELECT pg_temp.auto1_assert(
 (SELECT count(*) FROM public.network_companies n WHERE
  n.website_domain='it-auto1-ci.example.test'
  AND n.country_code='IT' AND n.publication_status='published'
  AND n.claimed_status='unclaimed' AND n.verification_status='unverified')=1,
 'minimal company must be unclaimed and unverified'
);
SELECT pg_temp.auto1_assert(
 (SELECT count(*) FROM public.network_company_discovery_candidates
  WHERE id='00000000-0000-0000-0000-000000016001'::uuid
    AND publication_actor_type='delegated_agent'
    AND reviewed_by IS NULL
    AND review_status='published')=1,
 'the explicit agent origin must not impersonate a human reviewer'
);
SELECT pg_temp.auto1_assert(
 (SELECT count(*) FROM private.net_it_auto1_publications p
  WHERE p.candidate_id='00000000-0000-0000-0000-000000016001'::uuid
    AND p.executed_by_kind='delegated_agent'
    AND p.proof_candidate_reviewed_by IS NOT NULL
    AND p.proof_source_reviewed_by IS NOT NULL)=1,
 'agent audit must distinguish machine execution from original human reviews'
);
SELECT pg_temp.auto1_assert(
 (SELECT count(*) FROM public.network_company_role_assignments a
  JOIN public.network_companies n ON n.id=a.company_id
  JOIN public.network_data_assertions proof ON proof.id=a.source_assertion_id
  WHERE n.website_domain='it-auto1-ci.example.test'
    AND proof.asserted_by IS NULL
    AND proof.asserted_value->>'origin'='delegated_agent')=1,
 'machine role evidence must not impersonate human reviewer'
);
SELECT pg_temp.auto1_assert(
 (SELECT enabled FROM private.net_pipeline1b2_settings WHERE singleton=true) IS FALSE,
 'old publisher must remain OFF'
);
SELECT (private.net_it_auto1_release(50,false)->>'status') AS limit_status \gset
SELECT pg_temp.auto1_assert(:'limit_status'='daily_limit_reached',
 'daily publication limit must block further automatic release'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_id',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT public.net_it_auto1_set_delegation(false);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claim.role','',true);
SELECT pg_temp.auto1_assert(
 (private.net_it_auto1_release(50,false)->>'status')='delegation_disabled',
 'revocation must block next agent release'
);
SELECT pg_temp.auto1_assert(
 (SELECT count(*) FROM private.net_it_auto1_events
 WHERE event_kind IN ('owner_granted','owner_revoked','agent_published'))=3,
 'owner grant, automated release and owner revoke must be separately audited'
);

ROLLBACK;
