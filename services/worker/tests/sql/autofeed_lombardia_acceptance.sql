-- Run after existing acceptance fixture; re-enable source for second migration test.
UPDATE private.net_it_seed1_index_sources SET enabled=true, min_interval_hours=168, last_harvested_at=now()-interval '2 hours';
DO $$ DECLARE r jsonb; BEGIN
 r:=private.net_it_seed1_claim_sources_impl(2);
 IF jsonb_array_length(r->'items')<>1 OR r->'items'->0->>'id'<>'00000000-0000-4000-8000-000000000001' THEN RAISE EXCEPTION 'local audit cadence or ordinary source interval changed: %',r; END IF;
END $$;
SET ROLE service_role;
DO $$ DECLARE
 s uuid:='00000000-0000-4000-8000-000000000001';
 item jsonb:='[{"domain":"officina.example","url":"https://officina.example/","gers_id":"00000000-0000-4000-8000-000000000011","release":"2026-11-18.0","source_license":"CDLA-Permissive-2.0","region_bucket":"bergamo_tile","taxonomy":"machine_shop","evidence":"https://github.com/ctimaru/steel-sales-ai/blob/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb/services/worker/audits/regional.csv"}]';
 r jsonb;
BEGIN
 r:=public.net_it_autofeed_stage(s,item);
 IF (r->>'staged')::int<>1 OR (r->>'published')::int<>0 THEN RAISE EXCEPTION 'regional intake failed: %',r; END IF;
 BEGIN PERFORM public.net_it_autofeed_stage(s,jsonb_set(item,'{0,taxonomy}','"school"')); RAISE EXCEPTION 'nonindustrial accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.net_it_overture_provenance WHERE domain='officina.example' AND regional_bucket='bergamo_tile' AND place_taxonomy='machine_shop') THEN RAISE EXCEPTION 'regional provenance missing'; END IF;
END $$;
