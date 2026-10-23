-- TRUST-AUDIT1C.2G.3: role authorization and ledger isolation smoke test.
-- No stored decisions, no secrets or identifying values.
BEGIN;
CREATE OR REPLACE FUNCTION pg_temp.c2g3_assert(ok boolean, msg text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION 'TRUST-C2G3 failure: %', msg; END IF; END $$;
SELECT pg_temp.c2g3_assert(
  (SELECT count(*)=2 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
      ('trust_c2g3_rights_console','trust_c2g3_record_rights_decision')
      AND p.prosecdef AND pg_get_functiondef(p.oid) LIKE '%private.is_platform_superadmin%'),
  'RPCs are security definer with owner check');
SELECT pg_temp.c2g3_assert(
  NOT has_function_privilege('anon','public.trust_c2g3_rights_console(text,text,integer,integer,uuid,text,uuid)','EXECUTE')
  AND NOT has_function_privilege('service_role','public.trust_c2g3_rights_console(text,text,integer,integer,uuid,text,uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.trust_c2g3_rights_console(text,text,integer,integer,uuid,text,uuid)','EXECUTE')
  AND NOT has_function_privilege('anon','public.trust_c2g3_record_rights_decision(text,uuid,text,text,text,text,text,text,text,timestamptz,uuid)','EXECUTE')
  AND NOT has_function_privilege('service_role','public.trust_c2g3_record_rights_decision(text,uuid,text,text,text,text,text,text,text,text,timestamptz,uuid)','EXECUTE')
  AND has_function_privilege('authenticated','public.trust_c2g3_record_rights_decision(text,uuid,text,text,text,text,text,text,text,text,timestamptz,uuid)','EXECUTE'),
  'public/worker denied, signed-in callers must still pass owner check');
SELECT pg_temp.c2g3_assert(
  NOT EXISTS (SELECT 1 FROM private.trust_c2g2_rights_decisions
  WHERE reviewed_by IS NULL AND decision IN('allowed','limited')),
  'no unreviewed grant');
ROLLBACK;
