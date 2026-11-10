-- NET-IT-AUTO2: local, disposable PostgreSQL acceptance for evidence-only AI.
-- No publishing, no governance approval. All sample data rolled back.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.auto2_assert(ok boolean,msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(ok,false) THEN
 RAISE EXCEPTION 'NET-IT-AUTO2 acceptance: %',msg; END IF;
END $$;

SELECT pg_temp.auto2_assert(
 to_regprocedure('public.net_it_auto2_queue(integer)') IS NOT NULL
 AND to_regprocedure('public.net_it_auto2_record(uuid,text,text,text[],text,boolean,text,text,text,numeric,text,text)') IS NOT NULL,
 'private AI research API must be installed'
);
SELECT pg_temp.auto2_assert(
 NOT has_function_privilege('anon','public.net_it_auto2_queue(integer)','EXECUTE')
 AND NOT has_function_privilege('authenticated','public.net_it_auto2_queue(integer)','EXECUTE')
 AND NOT has_function_privilege('anon',
 'public.net_it_auto2_record(uuid,text,text,text[],text,boolean,text,text,text,numeric,text,text)','EXECUTE'),
 'only dedicated server role may read private queue or write findings'
);
SELECT pg_temp.auto2_assert(
 (SELECT count(*) FROM private.net_it_auto2_evidence)=0,
 'isolated fresh db should start without agent findings'
);

-- Synthetic test run and candidates; NO approvals assigned.
SELECT gen_random_uuid() run_id \gset
INSERT INTO public.network_company_discovery_runs(
 id,country_code,seed_urls,status,source_type,source_reference,label
) VALUES (
 :'run_id'::uuid,'IT','["https://it-auto2-fixture.example.test/"]'::jsonb,
 'queued','manual_url','NET-IT-AUTO2-CI','AUTO2 fixture source, unreviewed'
);

INSERT INTO public.network_company_discovery_candidates(
 id,run_id,source_url,canonical_domain,website_url,legal_name,
 country_code,vat_id,role_keys,subtype_keys,product_relations,
 evidence,source_urls,match_signals,confidence,quality_flags
) VALUES (
 '00000000-0000-0000-0000-000000017001'::uuid,:'run_id'::uuid,
 'https://it-auto2-fixture.example.test/chi-siamo',
 'it-auto2-fixture.example.test','https://it-auto2-fixture.example.test/',
 'AUTO2 Synthetic Carpenteria S.r.l.','IT','AUTO2TEST123',
 ARRAY['processor_service_provider']::text[],ARRAY['fabricator']::text[],
 '[{"product":"steel_tube"}]'::jsonb,
 '[{"url":"https://it-auto2-fixture.example.test/chi-siamo","snippet":"Invented evidence in local test"}]'::jsonb,
 '["https://it-auto2-fixture.example.test/chi-siamo"]'::jsonb,
 '[]'::jsonb,0.92,
 ARRAY['legal_identity_not_verified']::text[]
);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT public.net_it_auto2_queue(50) queue \gset
RESET ROLE;
SELECT pg_temp.auto2_assert(
 (:'queue'::jsonb->>'contract')='net-it-auto2-queue-v1'
 AND (:'queue'::jsonb->>'publication_authorized')::boolean IS FALSE
 AND (:'queue'::jsonb->>'count')::integer=1,
 'agent queue returns one unreviewed candidate, no right to publish'
);

SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SELECT public.net_it_auto2_record(
 '00000000-0000-0000-0000-000000017001'::uuid,
 'net-it-auto2-test-v1','identity_supported','{}'::text[],
 'it-auto2-fixture.example.test',true,'AUTO2 Synthetic Carpenteria S.r.l.',
 'https://it-auto2-fixture.example.test/chi-siamo',
 repeat('a',64),0.96,NULL,'unknown'
) recorded \gset
RESET ROLE;
SELECT pg_temp.auto2_assert(
 (:'recorded'::jsonb->>'verdict')='identity_supported'
 AND (:'recorded'::jsonb->>'publication_count')::integer=0
 AND (:'recorded'::jsonb->>'candidate_approval_modified')::boolean IS FALSE,
 'machine evidence can support identity but can NEVER publish or approve'
);
SELECT pg_temp.auto2_assert(
 (SELECT count(*) FROM private.net_it_auto2_evidence
  WHERE candidate_id='00000000-0000-0000-0000-000000017001'::uuid
  AND source_rights_state='unknown')=1,
 'unknown rights preserved in private evidence'
);
SELECT pg_temp.auto2_assert(
 (SELECT count(*) FROM public.network_company_discovery_candidates
  WHERE id='00000000-0000-0000-0000-000000017001'::uuid
  AND governance_status='unreviewed'
  AND review_status='pending_review'
  AND governance_reviewed_by IS NULL)=1,
 'human candidate governance cannot be fabricated'
);
SELECT pg_temp.auto2_assert(
 (SELECT count(*) FROM public.network_company_discovery_runs
  WHERE id=:'run_id'::uuid
  AND governance_status='unreviewed'
  AND governance_reviewed_by IS NULL)=1,
 'source rights must remain genuinely unreviewed'
);
SELECT pg_temp.auto2_assert(
 (SELECT count(*) FROM public.network_companies
  WHERE website_domain='it-auto2-fixture.example.test')=0,
 'review engine MUST NOT create a public company'
);
SELECT pg_temp.auto2_assert(
 (SELECT enabled FROM private.net_pipeline1b2_settings
  WHERE singleton=true) IS FALSE,
 'historic publishing switch stays OFF'
);
ROLLBACK;
