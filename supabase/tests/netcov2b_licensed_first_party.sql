-- NET-COV2B rollback-only negative authorization and worker isolation checks.
begin;
create or replace function pg_temp.netcov2b_assert(v boolean,why text) returns void
language plpgsql as $$
begin if not coalesce(v,false) then raise exception 'NET-COV2B %',why;end if;end $$;

select pg_temp.netcov2b_assert(
 not has_function_privilege('anon','public.netcov2b_record_permission(uuid,text,text,timestamptz,text,boolean)','EXECUTE')
 and not has_function_privilege('anon','public.netcov2b_activate_source(uuid,boolean)','EXECUTE')
 and not has_function_privilege('anon','public.netcov2b_prepare_run(uuid,uuid[])','EXECUTE')
 and not has_function_privilege('anon','public.netcov2b_link_run(uuid)','EXECUTE')
 and not has_function_privilege('authenticated','public.netcov2b_stage_candidate(uuid,jsonb)','EXECUTE')
 and has_function_privilege('service_role','public.netcov2b_stage_candidate(uuid,jsonb)','EXECUTE'),
 'worker / Platform privileges');

select pg_temp.netcov2b_assert(
 (select relrowsecurity from pg_class
   where oid='public.network_netcov2b_domain_permissions'::regclass)
 and not has_table_privilege('anon','public.network_netcov2b_domain_permissions','SELECT')
 and not has_table_privilege('authenticated','public.network_netcov2b_domain_permissions','SELECT')
 and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'netcov2b_%' and p.prosecdef),
 'private grants and security invoker public endpoints');

select pg_temp.netcov2b_assert(
 (select pg_get_functiondef('public.p3_claim_next_company_discovery()'::regprocedure)
   like '%NET-COV2B first-party; separate run governance required%')
 and (select pg_get_functiondef('public.crawl_it3_claim_due_source()'::regprocedure)
   like '%company_submission%')
 and exists(select 1 from pg_trigger
   where tgname='netcov2b_source_activation_guard' and not tgisinternal),
 'generic worker exclusion and source activation guard');

-- Actual auth.uid() is null: even authenticated PostgREST role cannot forge
-- a consent approval, run preparation, or a reviewed operator identity.
set local role authenticated;
do $$
begin
 begin
  perform public.netcov2b_record_permission(gen_random_uuid(),'sample.invalid',
    'https://sample.invalid/permission',now()+interval '10 days',
    'Synthetic unauthorized request with no real authenticated identity',true);
  raise exception 'Unauthorized record unexpectedly succeeded';
 exception when insufficient_privilege then null;end;
 begin
  perform public.netcov2b_prepare_run(gen_random_uuid(),array[gen_random_uuid()]);
  raise exception 'Unauthorized run unexpectedly succeeded';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select pg_temp.netcov2b_assert(
 not has_function_privilege('anon','public.netcov2b_enqueue_consented(uuid,integer)','EXECUTE')
 and exists(select 1 from pg_trigger where tgname='netcov2b_domain_lead_guard' and not tgisinternal),
 'source-specific consent-only enqueue');
rollback;
