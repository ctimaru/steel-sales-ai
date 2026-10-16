-- NET-FAST3B rollback-only regression: no fabricated licence.
begin;
create or replace function pg_temp.netfast3b_assert(v boolean,reason text)
returns void language plpgsql as $$
begin if not coalesce(v,false) then raise exception 'NETFAST3B %',reason;end if;end $$;

select pg_temp.netfast3b_assert(
 not has_table_privilege('anon','public.network_netfast3b_cordis_research','SELECT')
 and not has_table_privilege('authenticated','public.network_netfast3b_cordis_research','SELECT')
 and not has_table_privilege('anon','public.network_netfast3b_cordis_runs','SELECT'),
 'org details private');
select pg_temp.netfast3b_assert(
 not has_function_privilege('anon','public.netfast3b_cordis_open()','EXECUTE')
 and not has_function_privilege('authenticated','public.netfast3b_cordis_commit(uuid,jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','public.netfast3b_cordis_close(uuid)','EXECUTE')
 and not has_function_privilege('anon','public.netfast3b_status()','EXECUTE')
 and has_function_privilege('service_role','public.netfast3b_cordis_open()','EXECUTE'),
 'server-only ingestion');
select pg_temp.netfast3b_assert(
 (select count(*) from public.network_netfast3b_cordis_research)=0
 and (select count(*) from public.network_netfast3b_cordis_runs)=0
 and (select count(*) from public.network_discovery_source_registry
 where source_url='https://data.europa.eu/data/datasets/cordis-eu-research-projects-under-horizon-europe-2021-2027'
 and governance_status='unreviewed' and enabled_for_discovery=false)=1,
 'research starts empty, source NOT approved');
set local role service_role;
do $$
declare r jsonb;
begin
 r:=public.netfast3b_cordis_open();
 if r->>'reason'<>'cordis_source_rights_not_approved' then
  raise exception 'NETFAST3B must not download CORDIS without separate approved grant';
 end if;
end $$;
reset role;
rollback;
