-- NET-LAUNCH1 + NET-PUBLIC-ONLY1: private candidate records are not a public Pro directory.
begin;
create or replace function pg_temp.netlaunch_assert(v boolean,m text)
returns void language plpgsql as $$
begin if not coalesce(v,false) then raise exception 'NET-LAUNCH1: %',m;end if;end $$;
select pg_temp.netlaunch_assert(
 not has_function_privilege('anon','public.netlaunch1_pro_discovery(uuid,text,text,text,integer)','EXECUTE')
 and not has_function_privilege('anon','public.netlaunch1_pro_profile(uuid,uuid)','EXECUTE')
 and has_function_privilege('authenticated','public.netlaunch1_pro_discovery(uuid,text,text,text,integer)','EXECUTE'),
 'authenticated-only discovery boundary');
select pg_temp.netlaunch_assert(
 (select pg_get_functiondef('private.netlaunch1_pro_discovery_impl(uuid,text,text,text,integer)'::regprocedure)
 like '%private.pa1_3_require_network_access%')
 and (select pg_get_functiondef('private.netlaunch1_pro_profile_impl(uuid,uuid)'::regprocedure)
 like '%private.pa1_3_require_network_access%'),
 'paid entitlement gate for both readers');
select pg_temp.netlaunch_assert(
 (select pg_get_functiondef('private.netlaunch1_pro_discovery_impl(uuid,text,text,text,integer)'::regprocedure)
 like '%netfast_public_visible_records%')
 and (select pg_get_functiondef('private.netlaunch1_pro_profile_impl(uuid,uuid)'::regprocedure)
 not like '%network_contacts%'),
 'public published-only source and no private memory');
set local role authenticated;
do $$
begin
 begin
  perform public.netlaunch1_pro_discovery(gen_random_uuid(),null,null,null,10);
  raise exception 'Pro discovery unexpectedly allowed unauthenticated viewer';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
