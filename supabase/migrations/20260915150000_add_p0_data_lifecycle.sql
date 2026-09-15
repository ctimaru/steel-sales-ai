-- P0.10 — data lifecycle, tenant export/delete, retention and DR contract.
--
-- Customer-authoritative data is retained while a tenant is active.
-- Automatic retention in P0.10 is deliberately limited to expendable
-- operational telemetry/staging data. Tenant deletion is explicit,
-- service-role-only and requires a confirmation slug plus proof that the
-- worker removed the tenant's Storage objects first.

create table if not exists public.data_lifecycle_audit (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  action text not null check (
    action in ('tenant_export', 'tenant_delete', 'retention', 'backup_rehearsal')
  ),
  status text not null check (status in ('started', 'completed', 'failed')),
  organization_id uuid,
  organization_slug text,
  actor text not null default 'service_role',
  details jsonb not null default '{}'::jsonb
);

comment on table public.data_lifecycle_audit is
  'P0.10 metadata-only audit for export/delete/retention/DR operations. No customer payload is stored.';

create index if not exists data_lifecycle_audit_occurred_idx
  on public.data_lifecycle_audit (occurred_at desc);
create index if not exists data_lifecycle_audit_organization_idx
  on public.data_lifecycle_audit (organization_id, occurred_at desc)
  where organization_id is not null;

alter table public.data_lifecycle_audit enable row level security;
revoke all on table public.data_lifecycle_audit from public, anon, authenticated;
grant select, insert on table public.data_lifecycle_audit to service_role;

drop policy if exists data_lifecycle_audit_client_deny on public.data_lifecycle_audit;
create policy data_lifecycle_audit_client_deny
on public.data_lifecycle_audit
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.data_retention_policy()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'contract', 'p0.10-v1',
    'authoritative_tenant_data', 'retain_until_explicit_tenant_delete',
    'raw_storage_objects', 'retain_until_explicit_tenant_delete',
    'operational', jsonb_build_object(
      'observability_events_days', 30,
      'worker_staging_after_terminal_job_days', 30
    ),
    'derived_rebuildable', jsonb_build_array(
      'knowledge_chunks',
      'knowledge_chunk_embeddings',
      'knowledge_entity_mentions'
    ),
    'global_data_is_tenant_exported', false,
    'audit_payload_policy', 'metadata_only'
  );
$$;

revoke execute on function public.data_retention_policy()
  from public, anon, authenticated;
grant execute on function public.data_retention_policy()
  to service_role;

