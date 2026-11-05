-- NET-GROWTH3.D: rollback-only producer/processor role and authorization proof.
begin;

create or replace function pg_temp.netgrowth3d_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'NET-GROWTH3.D %', message;
  end if;
end $$;

select pg_temp.netgrowth3d_assert(
  not has_function_privilege('anon','public.netgrowth3d_stage_industrial(jsonb,text)','EXECUTE')
  and not has_function_privilege('authenticated','public.netgrowth3d_stage_industrial(jsonb,text)','EXECUTE')
  and has_function_privilege('service_role','public.netgrowth3d_stage_industrial(jsonb,text)','EXECUTE'),
  'industrial intake must remain service-only');

select pg_temp.netgrowth3d_assert(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='netgrowth3d_stage_industrial'
      and p.prosecdef
  ),
  'role-correct public RPC must be invoker, not definer');

set local role authenticated;
do $$
begin
  begin
    perform public.netgrowth3d_stage_industrial('[]'::jsonb,'NET-GROWTH3D-QA-UNAUTHORIZED');
    raise exception 'authenticated role entered restricted industrial RPC';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set local role service_role;
do $$
declare
  items jsonb;
  rejected_items jsonb;
  result jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'name', 'NET3D Synthetic Steel Company ' || n || ' Srl',
    'domain', 'netgrowth3d-role-' || n || '.invalid',
    'evidence_url', 'https://netgrowth3d-role-' || n || '.invalid/steel-tubes/',
    'summary', 'Transaction-only synthetic evidence for production and processing steel tubes.',
    'segment', 'other',
    'material_signal', 'explicit_steel_tube_product',
    'role', case when n % 2 = 0 then 'producer' else 'processor_service_provider' end
  ) order by n)
  into items from generate_series(1,50) as n;

  -- A malformed fiftieth item must roll back all 49 otherwise-valid rows.
  select jsonb_agg(
    case when ordinality = 50
      then jsonb_set(value, '{evidence_url}', to_jsonb('https://unrelated.invalid/tubes'::text))
      else value end order by ordinality
  ) into rejected_items from jsonb_array_elements(items) with ordinality;

  begin
    perform public.netgrowth3d_stage_industrial(
      rejected_items, 'NET-GROWTH3D-QA-BAD-20261105'
    );
    raise exception 'Malformed last item was incorrectly accepted';
  exception when invalid_parameter_value then null;
  end;
  perform pg_temp.netgrowth3d_assert(
    (select count(*) from public.network_core_target_leads
      where intake_batch='NET-GROWTH3D-QA-BAD-20261105') = 0,
    'failed batch must be atomic');

  select public.netgrowth3d_stage_industrial(
    items, 'NET-GROWTH3D-QA-VALID-20261105'
  ) into result;
  perform pg_temp.netgrowth3d_assert(
    result->>'contract' = 'netgrowth3d-industrial-atomic-v1'
    and (result->>'new_unconfirmed')::int = 50
    and (result->>'published')::int = 0
    and (result->>'verified_buyers')::int = 0,
    'role-correct RPC returned wrong contract');

  perform pg_temp.netgrowth3d_assert(
    (select count(*) from public.network_core_target_leads
      where intake_batch='NET-GROWTH3D-QA-VALID-20261105'
      and proposed_role = 'producer' and status='needs_review') = 25
    and (select count(*) from public.network_core_target_leads
      where intake_batch='NET-GROWTH3D-QA-VALID-20261105'
      and proposed_role = 'processor_service_provider' and status='needs_review') = 25,
    'producers and processors must retain their true industrial roles');

  perform pg_temp.netgrowth3d_assert(
    not exists (select 1 from public.network_companies
      where website_domain like 'netgrowth3d-role-%.invalid'),
    'industrial importer must never publish canonical companies');
end $$;
reset role;

-- View is deliberately not granted to service_role: use postgres for this
-- readback, without expanding schema or RLS privileges.
select pg_temp.netgrowth3d_assert(
  (select count(*) from private.netfast_discovered_records
    where domain like 'netgrowth3d-role-%.invalid') = 50,
  '50 industrial entries must be read-visible without canonical publication');
rollback;
