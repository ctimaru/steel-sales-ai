-- TEST ONLY, after applying reviewed SQL to the disposable fixture.
REVOKE ALL ON FUNCTION private.net_it_seed1_stage_impl(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.net_it_seed1_stage_impl(uuid,jsonb) TO service_role;
DO $$
BEGIN
 IF has_function_privilege('anon','public.net_it_autofeed_stage(uuid,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.net_it_autofeed_stage(uuid,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'unexpected public privilege'; END IF;
END $$;
SET ROLE service_role;
DO $$
DECLARE
 s uuid := '00000000-0000-4000-8000-000000000001';
 item jsonb := '[{"domain":"canary.example","url":"https://canary.example/","gers_id":"00000000-0000-4000-8000-000000000010","release":"2026-11-18.0","source_license":"CDLA-Permissive-2.0","region_bucket":"lombardia","taxonomy":"metal_fabricator","evidence":"https://github.com/ctimaru/steel-sales-ai/blob/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/services/worker/audits/test.csv"}]';
 r jsonb;
BEGIN
 r:=public.net_it_autofeed_stage(s,item);
 IF r->>'contract'<>'net-it-autofeed-stage-v1' OR (r->>'staged')::integer<>1 OR (r->>'published')::integer<>0 THEN RAISE EXCEPTION 'stage failed: %',r; END IF;
 r:=public.net_it_autofeed_stage(s,item);
 IF (r->>'staged')::integer<>0 OR (r->>'already_known')::integer<>1 THEN RAISE EXCEPTION 'dedup failed'; END IF;
 BEGIN
  PERFORM public.net_it_autofeed_stage(s,jsonb_set(item,'{0,source_license}','"unknown"'));
  RAISE EXCEPTION 'invalid license accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
  PERFORM public.net_it_autofeed_stage('00000000-0000-4000-8000-000000000002',item);
  RAISE EXCEPTION 'generic source accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF (SELECT count(*) FROM private.net_it_seed1_domains)<>1 OR (SELECT count(*) FROM private.net_it_overture_provenance)<>1 THEN RAISE EXCEPTION 'atomic proof or rollback failed'; END IF;
END $$;
DO $
DECLARE r jsonb;
BEGIN
 r:=private.net_it_seed1_claim_sources_impl(2);
 IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') i
   WHERE i->>'id'='00000000-0000-4000-8000-000000000001'
   AND i #>> '{autofeed_checkpoint,after_domain}'='canary.example') THEN
   RAISE EXCEPTION 'persistent cursor not returned: %',r;
 END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(r->'items') i
   WHERE i->>'id'='00000000-0000-4000-8000-000000000002' AND i ? 'autofeed_checkpoint') THEN
   RAISE EXCEPTION 'ordinary source contract changed';
 END IF;
END $;
UPDATE private.test_policy SET active=false;
SET ROLE service_role;
DO $$ BEGIN
 BEGIN
  PERFORM public.net_it_autofeed_stage('00000000-0000-4000-8000-000000000001','[]'::jsonb);
  RAISE EXCEPTION 'expired policy accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
UPDATE private.test_policy SET active=true;
UPDATE private.net_it_seed1_index_sources SET enabled=false WHERE id='00000000-0000-4000-8000-000000000001';
SET ROLE service_role;
DO $$ BEGIN
 BEGIN
  PERFORM public.net_it_autofeed_stage('00000000-0000-4000-8000-000000000001','[]'::jsonb);
  RAISE EXCEPTION 'disabled source accepted';
 EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
RESET ROLE;