create or replace function public.tenant_export_manifest(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org public.organizations%rowtype;
  v_counts jsonb;
  v_total bigint := 0;
  v_storage_paths jsonb := '[]'::jsonb;
  v_storage_count bigint := 0;
begin
  select *
  into v_org
  from public.organizations
  where id = p_organization_id;

  if not found then
    raise exception 'organization not found: %', p_organization_id;
  end if;

  select jsonb_build_object(
    'organization_memberships', (select count(*) from public.organization_memberships where organization_id = p_organization_id),
    'companies', (select count(*) from public.companies where organization_id = p_organization_id),
    'contacts', (select count(*) from public.contacts where organization_id = p_organization_id),
    'conversations', (select count(*) from public.conversations where organization_id = p_organization_id),
    'messages', (select count(*) from public.messages where organization_id = p_organization_id),
    'documents', (select count(*) from public.documents where organization_id = p_organization_id),
    'products', (select count(*) from public.products where organization_id = p_organization_id),
    'rfqs', (select count(*) from public.rfqs where organization_id = p_organization_id),
    'rfq_lines', (select count(*) from public.rfq_lines where organization_id = p_organization_id),
    'offers', (select count(*) from public.offers where organization_id = p_organization_id),
    'offer_lines', (select count(*) from public.offer_lines where organization_id = p_organization_id),
    'orders', (select count(*) from public.orders where organization_id = p_organization_id),
    'order_lines', (select count(*) from public.order_lines where organization_id = p_organization_id),
    'availability', (select count(*) from public.availability where organization_id = p_organization_id),
    'deliveries', (select count(*) from public.deliveries where organization_id = p_organization_id),
    'certificates', (select count(*) from public.certificates where organization_id = p_organization_id),
    'extracted_fields', (select count(*) from public.extracted_fields where organization_id = p_organization_id),
    'price_history', (select count(*) from public.price_history where organization_id = p_organization_id),
    'commercial_datasets', (select count(*) from public.commercial_datasets where organization_id = p_organization_id),
    'commercial_threads', (select count(*) from public.commercial_threads where organization_id = p_organization_id),
    'commercial_observations', (select count(*) from public.commercial_observations where organization_id = p_organization_id),
    'commercial_review_queue', (select count(*) from public.commercial_review_queue where organization_id = p_organization_id),
    'worker_jobs', (select count(*) from public.worker_jobs where organization_id = p_organization_id),
    'knowledge_sources', (select count(*) from public.knowledge_sources where organization_id = p_organization_id),
    'knowledge_documents', (
      select count(*)
      from public.knowledge_documents d
      join public.knowledge_sources s on s.id = d.source_id
      where s.organization_id = p_organization_id
    ),
    'knowledge_evidence', (
      select count(*)
      from public.knowledge_evidence e
      join public.knowledge_sources s on s.id = e.source_id
      where s.organization_id = p_organization_id
    ),
    'knowledge_entities', (select count(*) from public.knowledge_entities where organization_id = p_organization_id),
    'knowledge_entity_aliases', (
      select count(*)
      from public.knowledge_entity_aliases a
      join public.knowledge_entities e on e.id = a.entity_id
      where e.organization_id = p_organization_id
    ),
    'knowledge_entity_bindings', (select count(*) from public.knowledge_entity_bindings where organization_id = p_organization_id),
    'knowledge_entity_merge_audit', (select count(*) from public.knowledge_entity_merge_audit where organization_id = p_organization_id),
    'observability_events', (select count(*) from public.observability_events where organization_id = p_organization_id),
    'worker_staging_observations', (
      select count(*)
      from public.worker_staging_observations s
      join public.worker_jobs j on j.id = s.job_id
      where j.organization_id = p_organization_id
    ),
    'knowledge_chunks_rebuildable', (
      select count(*)
      from public.knowledge_chunks c
      join public.knowledge_sources s on s.id = c.source_id
      where s.organization_id = p_organization_id
    ),
    'knowledge_chunk_embeddings_rebuildable', (
      select count(*)
      from public.knowledge_chunk_embeddings e
      join public.knowledge_sources s on s.id = e.source_id
      where s.organization_id = p_organization_id
    ),
    'knowledge_entity_mentions_rebuildable', (
      select count(*)
      from public.knowledge_entity_mentions m
      where exists (
        select 1 from public.knowledge_entities e
        where e.id = m.entity_id and e.organization_id = p_organization_id
      )
      or exists (
        select 1 from public.knowledge_sources s
        where s.id = m.source_id and s.organization_id = p_organization_id
      )
      or exists (
        select 1 from public.commercial_observations o
        where o.id = m.observation_id and o.organization_id = p_organization_id
      )
    ),
    'cross_scope_golden_query_targets', (
      select count(*)
      from public.retrieval_golden_query_targets t
      join public.knowledge_chunks c on c.id = t.chunk_id
      join public.knowledge_sources s on s.id = c.source_id
      where s.organization_id = p_organization_id
    )
  )
  into v_counts;

  select coalesce(sum(value::text::bigint), 0)
  into v_total
  from jsonb_each(v_counts);

  with paths as (
    select storage_path
    from public.worker_jobs
    where organization_id = p_organization_id
      and storage_path is not null
      and btrim(storage_path) <> ''
    union
    select d.storage_path
    from public.documents d
    where d.organization_id = p_organization_id
      and d.storage_path is not null
      and btrim(d.storage_path) <> ''
    union
    select d.storage_path
    from public.knowledge_documents d
    join public.knowledge_sources s on s.id = d.source_id
    where s.organization_id = p_organization_id
      and d.storage_path is not null
      and btrim(d.storage_path) <> ''
  )
  select
    coalesce(jsonb_agg(storage_path order by storage_path), '[]'::jsonb),
    count(*)
  into v_storage_paths, v_storage_count
  from paths;

  return jsonb_build_object(
    'contract', 'p0.10-v1',
    'generated_at', now(),
    'organization', jsonb_build_object(
      'id', v_org.id,
      'name', v_org.name,
      'slug', v_org.slug,
      'created_at', v_org.created_at
    ),
    'table_counts', v_counts,
    'total_rows_including_rebuildable_and_operational', v_total,
    'storage', jsonb_build_object(
      'bucket_from_worker_configuration', true,
      'object_count', v_storage_count,
      'paths', v_storage_paths
    ),
    'export_scope', jsonb_build_object(
      'authoritative_data', true,
      'storage_objects', true,
      'rebuildable_derived_indexes', false,
      'operational_observability_payload', false,
      'global_market_and_evaluation_data', false
    ),
    'retention_policy', public.data_retention_policy()
  );
end;
$$;

revoke execute on function public.tenant_export_manifest(uuid)
  from public, anon, authenticated;
grant execute on function public.tenant_export_manifest(uuid)
  to service_role;

create or replace function public.tenant_export_snapshot(
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manifest jsonb;
begin
  v_manifest := public.tenant_export_manifest(p_organization_id);

  return jsonb_build_object(
    'contract', 'p0.10-v1',
    'manifest', v_manifest,
    'organization', (
      select to_jsonb(o)
      from public.organizations o
      where o.id = p_organization_id
    ),
    'tables', jsonb_build_object(
      'organization_memberships', coalesce((select jsonb_agg(to_jsonb(t)) from public.organization_memberships t where t.organization_id=p_organization_id), '[]'::jsonb),
      'companies', coalesce((select jsonb_agg(to_jsonb(t)) from public.companies t where t.organization_id=p_organization_id), '[]'::jsonb),
      'contacts', coalesce((select jsonb_agg(to_jsonb(t)) from public.contacts t where t.organization_id=p_organization_id), '[]'::jsonb),
      'conversations', coalesce((select jsonb_agg(to_jsonb(t)) from public.conversations t where t.organization_id=p_organization_id), '[]'::jsonb),
      'messages', coalesce((select jsonb_agg(to_jsonb(t)) from public.messages t where t.organization_id=p_organization_id), '[]'::jsonb),
      'documents', coalesce((select jsonb_agg(to_jsonb(t)) from public.documents t where t.organization_id=p_organization_id), '[]'::jsonb),
      'products', coalesce((select jsonb_agg(to_jsonb(t)) from public.products t where t.organization_id=p_organization_id), '[]'::jsonb),
      'rfqs', coalesce((select jsonb_agg(to_jsonb(t)) from public.rfqs t where t.organization_id=p_organization_id), '[]'::jsonb),
      'rfq_lines', coalesce((select jsonb_agg(to_jsonb(t)) from public.rfq_lines t where t.organization_id=p_organization_id), '[]'::jsonb),
      'offers', coalesce((select jsonb_agg(to_jsonb(t)) from public.offers t where t.organization_id=p_organization_id), '[]'::jsonb),
      'offer_lines', coalesce((select jsonb_agg(to_jsonb(t)) from public.offer_lines t where t.organization_id=p_organization_id), '[]'::jsonb),
      'orders', coalesce((select jsonb_agg(to_jsonb(t)) from public.orders t where t.organization_id=p_organization_id), '[]'::jsonb),
      'order_lines', coalesce((select jsonb_agg(to_jsonb(t)) from public.order_lines t where t.organization_id=p_organization_id), '[]'::jsonb),
      'availability', coalesce((select jsonb_agg(to_jsonb(t)) from public.availability t where t.organization_id=p_organization_id), '[]'::jsonb),
      'deliveries', coalesce((select jsonb_agg(to_jsonb(t)) from public.deliveries t where t.organization_id=p_organization_id), '[]'::jsonb),
      'certificates', coalesce((select jsonb_agg(to_jsonb(t)) from public.certificates t where t.organization_id=p_organization_id), '[]'::jsonb),
      'extracted_fields', coalesce((select jsonb_agg(to_jsonb(t)) from public.extracted_fields t where t.organization_id=p_organization_id), '[]'::jsonb),
      'price_history', coalesce((select jsonb_agg(to_jsonb(t)) from public.price_history t where t.organization_id=p_organization_id), '[]'::jsonb),
      'commercial_datasets', coalesce((select jsonb_agg(to_jsonb(t)) from public.commercial_datasets t where t.organization_id=p_organization_id), '[]'::jsonb),
      'commercial_threads', coalesce((select jsonb_agg(to_jsonb(t)) from public.commercial_threads t where t.organization_id=p_organization_id), '[]'::jsonb),
      'commercial_observations', coalesce((select jsonb_agg(to_jsonb(t)) from public.commercial_observations t where t.organization_id=p_organization_id), '[]'::jsonb),
      'commercial_review_queue', coalesce((select jsonb_agg(to_jsonb(t)) from public.commercial_review_queue t where t.organization_id=p_organization_id), '[]'::jsonb),
      'worker_jobs', coalesce((select jsonb_agg(to_jsonb(t)) from public.worker_jobs t where t.organization_id=p_organization_id), '[]'::jsonb),
      'knowledge_sources', coalesce((select jsonb_agg(to_jsonb(t)) from public.knowledge_sources t where t.organization_id=p_organization_id), '[]'::jsonb),
      'knowledge_documents', coalesce((
        select jsonb_agg(to_jsonb(d))
        from public.knowledge_documents d
        join public.knowledge_sources s on s.id=d.source_id
        where s.organization_id=p_organization_id
      ), '[]'::jsonb),
      'knowledge_evidence', coalesce((
        select jsonb_agg(to_jsonb(e))
        from public.knowledge_evidence e
        join public.knowledge_sources s on s.id=e.source_id
        where s.organization_id=p_organization_id
      ), '[]'::jsonb),
      'knowledge_entities', coalesce((select jsonb_agg(to_jsonb(t)) from public.knowledge_entities t where t.organization_id=p_organization_id), '[]'::jsonb),
      'knowledge_entity_aliases', coalesce((
        select jsonb_agg(to_jsonb(a))
        from public.knowledge_entity_aliases a
        join public.knowledge_entities e on e.id=a.entity_id
        where e.organization_id=p_organization_id
      ), '[]'::jsonb),
      'knowledge_entity_bindings', coalesce((select jsonb_agg(to_jsonb(t)) from public.knowledge_entity_bindings t where t.organization_id=p_organization_id), '[]'::jsonb),
      'knowledge_entity_merge_audit', coalesce((select jsonb_agg(to_jsonb(t)) from public.knowledge_entity_merge_audit t where t.organization_id=p_organization_id), '[]'::jsonb)
    ),
    'rebuildable_excluded', jsonb_build_array(
      'worker_staging_observations',
      'observability_events',
      'knowledge_chunks',
      'knowledge_chunk_embeddings',
      'knowledge_entity_mentions'
    )
  );
end;
$$;

revoke execute on function public.tenant_export_snapshot(uuid)
  from public, anon, authenticated;
grant execute on function public.tenant_export_snapshot(uuid)
  to service_role;

create or replace function public.record_data_lifecycle_event(
  p_action text,
  p_status text,
  p_organization_id uuid default null,
  p_organization_slug text default null,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_action not in ('tenant_export', 'tenant_delete', 'retention', 'backup_rehearsal') then
    raise exception 'invalid lifecycle action: %', p_action;
  end if;
  if p_status not in ('started', 'completed', 'failed') then
    raise exception 'invalid lifecycle status: %', p_status;
  end if;

  insert into public.data_lifecycle_audit (
    action, status, organization_id, organization_slug, details
  )
  values (
    p_action, p_status, p_organization_id, p_organization_slug, coalesce(p_details, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.record_data_lifecycle_event(text, text, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_data_lifecycle_event(text, text, uuid, text, jsonb)
  to service_role;

create or replace function public.apply_operational_retention(
  p_now timestamptz default now(),
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_observability_candidates bigint := 0;
  v_staging_candidates bigint := 0;
  v_observability_deleted bigint := 0;
  v_staging_deleted bigint := 0;
  v_audit_id uuid;
begin
  select count(*)
  into v_observability_candidates
  from public.observability_events
  where occurred_at < p_now - interval '30 days';

  select count(*)
  into v_staging_candidates
  from public.worker_staging_observations s
  join public.worker_jobs j on j.id = s.job_id
  where j.status in ('completed', 'failed')
    and coalesce(j.completed_at, j.created_at) < p_now - interval '30 days';

  if not p_dry_run then
    delete from public.worker_staging_observations s
    using public.worker_jobs j
    where s.job_id = j.id
      and j.status in ('completed', 'failed')
      and coalesce(j.completed_at, j.created_at) < p_now - interval '30 days';
    get diagnostics v_staging_deleted = row_count;

    delete from public.observability_events
    where occurred_at < p_now - interval '30 days';
    get diagnostics v_observability_deleted = row_count;

    v_audit_id := public.record_data_lifecycle_event(
      'retention',
      'completed',
      null,
      null,
      jsonb_build_object(
        'cutoff_observability_days', 30,
        'cutoff_staging_days', 30,
        'observability_deleted', v_observability_deleted,
        'staging_deleted', v_staging_deleted
      )
    );
  end if;

  return jsonb_build_object(
    'contract', 'p0.10-v1',
    'dry_run', p_dry_run,
    'evaluated_at', p_now,
    'candidates', jsonb_build_object(
      'observability_events', v_observability_candidates,
      'worker_staging_observations', v_staging_candidates
    ),
    'deleted', jsonb_build_object(
      'observability_events', v_observability_deleted,
      'worker_staging_observations', v_staging_deleted
    ),
    'authoritative_tenant_rows_deleted', 0,
    'audit_id', v_audit_id,
    'policy', public.data_retention_policy()
  );
end;
$$;

revoke execute on function public.apply_operational_retention(timestamptz, boolean)
  from public, anon, authenticated;
grant execute on function public.apply_operational_retention(timestamptz, boolean)
  to service_role;

create or replace function public.delete_tenant_data(
  p_organization_id uuid,
  p_confirmation_slug text default null,
  p_storage_deleted boolean default false,
  p_dry_run boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_manifest jsonb;
  v_slug text;
  v_audit_id uuid;
begin
  v_manifest := public.tenant_export_manifest(p_organization_id);
  v_slug := v_manifest #>> '{organization,slug}';

  if p_dry_run then
    return jsonb_build_object(
      'contract', 'p0.10-v1',
      'dry_run', true,
      'organization_id', p_organization_id,
      'organization_slug', v_slug,
      'required_confirmation', 'DELETE:' || v_slug,
      'storage_must_be_deleted_first', true,
      'manifest', v_manifest
    );
  end if;

  if p_confirmation_slug is distinct from ('DELETE:' || v_slug) then
    raise exception 'confirmation token mismatch';
  end if;

  if not p_storage_deleted then
    raise exception 'storage deletion must be confirmed before database deletion';
  end if;

  -- Remove explicitly tenant-scoped operational rows first.
  delete from public.observability_events where organization_id = p_organization_id;
  delete from public.worker_jobs where organization_id = p_organization_id;

  -- Remove any developer/global evaluation links that reference private chunks;
  -- those references must not block erasure or preserve tenant identifiers.
  delete from public.retrieval_golden_query_targets t
  using public.knowledge_chunks c, public.knowledge_sources s
  where t.chunk_id = c.id
    and c.source_id = s.id
    and s.organization_id = p_organization_id;

  -- Private knowledge roots. Cascades remove documents/chunks/embeddings/evidence,
  -- aliases, mentions and bindings that belong to these tenant roots.
  delete from public.knowledge_entity_merge_audit where organization_id = p_organization_id;
  delete from public.knowledge_entity_bindings where organization_id = p_organization_id;
  delete from public.knowledge_sources where organization_id = p_organization_id;
  delete from public.knowledge_entities where organization_id = p_organization_id;

  -- Commercial archive roots.
  delete from public.commercial_datasets where organization_id = p_organization_id;
  delete from public.commercial_review_queue where organization_id = p_organization_id;
  delete from public.commercial_observations where organization_id = p_organization_id;
  delete from public.commercial_threads where organization_id = p_organization_id;

  -- CRM/transaction graph in dependency-safe order.
  delete from public.certificates where organization_id = p_organization_id;
  delete from public.availability where organization_id = p_organization_id;
  delete from public.deliveries where organization_id = p_organization_id;
  delete from public.extracted_fields where organization_id = p_organization_id;
  delete from public.price_history where organization_id = p_organization_id;
  delete from public.offer_lines where organization_id = p_organization_id;
  delete from public.order_lines where organization_id = p_organization_id;
  delete from public.rfq_lines where organization_id = p_organization_id;
  delete from public.documents where organization_id = p_organization_id;
  delete from public.messages where organization_id = p_organization_id;
  delete from public.offers where organization_id = p_organization_id;
  delete from public.orders where organization_id = p_organization_id;
  delete from public.rfqs where organization_id = p_organization_id;
  delete from public.conversations where organization_id = p_organization_id;
  delete from public.contacts where organization_id = p_organization_id;
  delete from public.companies where organization_id = p_organization_id;
  delete from public.products where organization_id = p_organization_id;

  delete from public.organization_memberships where organization_id = p_organization_id;
  delete from public.organizations where id = p_organization_id;

  v_audit_id := public.record_data_lifecycle_event(
    'tenant_delete',
    'completed',
    p_organization_id,
    v_slug,
    jsonb_build_object(
      'storage_deleted', true,
      'storage_object_count', coalesce((v_manifest #>> '{storage,object_count}')::bigint, 0),
      'table_counts_before_delete', v_manifest->'table_counts'
    )
  );

  return jsonb_build_object(
    'contract', 'p0.10-v1',
    'dry_run', false,
    'deleted', true,
    'organization_id', p_organization_id,
    'organization_slug', v_slug,
    'audit_id', v_audit_id,
    'storage_deleted', true,
    'table_counts_before_delete', v_manifest->'table_counts'
  );
end;
$$;

revoke execute on function public.delete_tenant_data(uuid, text, boolean, boolean)
  from public, anon, authenticated;
grant execute on function public.delete_tenant_data(uuid, text, boolean, boolean)
  to service_role;

comment on function public.delete_tenant_data(uuid, text, boolean, boolean) is
  'P0.10 tenant erasure RPC. Dry-run by default; destructive mode requires exact slug confirmation and proof that Storage objects were deleted through the Storage API first.';

create or replace function public.data_lifecycle_health()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retention jsonb;
  v_latest_audit timestamptz;
  v_bucket_versioning jsonb;
begin
  v_retention := public.apply_operational_retention(now(), true);

  select max(occurred_at)
  into v_latest_audit
  from public.data_lifecycle_audit;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'bucket', b.id,
        'versioning_status', b.versioning_status
      )
      order by b.id
    ),
    '[]'::jsonb
  )
  into v_bucket_versioning
  from storage.buckets b;

  return jsonb_build_object(
    'contract', 'p0.10-v1',
    'generated_at', now(),
    'retention', v_retention,
    'latest_lifecycle_audit_at', v_latest_audit,
    'storage_buckets', v_bucket_versioning,
    'restore_rehearsal_required_before_external_pilot', true,
    'automatic_backup_or_pitr_required_before_external_pilot', true
  );
end;
$$;

revoke execute on function public.data_lifecycle_health()
  from public, anon, authenticated;
grant execute on function public.data_lifecycle_health()
  to service_role;
