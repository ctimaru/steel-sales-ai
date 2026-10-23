-- TRUST-C2G3D — non-destructive function contract and lint repair assertions.
BEGIN;
DO $test$
DECLARE f1 text;f2 text;batch text;
BEGIN
 SELECT pg_get_functiondef('private.p3_enrich_existing_company_discovery_impl(uuid,uuid,text)'::regprocedure) INTO f1;
 SELECT pg_get_functiondef('private.p3_enrich_existing_company_discovery_selected_impl(uuid,uuid,text,boolean,text[],text[])'::regprocedure) INTO f2;
 SELECT pg_get_functiondef('public.netlaunch2_commit_daily(uuid,jsonb,jsonb)'::regprocedure) INTO batch;
 IF position('min(f.id::text)::uuid' in f1)=0 OR position('min(f.id::text)::uuid' in f2)=0
    OR position('min(f.id)' in f1)>0 OR position('min(f.id)' in f2)>0
 THEN RAISE EXCEPTION 'TRUST-C2G3D: UUID aggregate repair not installed'; END IF;
 IF position('accepted=v_accepted' in batch)=0 OR position('skipped=v_skipped' in batch)=0
    OR position('accepted=accepted' in batch)>0
 THEN RAISE EXCEPTION 'TRUST-C2G3D: ambiguous batch counter repair missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc p
  WHERE p.oid='private.p3_enrich_existing_company_discovery_impl(uuid,uuid,text)'::regprocedure
    AND p.prosecdef)
 OR NOT EXISTS(SELECT 1 FROM pg_proc p
  WHERE p.oid='private.p3_enrich_existing_company_discovery_selected_impl(uuid,uuid,text,boolean,text[],text[])'::regprocedure
    AND p.prosecdef) THEN RAISE EXCEPTION 'TRUST-C2G3D: owner security boundary changed'; END IF;
 IF has_function_privilege('anon','public.netlaunch2_commit_daily(uuid,jsonb,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.netlaunch2_commit_daily(uuid,jsonb,jsonb)','EXECUTE')
 THEN RAISE EXCEPTION 'TRUST-C2G3D: unauthorized worker RPC privilege'; END IF;
 IF position('current_user' in batch)=0 OR position('service_role' in batch)=0
 THEN RAISE EXCEPTION 'TRUST-C2G3D: worker guard missing'; END IF;
END $test$;
SELECT (SELECT count(*) FROM pg_proc WHERE oid IN(
  'private.p3_enrich_existing_company_discovery_impl(uuid,uuid,text)'::regprocedure,
  'private.p3_enrich_existing_company_discovery_selected_impl(uuid,uuid,text,boolean,text[],text[])'::regprocedure,
  'public.netlaunch2_commit_daily(uuid,jsonb,jsonb)'::regprocedure)) AS verified_functions;
ROLLBACK;
