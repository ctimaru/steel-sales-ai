-- P1.3 — Data source center and import history.
-- Compose legacy knowledge imports with P1.2 batch imports and expose the result only
-- to the trusted worker (service_role). The worker validates the acting user's tenant
-- before supplying p_organization_id.

create or replace function public.p1_data_source_center(
  p_organization_id uuid,
  p_search text default null,
  p_state text default null,
  p_source_key text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
with
settings as (
  select
    greatest(least(coalesce(p_limit, 50), 100), 1) as limit_value,
    greatest(coalesce(p_offset, 0), 0) as offset_value,
    nullif(btrim(coalesce(p_search, '')), '') as search_value,
    nullif(btrim(coalesce(p_state, '')), '') as state_value,
    nullif(btrim(coalesce(p_source_key, '')), '') as source_value
),
active_model as (
  select m.id, m.model_key, m.model_name
  from public.knowledge_embedding_models m
  where m.status = 'active'
  order by m.updated_at desc
  limit 1
),
org_sources as (
  select s.id, s.source_key, s.source_type, s.source_class, s.name
  from public.knowledge_sources s
  where s.organization_id = p_organization_id
),
document_stats as (
  select
    d.id,
    d.source_id,
    d.document_type,
    d.title,
    d.filename,
    d.status,
    d.content_checksum,
    d.created_at,
    d.updated_at,
    d.extracted_at,
    s.source_key,
    s.source_type,
    s.source_class,
    s.name as source_name,
    count(c.id)::integer as chunk_count,
    count(e.id)::integer as embedded_count
  from public.knowledge_documents d
  join org_sources s on s.id = d.source_id
  left join public.knowledge_chunks c on c.document_id = d.id
  left join active_model am on true
  left join public.knowledge_chunk_embeddings e
    on e.chunk_id = c.id
   and e.model_id = am.id
  group by
    d.id,
    d.source_id,
    d.document_type,
    d.title,
    d.filename,
    d.status,
    d.content_checksum,
    d.created_at,
    d.updated_at,
    d.extracted_at,
    s.source_key,
    s.source_type,
    s.source_class,
    s.name
),
batch_history as (
  select
    'batch:' || i.id::text as history_id,
    i.batch_id,
    i.id as item_id,
    d.id as document_id,
    coalesce(nullif(i.filename, ''), d.filename, d.title, 'Documento') as display_name,
    case when lower(i.extension) = '.eml' then 'email' else 'file' end as media_type,
    b.source as source_key,
    case b.source
      when 'manual_bulk' then 'Upload manuale'
      when 'mailbox' then 'Mailbox'
      when 'api' then 'API'
      else b.source
    end as source_name,
    'import_batch'::text as source_type,
    case
      when i.deduplicated then 'duplicate'
      when i.status = 'failed' or w.status = 'failed' or d.status = 'failed' then 'error'
      when i.status in ('queued', 'processing') or w.status in ('queued', 'processing') then 'processing'
      when i.status = 'completed' and w.id is not null and w.knowledge_document_id is null then 'discarded'
      when d.status = 'superseded' then 'discarded'
      else 'ready'
    end as state,
    case
      when i.status = 'failed' or w.status = 'failed' or d.status in ('failed', 'superseded') then 'not_applicable'
      when i.status in ('queued', 'processing') or w.status in ('queued', 'processing') then 'pending'
      when d.id is null then case when i.deduplicated then 'not_available' else 'pending' end
      when d.chunk_count = 0 then 'no_content'
      when d.embedded_count >= d.chunk_count then 'indexed'
      when d.embedded_count > 0 then 'indexing'
      else 'pending'
    end as indexing_state,
    i.deduplicated,
    coalesce(i.last_error, w.error) as error,
    i.attempt_count,
    i.size_bytes,
    coalesce(d.chunk_count, w.knowledge_chunk_count, 0)::integer as chunk_count,
    coalesce(d.embedded_count, 0)::integer as embedded_count,
    i.created_at as imported_at,
    greatest(
      i.updated_at,
      b.updated_at,
      coalesce(w.completed_at, w.started_at, w.created_at),
      coalesce(d.updated_at, d.created_at)
    ) as last_sync_at
  from public.import_batch_items i
  join public.import_batches b on b.id = i.batch_id
  left join public.worker_jobs w on w.id = i.worker_job_id
  left join document_stats d on d.id = w.knowledge_document_id
  where i.organization_id = p_organization_id
    and b.organization_id = p_organization_id
),
legacy_documents as (
  select
    'document:' || d.id::text as history_id,
    null::uuid as batch_id,
    null::uuid as item_id,
    d.id as document_id,
    coalesce(nullif(d.filename, ''), d.title, 'Documento') as display_name,
    case
      when lower(coalesce(d.filename, '')) like '%.eml' or d.document_type ilike '%email%' then 'email'
      else 'file'
    end as media_type,
    d.source_key,
    d.source_name,
    d.source_type,
    case
      when d.status = 'failed' or w.status = 'failed' then 'error'
      when d.status = 'pending' or w.status in ('queued', 'processing') then 'processing'
      when d.status = 'superseded' then 'discarded'
      else 'ready'
    end as state,
    case
      when d.status in ('failed', 'superseded') or w.status = 'failed' then 'not_applicable'
      when d.status = 'pending' or w.status in ('queued', 'processing') then 'pending'
      when d.chunk_count = 0 then 'no_content'
      when d.embedded_count >= d.chunk_count then 'indexed'
      when d.embedded_count > 0 then 'indexing'
      else 'pending'
    end as indexing_state,
    coalesce(w.knowledge_deduplicated, false) as deduplicated,
    w.error,
    coalesce(w.attempt_number, 0)::integer as attempt_count,
    w.size_bytes,
    d.chunk_count,
    d.embedded_count,
    d.created_at as imported_at,
    greatest(
      d.updated_at,
      coalesce(d.extracted_at, d.created_at),
      coalesce(w.completed_at, w.started_at, w.created_at)
    ) as last_sync_at
  from document_stats d
  left join lateral (
    select
      w.id,
      w.status,
      w.error,
      w.attempt_number,
      w.size_bytes,
      w.knowledge_deduplicated,
      w.created_at,
      w.started_at,
      w.completed_at
    from public.worker_jobs w
    where w.organization_id = p_organization_id
      and w.knowledge_document_id = d.id
    order by w.created_at desc
    limit 1
  ) w on true
  where not exists (
    select 1
    from public.worker_jobs linked
    where linked.organization_id = p_organization_id
      and linked.knowledge_document_id = d.id
      and linked.import_batch_item_id is not null
  )
),
legacy_jobs as (
  select
    'job:' || w.id::text as history_id,
    null::uuid as batch_id,
    null::uuid as item_id,
    null::uuid as document_id,
    coalesce(nullif(w.filename, ''), 'Import senza documento') as display_name,
    case when lower(coalesce(w.extension, '')) = '.eml' then 'email' else 'file' end as media_type,
    'legacy_upload'::text as source_key,
    'Upload storico'::text as source_name,
    'worker_upload'::text as source_type,
    case
      when w.status = 'failed' then 'error'
      when w.status = 'completed' then 'discarded'
      else 'processing'
    end as state,
    'not_applicable'::text as indexing_state,
    false as deduplicated,
    w.error,
    coalesce(w.attempt_number, 0)::integer as attempt_count,
    w.size_bytes,
    coalesce(w.knowledge_chunk_count, 0)::integer as chunk_count,
    0::integer as embedded_count,
    w.created_at as imported_at,
    greatest(w.created_at, coalesce(w.started_at, w.created_at), coalesce(w.completed_at, w.created_at)) as last_sync_at
  from public.worker_jobs w
  where w.organization_id = p_organization_id
    and w.import_batch_item_id is null
    and w.knowledge_document_id is null
),
history as (
  select * from batch_history
  union all
  select * from legacy_documents
  union all
  select * from legacy_jobs
),
filtered as (
  select h.*
  from history h
  cross join settings cfg
  where
    (
      cfg.search_value is null
      or h.display_name ilike '%' || cfg.search_value || '%'
      or h.source_name ilike '%' || cfg.search_value || '%'
      or coalesce(h.error, '') ilike '%' || cfg.search_value || '%'
    )
    and (cfg.source_value is null or h.source_key = cfg.source_value)
    and (
      cfg.state_value is null
      or cfg.state_value = 'all'
      or (cfg.state_value = 'indexed' and h.indexing_state = 'indexed')
      or (cfg.state_value = 'indexing' and h.indexing_state in ('indexing', 'pending'))
      or (cfg.state_value not in ('indexed', 'indexing') and h.state = cfg.state_value)
    )
),
source_summary as (
  select
    h.source_key,
    h.source_name,
    h.source_type,
    count(*)::integer as total_items,
    count(*) filter (where h.indexing_state = 'indexed')::integer as indexed_items,
    count(*) filter (where h.state = 'duplicate')::integer as duplicate_items,
    count(*) filter (where h.state = 'error')::integer as error_items,
    max(h.last_sync_at) as last_sync_at
  from history h
  group by h.source_key, h.source_name, h.source_type
),
page as (
  select f.*
  from filtered f
  cross join settings cfg
  order by f.last_sync_at desc nulls last, f.history_id
  limit (select limit_value from settings)
  offset (select offset_value from settings)
)
select jsonb_build_object(
  'summary', jsonb_build_object(
    'total', (select count(*) from history),
    'indexed', (select count(*) from history where indexing_state = 'indexed'),
    'indexing', (select count(*) from history where indexing_state in ('indexing', 'pending')),
    'duplicates', (select count(*) from history where state = 'duplicate'),
    'errors', (select count(*) from history where state = 'error'),
    'discarded', (select count(*) from history where state = 'discarded'),
    'processing', (select count(*) from history where state = 'processing'),
    'last_sync_at', (select max(last_sync_at) from history),
    'active_model_key', (select model_key from active_model),
    'active_model_name', (select model_name from active_model)
  ),
  'sources', coalesce(
    (
      select jsonb_agg(to_jsonb(s) order by s.last_sync_at desc nulls last, s.source_name)
      from source_summary s
    ),
    '[]'::jsonb
  ),
  'items', coalesce(
    (
      select jsonb_agg(to_jsonb(p) order by p.last_sync_at desc nulls last, p.history_id)
      from page p
    ),
    '[]'::jsonb
  ),
  'total_filtered', (select count(*) from filtered),
  'limit', (select limit_value from settings),
  'offset', (select offset_value from settings)
);
$$;

revoke all on function public.p1_data_source_center(uuid, text, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.p1_data_source_center(uuid, text, text, text, integer, integer)
  to service_role;

comment on function public.p1_data_source_center(uuid, text, text, text, integer, integer) is
  'P1.3 trusted-worker aggregation of tenant import history, source health and semantic indexing coverage.';
