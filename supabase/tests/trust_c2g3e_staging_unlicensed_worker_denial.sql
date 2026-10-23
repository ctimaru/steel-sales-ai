-- TRUST-AUDIT1C.2G.3E: Staging negative-network E2E, no licensing bypass.
-- Designed for an isolated transaction in staging where live source is not approved.
BEGIN;
INSERT INTO public.network_netlaunch2_runs(run_day,industry_ids,offsets,status)
VALUES((now() at time zone 'UTC')::date,ARRAY['Q2285982','Q1924906']::text[],
  '{"Q2285982":0,"Q1924906":0}'::jsonb,'claimed');
DO $test$
DECLARE run_id uuid; denied boolean:=false;
BEGIN
 SELECT id INTO run_id FROM public.network_netlaunch2_runs
 WHERE run_day=(now() at time zone 'UTC')::date;
 BEGIN
   EXECUTE 'SET LOCAL ROLE service_role';
   PERFORM public.netlaunch2_commit_daily(run_id,'[]'::jsonb,
      '{"Q2285982":0,"Q1924906":0}'::jsonb);
 EXCEPTION WHEN insufficient_privilege THEN denied:=true;
 END;
 IF NOT denied THEN
   RAISE EXCEPTION 'TRUST-C2G3E: source governance denial bypassed';
 END IF;
END $test$;
ROLLBACK;
