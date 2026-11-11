-- NET-IT-GROWTH1: the legacy "legal_identity_not_verified" hold is cleared ONLY
-- by v2 first-party evidence. v1 evidence and sole-trader context stay blocked.
-- Runs on a disposable local database, everything inside one ROLLBACK.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.g1_assert(ok boolean,msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(ok,false) THEN
 RAISE EXCEPTION 'NET-IT-GROWTH1: %',msg; END IF;
END $$;

DO $owner$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.platform_user_roles
    WHERE role='platform_superadmin' AND status='active') THEN
  INSERT INTO auth.users(id,email,email_confirmed_at)
  VALUES('00000000-0000-0000-0000-000000019000'::uuid,
         'growth1-owner@example.test',now()) ON CONFLICT(id) DO NOTHING;
  INSERT INTO public.platform_user_roles(user_id,role,status,granted_by,reason)
  VALUES('00000000-0000-0000-0000-000000019000'::uuid,
    'platform_superadmin','active',NULL,'GROWTH1 test owner in rollback');
 END IF;
END $owner$;
SELECT user_id owner_id FROM public.platform_user_roles
WHERE role='platform_superadmin' AND status='active' LIMIT 1 \gset

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub',:'owner_id',true);
SELECT set_config('request.jwt.claim.role','authenticated',true);
SELECT public.net_it_auto3_set_policy(
 true,10,30,true,
 'Local fixture only: the owner grants machine processing of minimal factual first-party public company names and domain names, retaining all restrictions, with daily cap ten, zero copied text and immediate revocation.'
) AS owner_grant \gset
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claim.role','',true);

INSERT INTO auth.users(id,email,email_confirmed_at)
VALUES('00000000-0000-0000-0000-000000019001'::uuid,
       'growth1-source-fixture@example.test',now()) ON CONFLICT(id) DO NOTHING;
SELECT gen_random_uuid() run_id \gset
INSERT INTO public.network_company_discovery_runs(
 id,requested_by,country_code,seed_urls,status,source_type,source_reference,label
) VALUES(
 :'run_id'::uuid,'00000000-0000-0000-0000-000000019001'::uuid,
 'IT','["https://g1-a.example.test/"]'::jsonb,
 'queued','web_search_curated','NET-IT-GROWTH1 isolated','Growth1 legacy hold CI'
);

-- A: legacy hold + v1 evidence      -> must NOT publish
-- B: legacy hold + v2 evidence      -> publishes
-- C: legacy hold + sole-trader + v2 -> must NOT publish
INSERT INTO public.network_company_discovery_candidates(
 id,run_id,source_url,canonical_domain,website_url,legal_name,
 country_code,vat_id,role_keys,subtype_keys,product_relations,
 evidence,source_urls,match_signals,confidence,quality_flags
)
SELECT v.id::uuid,:'run_id'::uuid,
 'https://'||v.d||'/contatti',v.d,'https://'||v.d||'/',v.n,
 'IT',v.vat,ARRAY['processor_service_provider']::text[],ARRAY['fabricator']::text[],
 '[{"product":"steel_tube"}]'::jsonb,
 jsonb_build_array(jsonb_build_object('url','https://'||v.d||'/contatti','snippet','Synthetic first-party identity')),
 jsonb_build_array('https://'||v.d||'/contatti'),'[]'::jsonb,0.96,v.flags
FROM (VALUES
 ('00000000-0000-0000-0000-000000019002','g1-a.example.test','Growth Alfa Tubi S.r.l.','G1TEST00001',
   ARRAY['legal_identity_not_verified','product_scope_not_verified']::text[]),
 ('00000000-0000-0000-0000-000000019003','g1-b.example.test','Growth Beta Acciai S.p.A.','G1TEST00002',
   ARRAY['legal_identity_not_verified','province_area_to_verify']::text[]),
 ('00000000-0000-0000-0000-000000019004','g1-c.example.test','Growth Gamma Lamiere S.r.l.','G1TEST00003',
   ARRAY['legal_identity_not_verified','historical_sole_trader_vat_context']::text[])
) v(id,d,n,vat,flags);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT public.net_it_auto2_record(
 '00000000-0000-0000-0000-000000019002'::uuid,'net-it-auto2-firstparty-v1',
 'identity_supported','{}'::text[],'g1-a.example.test',true,'Growth Alfa Tubi S.r.l.',
 'https://g1-a.example.test/contatti',repeat('a',64),0.94,NULL,'unknown') AS ev_a \gset
SELECT public.net_it_auto2_record(
 '00000000-0000-0000-0000-000000019003'::uuid,'net-it-auto2-firstparty-v2',
 'identity_supported','{}'::text[],'g1-b.example.test',true,'Growth Beta Acciai S.p.A.',
 'https://g1-b.example.test/contatti',repeat('b',64),0.94,NULL,'unknown') AS ev_b \gset
SELECT public.net_it_auto2_record(
 '00000000-0000-0000-0000-000000019004'::uuid,'net-it-auto2-firstparty-v2',
 'identity_supported','{}'::text[],'g1-c.example.test',true,'Growth Gamma Lamiere S.r.l.',
 'https://g1-c.example.test/contatti',repeat('c',64),0.94,NULL,'unknown') AS ev_c \gset
RESET ROLE;
SELECT set_config('request.jwt.claim.role','',true);

