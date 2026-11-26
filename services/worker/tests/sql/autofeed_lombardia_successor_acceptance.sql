-- Isolated fixture only: second audit tile and jitter-tolerant hourly claim.
UPDATE private.net_it_seed1_index_sources SET last_harvested_at=(date_trunc('hour',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')-interval '1 second';
DO $$ DECLARE r jsonb; BEGIN
 r:=private.net_it_seed1_claim_sources_impl(2);
 IF jsonb_array_length(r->'items')<>1 OR r->'items'->0->>'id'<>'00000000-0000-4000-8000-000000000001' THEN RAISE EXCEPTION 'UTC-hour claim failed: %',r; END IF;
 r:=private.net_it_seed1_claim_sources_impl(2);
 IF jsonb_array_length(r->'items')<>0 THEN RAISE EXCEPTION 'repeated same-hour claim'; END IF;
END $$;
SET ROLE service_role;
DO $$ DECLARE r jsonb; BEGIN
 r:=public.net_it_autofeed_stage('00000000-0000-4000-8000-000000000001','[{"domain":"milano.example","url":"https://milano.example/","gers_id":"00000000-0000-4000-8000-000000000012","release":"2026-11-18.0","source_license":"CDLA-Permissive-2.0","region_bucket":"milano_tile","taxonomy":"machine_shop","evidence":"https://github.com/ctimaru/steel-sales-ai/blob/cccccccccccccccccccccccccccccccccccccccc/services/worker/audits/successor.csv"}]');
 IF (r->>'staged')::int<>1 OR (r->>'published')::int<>0 THEN RAISE EXCEPTION 'successor stage failed: %',r; END IF;
END $$;
RESET ROLE;
