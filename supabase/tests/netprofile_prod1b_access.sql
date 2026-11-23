-- NET-PROFILE-PROD1.B: service-only writes, RLS and bounded contracts.
begin;
create or replace function pg_temp.prod1b_assert(ok boolean, msg text)
returns void language plpgsql as $$
begin
  if coalesce(ok,false) is not true then
    raise exception 'PROD1.B assertion failed: %',msg;
  end if;
end $$;

select pg_temp.prod1b_assert(
  not has_function_privilege('anon','public.netprofile_prod1b_seed(integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.netprofile_prod1b_seed(integer)','EXECUTE')
  and has_function_privilege('service_role','public.netprofile_prod1b_seed(integer)','EXECUTE'),
  'seed must be service-only'
);
select pg_temp.prod1b_assert(
  not has_function_privilege('anon','public.netprofile_prod1b_claim(integer)','EXECUTE')
  and not has_function_privilege('authenticated','public.netprofile_prod1b_claim(integer)','EXECUTE')
  and has_function_privilege('service_role','public.netprofile_prod1b_claim(integer)','EXECUTE'),
  'claim must be service-only'
);
select pg_temp.prod1b_assert(
  not has_function_privilege('anon',
    'public.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text)','EXECUTE')
  and not has_function_privilege('authenticated',
    'public.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text)','EXECUTE')
  and has_function_privilege('service_role',
    'public.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text)','EXECUTE'),
  'complete must be service-only'
);
select pg_temp.prod1b_assert(
  (select relrowsecurity from pg_class
   where oid='private.network_profile_producer_activity_queue'::regclass)
  and (select relrowsecurity from pg_class
   where oid='private.network_profile_producer_activity_events'::regclass),
  'queue + event ledger require RLS'
);
select pg_temp.prod1b_assert(
  not has_table_privilege('anon','private.network_profile_producer_activity_queue','SELECT')
  and not has_table_privilege('authenticated',
    'private.network_profile_producer_activity_queue','SELECT')
  and not has_table_privilege('anon',
    'private.network_profile_producer_activity_events','SELECT'),
  'no internal candidate or event access'
);
select pg_temp.prod1b_assert(
  (select prosecdef from pg_proc
   where oid='public.netprofile_prod1b_complete(uuid,uuid,text,text,text,jsonb,text)'::regprocedure)=false,
  'public wrapper must be SECURITY INVOKER'
);
rollback;
