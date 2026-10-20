-- TRADER1D.3B.2 local transactional acceptance. Run AFTER all source migrations.
BEGIN;
DO $$
DECLARE f oid; g oid; h oid;
BEGIN
  f:=to_regprocedure('public.trader1d3b2_source_batch(integer,integer)');
  g:=to_regprocedure('public.trader1d3b2_commit_observations(jsonb)');
  h:=to_regprocedure('public.trader1d3b2_owner_health(uuid[])');
  IF f IS NULL OR g IS NULL OR h IS NULL THEN
    RAISE EXCEPTION 'TRADER1D.3B.2 RPC missing';
  END IF;
  IF has_function_privilege('anon',f,'EXECUTE')
     OR has_function_privilege('authenticated',f,'EXECUTE')
     OR has_function_privilege('anon',g,'EXECUTE')
     OR has_function_privilege('authenticated',g,'EXECUTE')
     OR has_function_privilege('anon',h,'EXECUTE')
     OR NOT has_function_privilege('authenticated',h,'EXECUTE')
     OR NOT has_function_privilege('service_role',f,'EXECUTE')
     OR NOT has_function_privilege('service_role',g,'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected public source RPC grants';
  END IF;
  IF has_table_privilege('anon','private.trader1d3b2_source_observations','SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege('authenticated','private.trader1d3b2_source_observations','SELECT,INSERT,UPDATE,DELETE')
    OR has_table_privilege('service_role','private.trader1d3b2_source_observations','UPDATE,DELETE')
    OR NOT (SELECT relrowsecurity FROM pg_class
      WHERE oid='private.trader1d3b2_source_observations'::regclass) THEN
    RAISE EXCEPTION 'Private immutable source ledger exposed';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=h)
    OR (SELECT prosecdef FROM pg_proc WHERE oid=f)
    OR (SELECT prosecdef FROM pg_proc WHERE oid=g) THEN
    RAISE EXCEPTION 'Source invoker/owner definer boundary incorrect';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='private.trader1d3b2_source_observations'::regclass
      AND tgname='trader1d3b2_no_rewrite'
  ) THEN
    RAISE EXCEPTION 'Source ledger missing immutable trigger';
  END IF;
END $$;

SET LOCAL ROLE authenticated;
SELECT pg_catalog.set_config(
  'request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
DO $$
BEGIN
  BEGIN
    PERFORM public.trader1d3b2_source_batch();
    RAISE EXCEPTION 'Unauthorized live feed passed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.trader1d3b2_commit_observations('[]'::jsonb);
    RAISE EXCEPTION 'Unauthorized insert passed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.trader1d3b2_owner_health(
      ARRAY['00000000-0000-0000-0000-000000000001'::uuid]);
    RAISE EXCEPTION 'Unauthorized source health passed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

SET LOCAL ROLE service_role;
DO $$
DECLARE v jsonb; row jsonb; x jsonb; y jsonb; before_count bigint; after_count bigint;
BEGIN
  v:=public.trader1d3b2_source_batch(5,0);
  IF v->>'contract'<>'trader1d3b2-source-batch-v1'
    OR (v->>'total')::integer < 60
    OR jsonb_array_length(v->'items') NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Live source feed invalid';
  END IF;
  row:=v->'items'->0;
  SELECT count(*) INTO before_count
    FROM private.trader1d3b2_source_observations;
  x:=jsonb_build_array(jsonb_build_object(
     'research_id',row->>'research_id','source_kind',row->>'source_kind',
     'source_url',row->>'source_url','checked_at',now(),
     'status','reachable_html','http_status',200,'content_type','text/html',
     'fingerprint',repeat('a',64)
  ));
  y:=public.trader1d3b2_commit_observations(x);
  IF y->>'contract'<>'trader1d3b2-commit-v1'
    OR (y->>'inserted')::integer<>1
    OR (y->>'published')::integer<>0
    OR (y->>'rights_updated')::integer<>0 THEN
    RAISE EXCEPTION 'Service metadata commit failed';
  END IF;
  y:=public.trader1d3b2_commit_observations(x);
  IF (y->>'inserted')::integer<>0 OR
     (y->>'duplicate_day')::integer<>1 THEN
    RAISE EXCEPTION 'Same-day observation replay was not idempotent';
  END IF;
  SELECT count(*) INTO after_count
    FROM private.trader1d3b2_source_observations;
  IF after_count<>before_count+1 THEN
    RAISE EXCEPTION 'Unexpected metadata observation count';
  END IF;
  BEGIN
    PERFORM public.trader1d3b2_commit_observations(
      jsonb_build_array(jsonb_build_object(
        'research_id',row->>'research_id','source_kind',row->>'source_kind',
        'source_url','https://other-company.example/a',
        'checked_at',now(),'status','reachable_html','http_status',200,
        'fingerprint',repeat('b',64)
      )));
    RAISE EXCEPTION 'Forged URL was accepted';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
