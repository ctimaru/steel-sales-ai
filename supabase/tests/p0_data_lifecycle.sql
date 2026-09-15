-- P0.10 acceptance: export/delete/retention are service-role-only,
-- conservative, auditable and preserve global/other-tenant data.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P0.10 assertion failed: %', message;
  end if;
end;
$$;

insert into auth.users (id) values
  ('00000000-0000-0000-0000-0000000010a1'::uuid),
  ('00000000-0000-0000-0000-0000000010b1'::uuid);

insert into public.organizations (id, name, slug, created_by) values
  ('10000000-0000-0000-0000-000000001001'::uuid, 'P0.10 Tenant A', 'p0-10-tenant-a', '00000000-0000-0000-0000-0000000010a1'::uuid),
  ('20000000-0000-0000-0000-000000001002'::uuid, 'P0.10 Tenant B', 'p0-10-tenant-b', '00000000-0000-0000-0000-0000000010b1'::uuid);

insert into public.organization_memberships (
  organization_id, user_id, role, status, is_default
) values
  ('10000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-0000000010a1', 'admin', 'active', true),
  ('20000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-0000000010b1', 'admin', 'active', true);

insert into public.companies (id, owner_id, organization_id, name) values
  ('30000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-0000000010a1', '10000000-0000-0000-0000-000000001001', 'Tenant A Company'),
  ('30000000-0000-0000-0000-000000001002', '00000000-0000-0000-0000-0000000010b1', '20000000-0000-0000-0000-000000001002', 'Tenant B Company');

insert into public.knowledge_sources (
  id, owner_id, organization_id, access_scope, source_key, source_type, source_class, name
) values
  ('40000000-0000-0000-0000-000000001001', '00000000-0000-0000-0000-0000000010a1', '10000000-0000-0000-0000-000000001001', 'owner', 'p0-10-private-a', 'commercial_archive', 'internal', 'Tenant A Private Source'),
  ('40000000-0000-0000-0000-000000001099', null, null, 'global', 'p0-10-global', 'market', 'official', 'P0.10 Global Source');

insert into public.worker_jobs (
  id, filename, extension, size_bytes, storage_path, status, owner_id,
  organization_id, created_at, started_at, completed_at
) values (
  '50000000-0000-0000-0000-000000001001',
  'tenant-a.pdf',
  '.pdf',
  10,
  '2026/09/15/tenant-a.pdf',
  'completed',
  '00000000-0000-0000-0000-0000000010a1',
  '10000000-0000-0000-0000-000000001001',
  now() - interval '45 days',
  now() - interval '45 days',
  now() - interval '45 days'
);

insert into public.worker_staging_observations (
  job_id, source_filename, source_text
) values (
  '50000000-0000-0000-0000-000000001001',
  'tenant-a.pdf',
  'temporary parser staging text'
);

insert into public.observability_events (
  occurred_at, service, environment, trace_id, event_type, operation, status,
  organization_id
) values (
  now() - interval '45 days',
  'worker',
  'test',
  '60000000-0000-0000-0000-000000001001',
  'system',
  'p0.10.test',
  'ok',
  '10000000-0000-0000-0000-000000001001'
);

select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.data_lifecycle_audit', 'SELECT'),
  'anon must not read lifecycle audit'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.data_lifecycle_audit', 'SELECT'),
  'authenticated must not read lifecycle audit'
);
select pg_temp.assert_true(
  has_table_privilege('service_role', 'public.data_lifecycle_audit', 'SELECT'),
  'service role must read lifecycle audit'
);
select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.tenant_export_manifest(uuid)', 'EXECUTE'),
  'authenticated must not execute tenant export manifest'
);
select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.tenant_export_manifest(uuid)', 'EXECUTE'),
  'service role must execute tenant export manifest'
);
select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.delete_tenant_data(uuid,text,boolean,boolean)', 'EXECUTE'),
  'authenticated must not execute tenant deletion'
);
select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.delete_tenant_data(uuid,text,boolean,boolean)', 'EXECUTE'),
  'service role must execute tenant deletion'
);

set local role service_role;

select pg_temp.assert_true(
  public.data_retention_policy()->>'contract' = 'p0.10-v1',
  'retention policy contract must be p0.10-v1'
);

