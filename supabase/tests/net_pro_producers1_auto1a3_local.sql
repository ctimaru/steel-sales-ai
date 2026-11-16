-- Local isolated Supabase test only; do not execute as production data migration.
BEGIN;
create or replace function pg_temp.assert_true(p_ok boolean,p_message text)
returns void language plpgsql as $body$
begin
 if not coalesce(p_ok,false) then raise exception 'AUTO1.A.3 test failed: %',p_message; end if;
end;
$body$;

select pg_temp.assert_true(
 to_regclass('private.network_producer_auto1_product_pages') is not null,
 'Page queue must exist');
select pg_temp.assert_true(
 (select relrowsecurity from pg_class where oid='private.network_producer_auto1_product_pages'::regclass),
 'Private page table must have RLS enabled');
select pg_temp.assert_true(
 not has_table_privilege('anon','private.network_producer_auto1_product_pages','SELECT')
 and not has_table_privilege('authenticated','private.network_producer_auto1_product_pages','SELECT'),
 'Neither free nor paid end-user may read internal crawl queue');
select pg_temp.assert_true(
 to_regprocedure('public.netproducers1_auto1a3_discover(uuid,text,jsonb)') is not null
 and to_regprocedure('public.netproducers1_auto1a3_claim_pages(integer)') is not null
 and to_regprocedure('public.netproducers1_auto1a3_complete_page(uuid,text,text,jsonb,text,text,text)') is not null
 and to_regprocedure('public.netproducers1_auto1a3_verify(integer)') is not null,
 'All bounded page-intake and verification RPCs must exist');
select pg_temp.assert_true(
 not has_function_privilege('anon','public.netproducers1_auto1a3_discover(uuid,text,jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','public.netproducers1_auto1a3_discover(uuid,text,jsonb)','EXECUTE')
 and not has_function_privilege('anon','public.netproducers1_auto1a3_claim_pages(integer)','EXECUTE')
 and not has_function_privilege('authenticated','public.netproducers1_auto1a3_claim_pages(integer)','EXECUTE')
 and not has_function_privilege('anon','public.netproducers1_auto1a3_verify(integer)','EXECUTE')
 and not has_function_privilege('authenticated','public.netproducers1_auto1a3_verify(integer)','EXECUTE')
 and has_function_privilege('service_role','public.netproducers1_auto1a3_claim_pages(integer)','EXECUTE'),
 'Only service-role should lease/discover/verify technical product pages');
select pg_temp.assert_true(
 (select pg_get_constraintdef(oid) from pg_constraint where
  conrelid='private.network_producer_auto1_candidates'::regclass
  and conname='network_producer_auto1_candidates_evidence_status_check')
  like '%pending_page_verification%',
 'Separate page-verification state required to protect legacy homepage checker');
select pg_temp.assert_true(
 (private.netproducers1_auto1a3_verify(100)->>'manufacturing_capabilities_published')::int=0,
 'Source mentions may not cause publication of manufacturing capabilities');
select pg_temp.assert_true(
 (private.netproducers1_auto1a3_status()->>'published_capabilities')::int=0,
 'Page queue cannot make manufacturable combination claims');
select pg_temp.assert_true(
 (select pg_get_functiondef(oid)
  from pg_proc where oid='private.netproducers1_auto1b_mentions_impl(uuid,uuid[])'::regprocedure)
  like '%private.netproducers1_auto1_product_pages%',
 'Paid producer reader must verify exact product-page provenance');

DO $body$
BEGIN
 BEGIN
  PERFORM private.netproducers1_auto1a3_discover(
    '00000000-0000-0000-0000-000000000000'::uuid,
    repeat('a',64),
    '[{"url":"https://evil.example/products","kind":"products"}]'::jsonb
  );
  RAISE EXCEPTION 'Invalid company discovery unexpectedly succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL;
 END;
END;
$body$;
ROLLBACK;
