-- Isolated local schema/rebuild contract test. Do NOT run as production mutation.
BEGIN;
create or replace function pg_temp.assert_true(p_ok boolean,p_message text)
returns void language plpgsql as $body$
begin
 if not coalesce(p_ok,false) then raise exception 'AUTO1.A.4.2 failed: %',p_message; end if;
end;
$body$;
select pg_temp.assert_true(
 to_regclass('private.network_producer_auto1_detail_pages') is not null
 and to_regclass('private.network_producer_auto1_detail_candidates') is not null,
 'Second-level page and private candidate tables exist');
select pg_temp.assert_true(
 (select relrowsecurity from pg_class where oid='private.network_producer_auto1_detail_pages'::regclass)
 and (select relrowsecurity from pg_class where oid='private.network_producer_auto1_detail_candidates'::regclass),
 'RLS is enabled on both private tables');
select pg_temp.assert_true(
 not has_table_privilege('anon','private.network_producer_auto1_detail_pages','SELECT')
 and not has_table_privilege('authenticated','private.network_producer_auto1_detail_pages','SELECT')
 and not has_table_privilege('anon','private.network_producer_auto1_detail_candidates','SELECT')
 and not has_table_privilege('authenticated','private.network_producer_auto1_detail_candidates','SELECT'),
 'No direct public or tenant read of unpublished technical evidence');
select pg_temp.assert_true(
 to_regprocedure('public.netproducers1_auto1a4_discover(uuid,text,jsonb)') is not null
 and to_regprocedure('public.netproducers1_auto1a4_claim_pages(integer)') is not null
 and to_regprocedure('public.netproducers1_auto1a4_complete_page(uuid,text,text,jsonb,text,text,text)') is not null
 and to_regprocedure('public.netproducers1_auto1a4_status()') is not null,
 'Bounded service-only RPC set exists');
select pg_temp.assert_true(
 not has_function_privilege('anon','public.netproducers1_auto1a4_discover(uuid,text,jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','public.netproducers1_auto1a4_discover(uuid,text,jsonb)','EXECUTE')
 and not has_function_privilege('anon','public.netproducers1_auto1a4_claim_pages(integer)','EXECUTE')
 and not has_function_privilege('authenticated','public.netproducers1_auto1a4_claim_pages(integer)','EXECUTE')
 and not has_function_privilege('anon','public.netproducers1_auto1a4_complete_page(uuid,text,text,jsonb,text,text,text)','EXECUTE')
 and not has_function_privilege('authenticated','public.netproducers1_auto1a4_complete_page(uuid,text,text,jsonb,text,text,text)','EXECUTE')
 and not has_function_privilege('anon','public.netproducers1_auto1a4_status()','EXECUTE')
 and not has_function_privilege('authenticated','public.netproducers1_auto1a4_status()','EXECUTE')
 and has_function_privilege('service_role','public.netproducers1_auto1a4_claim_pages(integer)','EXECUTE'),
 'Only service role may discover/lease/write/read A4 queue');
select pg_temp.assert_true(
 (private.netproducers1_auto1a4_status()->>'published_capabilities')::int=0,
 'No technical capability is published by intake');
select pg_temp.assert_true(
 exists (select 1 from information_schema.columns where table_schema='private'
 and table_name='network_producer_auto1_product_pages'
 and column_name='detail_discovery_sha256'),
 'First-level page records stable A4 discovery SHA');
select pg_temp.assert_true(
 pg_get_functiondef('private.netproducers1_auto1a3_claim_pages(integer)'::regprocedure)
 like '%needs_detail_discovery%',
 'Existing HTML is re-fetched once for detail discovery');
select pg_temp.assert_true(
 (select count(*) from pg_policies where schemaname='private'
 and tablename in ('network_producer_auto1_detail_pages','network_producer_auto1_detail_candidates'))=0,
 'No end-user RLS policy accidentally exposes the queue');
DO $body$
BEGIN
 BEGIN
  PERFORM private.netproducers1_auto1a4_discover(
   '00000000-0000-0000-0000-000000000000'::uuid,
   repeat('a',64),
   jsonb_build_array(jsonb_build_object('url','https://evil.test/products/rhs',
     'parent_url','https://evil.test/products','parent_sha256',repeat('a',64),'depth',2))
  );
  RAISE EXCEPTION 'Unknown parent accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$body$;
ROLLBACK;