SELECT pg_temp.g1_assert(
 (:'ev_c'::jsonb->>'verdict')='needs_human',
 'sole-trader context is downgraded to a human exception at record time'
);

-- PA1.5 must refuse a hand-built agent release backed by v1 evidence.
SAVEPOINT forged_v1;
DO $forge$
DECLARE v_company uuid; v_ev uuid;
BEGIN
 INSERT INTO public.network_companies(
  legal_name,country_code,website_url,website_domain,
  publication_status,claimed_status,verification_status
 ) VALUES ('Growth Alfa Tubi S.r.l.','IT','https://g1-a.example.test/',
  'g1-a.example.test','published','unclaimed','unverified')
 RETURNING id INTO v_company;
 INSERT INTO private.net_pipeline1b2_publication_ledger(
  candidate_id,company_id,source_url,source_domain,classification,executed_by
 ) VALUES ('00000000-0000-0000-0000-000000019002'::uuid,v_company,
  'https://g1-a.example.test/contatti','g1-a.example.test','minimal_unverified',NULL);
 SELECT id INTO v_ev FROM private.net_it_auto2_evidence
  WHERE candidate_id='00000000-0000-0000-0000-000000019002'::uuid;
 INSERT INTO private.net_it_auto3_publications(candidate_id,company_id,evidence_id,authorized_by)
 SELECT '00000000-0000-0000-0000-000000019002'::uuid,v_company,v_ev,authorized_by
 FROM private.net_it_auto3_policy WHERE singleton;
 UPDATE public.network_company_discovery_candidates
 SET review_status='published',publication_actor_type='delegated_agent',
     promoted_company_id=v_company,reviewed_at=now(),reviewed_by=NULL
 WHERE id='00000000-0000-0000-0000-000000019002'::uuid;
 RAISE EXCEPTION 'PA1.5 accepted v1 evidence for a legacy identity hold';
EXCEPTION WHEN SQLSTATE '42501' THEN
 NULL;  -- expected
END
$forge$;
ROLLBACK TO SAVEPOINT forged_v1;

-- Positive control: the identical hand-built sequence with v2 evidence passes,
-- so the refusal above is caused by the evidence version, not by the fixture.
SAVEPOINT control_v2;
DO $control$
DECLARE v_company uuid; v_ev uuid;
BEGIN
 INSERT INTO public.network_companies(
  legal_name,country_code,website_url,website_domain,
  publication_status,claimed_status,verification_status
 ) VALUES ('Growth Beta Acciai S.p.A.','IT','https://g1-b.example.test/',
  'g1-b.example.test','published','unclaimed','unverified')
 RETURNING id INTO v_company;
 INSERT INTO private.net_pipeline1b2_publication_ledger(
  candidate_id,company_id,source_url,source_domain,classification,executed_by
 ) VALUES ('00000000-0000-0000-0000-000000019003'::uuid,v_company,
  'https://g1-b.example.test/contatti','g1-b.example.test','minimal_unverified',NULL);
 SELECT id INTO v_ev FROM private.net_it_auto2_evidence
  WHERE candidate_id='00000000-0000-0000-0000-000000019003'::uuid;
 INSERT INTO private.net_it_auto3_publications(candidate_id,company_id,evidence_id,authorized_by)
 SELECT '00000000-0000-0000-0000-000000019003'::uuid,v_company,v_ev,authorized_by
 FROM private.net_it_auto3_policy WHERE singleton;
 UPDATE public.network_company_discovery_candidates
 SET review_status='published',publication_actor_type='delegated_agent',
     promoted_company_id=v_company,reviewed_at=now(),reviewed_by=NULL
 WHERE id='00000000-0000-0000-0000-000000019003'::uuid;
END
$control$;
ROLLBACK TO SAVEPOINT control_v2;

SELECT private.net_it_auto3_release(10,true) AS preflight \gset
SELECT pg_temp.g1_assert(
 (:'preflight'::jsonb->>'ready')::integer=1
 AND (:'preflight'::jsonb->'results'->0->>'candidate_id')='00000000-0000-0000-0000-000000019003',
 'only the v2-evidenced legacy candidate is ready'
);
SELECT private.net_it_auto3_release(10,false) AS commit_result \gset
SELECT pg_temp.g1_assert(
 (:'commit_result'::jsonb->>'published')::integer=1,
 'exactly one company released'
);
SELECT pg_temp.g1_assert(
 (SELECT count(*) FROM public.network_companies
  WHERE website_domain='g1-b.example.test' AND publication_status='published'
    AND claimed_status='unclaimed' AND verification_status='unverified')=1
 AND (SELECT count(*) FROM public.network_companies
  WHERE website_domain IN ('g1-a.example.test','g1-c.example.test'))=0,
 'B published as minimal unverified profile; A and C untouched'
);
SELECT pg_temp.g1_assert(
 (SELECT count(*) FROM public.network_company_discovery_candidates
  WHERE id IN ('00000000-0000-0000-0000-000000019002','00000000-0000-0000-0000-000000019004')
    AND review_status='pending_review')=2,
 'v1 and sole-trader candidates stay pending'
);
SELECT pg_temp.g1_assert(
 (SELECT enabled FROM private.net_pipeline1b2_settings WHERE singleton=true) IS FALSE,
 'historic global publisher stays disabled'
);
ROLLBACK;
