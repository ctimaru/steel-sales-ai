-- NET-COV2: only authenticated, authorized Platform operators may batch-stage.
begin;
create or replace function pg_temp.netcov2_assert(ok boolean,msg text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NET-COV2 %',msg;end if;end $$;

select pg_temp.netcov2_assert(
  not has_function_privilege('anon','public.netcov2_operator_batch_stage(jsonb,text,boolean)','EXECUTE')
  and not has_function_privilege('anon','public.netcov2_campaign_metrics()','EXECUTE')
  and has_function_privilege('authenticated','public.netcov2_operator_batch_stage(jsonb,text,boolean)','EXECUTE')
  and not has_function_privilege('anon','private.netcov2_operator_batch_stage_impl(jsonb,text,boolean)','EXECUTE')
  and not has_function_privilege('authenticated','public.netcov1_seed_official_cohort(jsonb,text)','EXECUTE'),
  'privilege separation');

select pg_temp.netcov2_assert(
 not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'netcov2_%' and p.prosecdef),
 'public functions must be invoker');

-- No authenticated user identity/permission means explicit denial. Rollback-only.
set local role authenticated;
do $$
begin
  perform public.netcov2_operator_batch_stage(
    '[]'::jsonb,'NET-COV2 Synthetic Campaign',true);
  raise exception 'NET-COV2 unauthorized request unexpectedly succeeded';
exception when insufficient_privilege then null;
end $$;
reset role;
select pg_temp.netcov2_assert(
 not exists(select 1 from public.network_core_target_leads
 where canonical_domain='netcov2-synthetic.invalid'),
 'no staging by unprivileged role');
rollback;
