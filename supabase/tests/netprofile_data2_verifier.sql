-- NET-PROFILE-DATA2: first-party evidence queue is service-only, with
-- private RLS audit and refusal to upgrade evidence through a member JWT.
begin;
create or replace function pg_temp.netprofile_data2_assert(ok boolean, msg text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NET-PROFILE-DATA2 %',msg; end if; end $$;

select pg_temp.netprofile_data2_assert(
  (select relrowsecurity from pg_class where oid='private.netprofile_data2_reviews'::regclass),
  'audit table must use RLS');
select pg_temp.netprofile_data2_assert(
 exists (
   select 1 from pg_trigger
   where tgrelid='private.netprofile_data2_reviews'::regclass
     and tgname='netprofile_data2_immutable'
     and not tgisinternal
 ),'audit log must be immutable even under service role');
select pg_temp.netprofile_data2_assert(
  not has_table_privilege('anon','private.netprofile_data2_reviews','SELECT')
  and not has_table_privilege('authenticated','private.netprofile_data2_reviews','SELECT')
  and not has_table_privilege('authenticated','private.netprofile_data2_reviews','INSERT')
  and not has_table_privilege('authenticated','private.netprofile_data2_reviews','UPDATE'),
  'browser audit grants forbidden');
select pg_temp.netprofile_data2_assert(
  not has_function_privilege('anon','public.netprofile_data2_queue(integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.netprofile_data2_queue(integer)','EXECUTE')
  and not has_function_privilege('anon',
    'public.netprofile_data2_record(uuid,text,text,text,text,text,text,numeric,text[])','EXECUTE')
  and not has_function_privilege('authenticated',
    'public.netprofile_data2_record(uuid,text,text,text,text,text,text,numeric,text[])','EXECUTE')
  and has_function_privilege('service_role','public.netprofile_data2_queue(integer)','EXECUTE')
  and has_function_privilege('service_role',
    'public.netprofile_data2_record(uuid,text,text,text,text,text,text,numeric,text[])','EXECUTE'),
  'only service role can invoke reviewer API');
select pg_temp.netprofile_data2_assert(
  position('review_status=''candidate''' in pg_get_functiondef('public.netprofile_data2_queue(integer)'::regprocedure))>0
  and position('c.publication_status=''published''' in pg_get_functiondef('public.netprofile_data2_queue(integer)'::regprocedure))>0
  and position('net-profile-data2-v1' in pg_get_functiondef(
    'public.netprofile_data2_record(uuid,text,text,text,text,text,text,numeric,text[])'::regprocedure))>0
  and position('confidence<0.970' in pg_get_functiondef(
    'public.netprofile_data2_record(uuid,text,text,text,text,text,text,numeric,text[])'::regprocedure))>0,
  'queue and acceptance guards remain active');
select pg_temp.netprofile_data2_assert(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'netprofile_data2_%'
      and not p.prosecdef
  ),'service-only security definer functions require explicit role guard');
set local role authenticated;
do $$
begin
 begin
   perform public.netprofile_data2_queue(10);
   raise exception 'Non-service queue unexpectedly accessible';
 exception when sqlstate '42501' then null;
 end;
 begin
   perform public.netprofile_data2_record(
     '00000000-0000-0000-0000-000000000001'::uuid,'net-profile-data2-v1',
     'supported','unauthorized','https://example.com/',
     repeat('f',64),'sample source quote',0.99, '{}'::text[]);
   raise exception 'Non-service write unexpectedly accessible';
 exception when sqlstate '42501' then null;
 end;
end $$;
reset role;
rollback;
