-- TRADER1D.2 security acceptance: PRIVATE research stays isolated.
BEGIN;
DO $$
DECLARE
  queue_fn oid := to_regprocedure('public.trader1d2_superadmin_queue(integer,integer,text,uuid)');
  decision_fn oid := to_regprocedure('public.trader1d2_record_decision(uuid,text,text,text,text,text,text,text,text)');
BEGIN
 IF queue_fn IS NULL OR decision_fn IS NULL THEN
   RAISE EXCEPTION 'TRADER1D.2 RPCs missing';
 END IF;
 IF has_function_privilege('anon',queue_fn,'EXECUTE')
   OR has_function_privilege('anon',decision_fn,'EXECUTE')
   OR NOT has_function_privilege('authenticated',queue_fn,'EXECUTE')
   OR NOT has_function_privilege('authenticated',decision_fn,'EXECUTE') THEN
   RAISE EXCEPTION 'TRADER1D.2 unsafe RPC grants';
 END IF;
 IF NOT (SELECT prosecdef FROM pg_proc WHERE oid=queue_fn)
   OR NOT (SELECT prosecdef FROM pg_proc WHERE oid=decision_fn)
   OR NOT (SELECT COALESCE(array_to_string(proconfig,','),'') LIKE '%search_path=""%'
           FROM pg_proc WHERE oid=queue_fn)
   OR NOT (SELECT COALESCE(array_to_string(proconfig,','),'') LIKE '%search_path=""%'
           FROM pg_proc WHERE oid=decision_fn) THEN
   RAISE EXCEPTION 'TRADER1D.2 owner gate must be privileged and pinned';
 END IF;
 IF has_table_privilege('anon','private.netdata1eu_trader_review_decisions','SELECT,INSERT')
   OR has_table_privilege('authenticated','private.netdata1eu_trader_review_decisions','SELECT,INSERT')
   OR has_table_privilege('authenticated','private.netdata1eu_trader_research','SELECT')
   OR NOT (SELECT relrowsecurity FROM pg_class
           WHERE oid='private.netdata1eu_trader_review_decisions'::regclass) THEN
   RAISE EXCEPTION 'TRADER1D.2 private ledger exposed or unprotected';
 END IF;
END $$;

-- A normal authenticated user with a JWT, but NO platform owner row,
-- must not be able to read private queue or append approvals.
SELECT pg_catalog.set_config('request.jwt.claim.sub',
 '00000000-0000-0000-0000-00000000d222',true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    PERFORM public.trader1d2_superadmin_queue();
    RAISE EXCEPTION 'TRADER1D.2 queue unauthorized read succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.trader1d2_record_decision(
      '00000000-0000-0000-0000-00000000d222'::uuid,
      'legal_identity','accepted','https://example.com/legal',
      'This unauthorized approval must be denied before insertion.',
      'Unauthorized GmbH','DE',NULL,NULL);
    RAISE EXCEPTION 'TRADER1D.2 unauthorized decision succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
ROLLBACK;
