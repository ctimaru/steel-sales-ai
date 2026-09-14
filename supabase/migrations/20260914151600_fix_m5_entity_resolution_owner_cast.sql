create or replace function public.resolve_commercial_entities(
  p_thread_id uuid default null,
  p_document_id uuid default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_selected integer := 0;
  v_entities integer := 0;
  v_aliases integer := 0;
  v_mentions integer := 0;
  v_bindings jsonb := '{}'::jsonb;
begin
  if p_limit < 1 or p_limit > 5000 then
    raise exception 'p_limit must be between 1 and 5000';
  end if;

  with selected_observations as (
    select o.*
    from public.commercial_observations o
    where (p_thread_id is null or o.thread_id = p_thread_id)
      and (
        nullif(btrim(o.grade), '') is not null
        or nullif(btrim(o.standard), '') is not null
        or nullif(btrim(o.product_type), '') is not null
      )
      and exists (
        select 1
        from (values
          ('grade'::text, o.grade),
          ('standard'::text, o.standard),
          ('product_type'::text, o.product_type)
        ) fields(source_field, raw_value)
        where nullif(btrim(fields.raw_value), '') is not null
          and not exists (
            select 1
            from public.knowledge_entity_mentions m
            where m.observation_id = o.id
              and m.source_field = fields.source_field
              and m.resolver_version = 'm5.4-v1'
          )
      )
    order by o.id
    limit p_limit
  )
  select count(*) into v_selected from selected_observations;

  with selected_observations as (
    select o.*
    from public.commercial_observations o
    where (p_thread_id is null or o.thread_id = p_thread_id)
      and (
        nullif(btrim(o.grade), '') is not null
        or nullif(btrim(o.standard), '') is not null
        or nullif(btrim(o.product_type), '') is not null
      )
      and exists (
        select 1
        from (values
          ('grade'::text, o.grade),
          ('standard'::text, o.standard),
          ('product_type'::text, o.product_type)
        ) fields(source_field, raw_value)
        where nullif(btrim(fields.raw_value), '') is not null
          and not exists (
            select 1
            from public.knowledge_entity_mentions m
            where m.observation_id = o.id
              and m.source_field = fields.source_field
              and m.resolver_version = 'm5.4-v1'
          )
      )
    order by o.id
    limit p_limit
  ), candidates as (
    select
      o.id as observation_id,
      o.owner_id,
      o.thread_id,
      valueset.entity_type,
      valueset.source_field,
      valueset.raw_value
    from selected_observations o
    cross join lateral (values
      ('grade'::text, 'grade'::text, o.grade),
      ('standard'::text, 'standard'::text, o.standard),
      ('product_family'::text, 'product_type'::text, o.product_type)
    ) valueset(entity_type, source_field, raw_value)
    where nullif(btrim(valueset.raw_value), '') is not null
  )
  insert into public.knowledge_entities (
    owner_id, access_scope, entity_type, canonical_key,
    canonical_name, normalized_name, metadata
  )
  select distinct
    null::uuid,
    'global',
    c.entity_type,
    public.normalize_knowledge_entity_value(c.raw_value),
    public.canonical_knowledge_entity_name(c.entity_type, c.raw_value),
    public.normalize_knowledge_entity_value(c.raw_value),
    jsonb_build_object('seed', 'commercial_observations')
  from candidates c
  where public.normalize_knowledge_entity_value(c.raw_value) <> ''
  on conflict do nothing;

  get diagnostics v_entities = row_count;

  with selected_observations as (
    select o.*
    from public.commercial_observations o
    where (p_thread_id is null or o.thread_id = p_thread_id)
      and (
        nullif(btrim(o.grade), '') is not null
        or nullif(btrim(o.standard), '') is not null
        or nullif(btrim(o.product_type), '') is not null
      )
      and exists (
        select 1
        from (values
          ('grade'::text, o.grade),
          ('standard'::text, o.standard),
          ('product_type'::text, o.product_type)
        ) fields(source_field, raw_value)
        where nullif(btrim(fields.raw_value), '') is not null
          and not exists (
            select 1
            from public.knowledge_entity_mentions m
            where m.observation_id = o.id
              and m.source_field = fields.source_field
              and m.resolver_version = 'm5.4-v1'
          )
      )
    order by o.id
    limit p_limit
  ), candidates as (
    select
      valueset.entity_type,
      valueset.raw_value
    from selected_observations o
    cross join lateral (values
      ('grade'::text, o.grade),
      ('standard'::text, o.standard),
      ('product_family'::text, o.product_type)
    ) valueset(entity_type, raw_value)
    where nullif(btrim(valueset.raw_value), '') is not null
  )
  insert into public.knowledge_entity_aliases (
    entity_id, alias, normalized_alias, alias_type, confidence, metadata
  )
  select distinct
    e.id,
    c.raw_value,
    public.normalize_knowledge_entity_value(c.raw_value),
    'observed',
    1,
    jsonb_build_object('seed', 'commercial_observations')
  from candidates c
  join public.knowledge_entities e
    on e.access_scope = 'global'
   and e.entity_type = c.entity_type
   and e.canonical_key = public.normalize_knowledge_entity_value(c.raw_value)
  on conflict (entity_id, normalized_alias) do nothing;

  get diagnostics v_aliases = row_count;

  with selected_observations as (
    select o.*
    from public.commercial_observations o
    where (p_thread_id is null or o.thread_id = p_thread_id)
      and (
        nullif(btrim(o.grade), '') is not null
        or nullif(btrim(o.standard), '') is not null
        or nullif(btrim(o.product_type), '') is not null
      )
      and exists (
        select 1
        from (values
          ('grade'::text, o.grade),
          ('standard'::text, o.standard),
          ('product_type'::text, o.product_type)
        ) fields(source_field, raw_value)
        where nullif(btrim(fields.raw_value), '') is not null
          and not exists (
            select 1
            from public.knowledge_entity_mentions m
            where m.observation_id = o.id
              and m.source_field = fields.source_field
              and m.resolver_version = 'm5.4-v1'
          )
      )
    order by o.id
    limit p_limit
  ), contexts as (
    select
      o.*,
      coalesce(
        archive_chunk.document_id,
        p_document_id,
        job_doc.knowledge_document_id
      ) as resolved_document_id,
      archive_chunk.id as archive_chunk_id
    from selected_observations o
    left join lateral (
      select kc.id, kc.document_id
      from public.knowledge_chunks kc
      where kc.source_locator ->> 'observation_id' = o.id::text
      order by kc.chunk_index
      limit 1
    ) archive_chunk on true
    left join lateral (
      select wj.knowledge_document_id
      from public.worker_jobs wj
      where wj.id = o.thread_id or wj.thread_id = o.thread_id
      order by wj.created_at desc
      limit 1
    ) job_doc on true
  ), candidates as (
    select
      c.id as observation_id,
      c.owner_id,
      c.thread_id,
      c.source_text,
      c.resolved_document_id,
      c.archive_chunk_id,
      valueset.entity_type,
      valueset.source_field,
      valueset.raw_value
    from contexts c
    cross join lateral (values
      ('grade'::text, 'grade'::text, c.grade),
      ('standard'::text, 'standard'::text, c.standard),
      ('product_family'::text, 'product_type'::text, c.product_type)
    ) valueset(entity_type, source_field, raw_value)
    where nullif(btrim(valueset.raw_value), '') is not null
  ), grounded as (
    select
      c.*,
      kd.source_id,
      coalesce(c.archive_chunk_id, matched_chunk.id) as resolved_chunk_id
    from candidates c
    left join public.knowledge_documents kd
      on kd.id = c.resolved_document_id
    left join lateral (
      select kc.id
      from public.knowledge_chunks kc
      where kc.document_id = c.resolved_document_id
        and nullif(btrim(c.source_text), '') is not null
        and position(lower(c.source_text) in lower(kc.content)) > 0
      order by kc.chunk_index
      limit 1
    ) matched_chunk on c.archive_chunk_id is null
  )
  insert into public.knowledge_entity_mentions (
    entity_id, observation_id, source_id, document_id, chunk_id,
    source_field, mention_text, normalized_mention,
    confidence, resolver_method, resolver_version, metadata
  )
  select
    e.id,
    g.observation_id,
    g.source_id,
    case when g.source_id is not null then g.resolved_document_id else null end,
    case when g.source_id is not null then g.resolved_chunk_id else null end,
    g.source_field,
    g.raw_value,
    public.normalize_knowledge_entity_value(g.raw_value),
    1,
    'normalized_exact',
    'm5.4-v1',
    jsonb_build_object(
      'thread_id', g.thread_id,
      'source_field', g.source_field,
      'grounded_to_chunk', g.resolved_chunk_id is not null
    )
  from grounded g
  join public.knowledge_entities e
    on e.access_scope = 'global'
   and e.entity_type = g.entity_type
   and e.canonical_key = public.normalize_knowledge_entity_value(g.raw_value)
  on conflict do nothing;

  get diagnostics v_mentions = row_count;

  v_bindings := public.sync_knowledge_entity_bindings(null);

  return jsonb_build_object(
    'selected_observation_count', v_selected,
    'entities_created', v_entities,
    'aliases_created', v_aliases,
    'mentions_created', v_mentions,
    'bindings', v_bindings,
    'resolver_version', 'm5.4-v1'
  );
end;
$$;