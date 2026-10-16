-- NET-COV1 — minimal security + batch staging safety acceptance.
begin;
create or replace function pg_temp.netcov1_assert(ok boolean,msg text)
returns void language plpgsql as $$
begin if not coalesce(ok,false) then raise exception 'NET-COV1 %',msg;end if;end $$;
select pg_temp.netcov1_assert(
  not has_function_privilege('anon','public.netcov1_targets_queue()','EXECUTE')
  and not has_function_privilege('anon','public.netcov1_operator_stage(text,text,text,text,text,text,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.netcov1_seed_official_cohort(jsonb,text)','EXECUTE')
  and has_function_privilege('service_role','public.netcov1_seed_official_cohort(jsonb,text)','EXECUTE')
  and not has_function_privilege('authenticated','private.netcov1_stage_core(text,text,text,text,text,text,text,text)','EXECUTE'),
  'role boundaries');
select pg_temp.netcov1_assert(
 not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'netcov1_%' and p.prosecdef),
 'HP13 public definer risk');
select pg_temp.netcov1_assert(
 (select relrowsecurity from pg_class where oid='public.network_core_target_leads'::regclass)
 and exists(select 1 from pg_policies where tablename='network_core_target_leads'
   and policyname='netcov1_explicit_deny_client_access'),
 'RLS table defense');
set local role service_role;
select public.netcov1_seed_official_cohort(
'[{"name":"NETCOV1 Synthetic Machinery Co.","domain":"netcov1-synthetic.invalid",
"evidence_url":"https://netcov1-synthetic.invalid/products/frames",
"summary":"Transaction-only synthetic evidence of steel tubular frames in a finished industrial product.",
"segment":"industrial_equipment","material_signal":"explicit_steel_tube_product","role":"end_user"}]'::jsonb,
 'NET-COV1 rollback fixture') as stage;
reset role;
select pg_temp.netcov1_assert(
 (select count(*) from public.network_core_target_leads
   where canonical_domain='netcov1-synthetic.invalid' and status='needs_review')=1,
 'seed staged exactly one unreviewed target');
select pg_temp.netcov1_assert(
 not exists(select 1 from public.network_companies where website_domain='netcov1-synthetic.invalid')
 and not exists(select 1 from public.network_company_discovery_candidates
                 where canonical_domain='netcov1-synthetic.invalid'),
 'seed must never create company or crawler candidate');
rollback;
