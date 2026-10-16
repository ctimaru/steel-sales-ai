-- NETFAST1 acceptance: discovery is not a new canonical publication.
begin;
create or replace function pg_temp.netfast_assert(v boolean,reason text)
returns void language plpgsql as $$
begin if not coalesce(v,false) then raise exception 'NETFAST: %',reason;end if;end $$;
select pg_temp.netfast_assert(
 not has_function_privilege('anon','public.netfast_free_directory(uuid,text,text,text,integer)','EXECUTE')
 and not has_function_privilege('anon','public.netfast_free_profile(uuid,uuid)','EXECUTE')
 and not has_table_privilege('anon','private.netfast_discovered_records','SELECT')
 and not has_table_privilege('authenticated','private.netfast_discovered_records','SELECT'),
 'confidential source boundary');
select pg_temp.netfast_assert(
 not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'netfast_%' and p.prosecdef),
 'exposed functions must be invoker');
select pg_temp.netfast_assert(
 (select pg_get_viewdef('private.netfast_discovered_records'::regclass) like '%pending_review%')
 and (select pg_get_viewdef('private.netfast_discovered_records'::regclass) like '%approved_company_data%'),
 'governed candidate-only overlay');
-- Uses only existing companies and research records and does not change publication counts.
select pg_temp.netfast_assert(
 (select count(*) from private.netfast_discovered_records) <=
 (select count(*) from public.network_company_discovery_candidates)
 +(select count(*) from public.network_core_target_leads),
 'overlays are de-duplicated');
set local role authenticated;
do $$
begin
 begin
  perform public.netfast_free_directory(gen_random_uuid(),null,null,null,10);
  raise exception 'Unlinked user unexpectedly received discovery records';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
