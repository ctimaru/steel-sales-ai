-- NET-FAST2 negative security / ingestion rate contract smoke (rollback only).
begin;
create or replace function pg_temp.netfast2_assert(v boolean,why text)
returns void language plpgsql as $$
begin if not coalesce(v,false) then raise exception 'NET-FAST2 %',why;end if;end $$;
select pg_temp.netfast2_assert(
 not has_table_privilege('anon','public.network_netfast2_structured_entities','SELECT')
 and not has_table_privilege('authenticated','public.network_netfast2_structured_entities','SELECT')
 and not has_table_privilege('authenticated','public.network_netfast2_batches','SELECT')
 and (select relrowsecurity from pg_class where oid='public.network_netfast2_structured_entities'::regclass),
 'browser data access closed');
select pg_temp.netfast2_assert(
 not has_function_privilege('anon','public.netfast2_claim_daily_batch()','EXECUTE')
 and not has_function_privilege('anon','public.netfast2_commit_daily_batch(uuid,jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','public.netfast2_claim_daily_batch()','EXECUTE')
 and not has_function_privilege('authenticated','public.netfast2_commit_daily_batch(uuid,jsonb)','EXECUTE')
 and has_function_privilege('service_role','public.netfast2_claim_daily_batch()','EXECUTE'),
 'service worker authorization');
select pg_temp.netfast2_assert(
 (select pg_get_viewdef('private.netfast_discovered_records'::regclass)
 like '%network_netfast2_structured_entities%')
 and (select pg_get_viewdef('private.netfast_discovered_records'::regclass)
 like '%removed_at%'),
 'dynamic provisional data source');
select pg_temp.netfast2_assert(
 (not exists(select 1 from public.network_discovery_source_registry
 where id='8425ec0f-c855-41d8-9bea-70a95fd8a6ba'::uuid)
 or exists(select 1 from public.network_discovery_source_registry
 where id='8425ec0f-c855-41d8-9bea-70a95fd8a6ba'::uuid
 and max_domains_per_run=100 and minimum_interval_hours=24)),
 'explicit rights-bounded source capacity');
rollback;
