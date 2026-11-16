-- NET-IT-PIEMONTE2: local acceptance for the private, source-only API.
-- Run only with migrations installed, in disposable/local Supabase.
BEGIN;
DO $tests$
BEGIN
  IF has_function_privilege('anon',
       'public.net_it_piemonte2_contact_claim(integer)','EXECUTE')
    OR has_function_privilege('authenticated',
       'public.net_it_piemonte2_contact_claim(integer)','EXECUTE')
    OR has_function_privilege('anon',
       'public.net_it_piemonte2_contact_record(uuid,uuid,text,integer,text,text,text,text,text)','EXECUTE')
    OR has_function_privilege('authenticated',
       'public.net_it_piemonte2_contact_record(uuid,uuid,text,integer,text,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Public/browser user can run private contact research';
  END IF;
  IF NOT has_function_privilege('service_role',
       'public.net_it_piemonte2_contact_claim(integer)','EXECUTE')
    OR NOT has_function_privilege('service_role',
       'public.net_it_piemonte2_contact_record(uuid,uuid,text,integer,text,text,text,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Existing worker role cannot stage first-party research';
  END IF;
  IF NOT (
    SELECT relrowsecurity FROM pg_catalog.pg_class
    WHERE oid='private.net_it_piemonte2_contact_research'::regclass
  ) THEN
    RAISE EXCEPTION 'Private research history must enable RLS';
  END IF;
END
$tests$;
SET LOCAL ROLE service_role;
SET LOCAL request.jwt.claims = '{"role":"service_role"}';
-- Bound to a max of one; this may claim one test company but the whole
-- transaction rolls back and never publishes companies or facilities.
SELECT (public.net_it_piemonte2_contact_claim(1))->>'contract' AS contract;
RESET ROLE;
ROLLBACK;