select pg_temp.assert_true(
  public.tenant_export_manifest('10000000-0000-0000-0000-000000001001')->>'contract' = 'p0.10-v1',
  'export manifest contract must be p0.10-v1'
);
select pg_temp.assert_true(
  (public.tenant_export_manifest('10000000-0000-0000-0000-000000001001') #>> '{table_counts,companies}')::int = 1,
  'tenant A manifest must count its company'
);
select pg_temp.assert_true(
  (public.tenant_export_manifest('10000000-0000-0000-0000-000000001001') #>> '{storage,object_count}')::int = 1,
  'tenant A manifest must enumerate its storage object'
);
select pg_temp.assert_true(
  jsonb_array_length(public.tenant_export_snapshot('10000000-0000-0000-0000-000000001001') #> '{tables,companies}') = 1,
  'snapshot must include authoritative company data'
);

select pg_temp.assert_true(
  (public.apply_operational_retention(now(), true) #>> '{candidates,observability_events}')::int >= 1,
  'retention dry-run must see old observability'
);
select pg_temp.assert_true(
  (public.apply_operational_retention(now(), true) #>> '{candidates,worker_staging_observations}')::int = 1,
  'retention dry-run must see terminal-job staging'
);
select pg_temp.assert_true(
  exists (select 1 from public.companies where id='30000000-0000-0000-000000001001'),
  'retention dry-run must preserve authoritative tenant data'
);

select public.apply_operational_retention(now(), false);
select pg_temp.assert_true(
  not exists (
    select 1 from public.worker_staging_observations
    where job_id='50000000-0000-0000-0000-000000001001'
  ),
  'retention apply must purge old expendable staging'
);
select pg_temp.assert_true(
  not exists (
    select 1 from public.observability_events
    where trace_id='60000000-0000-0000-0000-000000001001'
  ),
  'retention apply must purge old observability'
);
select pg_temp.assert_true(
  exists (select 1 from public.companies where id='30000000-0000-0000-000000001001'),
  'retention apply must preserve authoritative tenant data'
);

select pg_temp.assert_true(
  public.delete_tenant_data(
    '10000000-0000-0000-0000-000000001001',
    null,
    false,
    true
  )->>'required_confirmation' = 'DELETE:p0-10-tenant-a',
  'delete preview must require explicit DELETE:<slug> confirmation'
);

do $$
begin
  begin
    perform public.delete_tenant_data(
      '10000000-0000-0000-0000-000000001001',
      'DELETE:wrong',
      true,
      false
    );
    raise exception 'wrong confirmation unexpectedly succeeded';
  exception
    when others then
      if sqlerrm = 'wrong confirmation unexpectedly succeeded' then
        raise;
      end if;
  end;
end;
$$;

select public.delete_tenant_data(
  '10000000-0000-0000-0000-000000001001',
  'DELETE:p0-10-tenant-a',
  true,
  false
);

select pg_temp.assert_true(
  not exists (select 1 from public.organizations where id='10000000-0000-0000-0000-000000001001'),
  'tenant A organization must be deleted'
);
select pg_temp.assert_true(
  not exists (select 1 from public.companies where id='30000000-0000-0000-0000-000000001001'),
  'tenant A company must be deleted'
);
select pg_temp.assert_true(
  exists (select 1 from public.organizations where id='20000000-0000-0000-0000-000000001002'),
  'tenant B must survive tenant A deletion'
);
select pg_temp.assert_true(
  exists (select 1 from public.companies where id='30000000-0000-0000-0000-000000001002'),
  'tenant B data must survive tenant A deletion'
);
select pg_temp.assert_true(
  exists (select 1 from public.knowledge_sources where id='40000000-0000-0000-0000-000000001099'),
  'global knowledge must survive tenant deletion'
);
select pg_temp.assert_true(
  exists (
    select 1
    from public.data_lifecycle_audit
    where action='tenant_delete'
      and status='completed'
      and organization_id='10000000-0000-0000-0000-000000001001'
  ),
  'tenant deletion must leave metadata-only audit evidence'
);

select pg_temp.assert_true(
  public.data_lifecycle_health()->>'contract' = 'p0.10-v1',
  'data lifecycle health must expose p0.10-v1'
);

reset role;
rollback;
