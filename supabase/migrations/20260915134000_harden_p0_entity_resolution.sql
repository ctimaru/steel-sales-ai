-- P0.7 — Entity resolution production hardening.
--
-- Goals:
--   * align canonical entity keys with the P0.4 steel ontology;
--   * make private entity identity organization-scoped rather than user-scoped;
--   * prevent ambiguous alias assignment inside the same entity type/scope;
--   * propagate source confidence and tenant-safe provenance into mentions;
--   * keep resolver/binding/merge operations service-role only and SECURITY INVOKER;
--   * provide an explicit, atomic, audited merge operation (never fuzzy/automatic);
--   * expose a deterministic health contract for CI and production smoke tests.

create or replace function public.canonical_knowledge_entity_key(
  p_entity_type text,
  p_value text
)
returns text
language plpgsql
immutable
strict
security invoker
set search_path = ''
as $$
declare
  v_family text;
begin
  if p_entity_type in ('grade', 'standard', 'process') then
    return public.canonical_steel_token(p_value);
  end if;

  if p_entity_type = 'product_family' then
    v_family := public.canonical_tube_family(p_value, null, null, null);
    if v_family is not null then
      return public.canonical_steel_token(v_family);
    end if;
  end if;

  return nullif(public.normalize_knowledge_entity_value(p_value), '');
end;
$$;

revoke execute on function public.canonical_knowledge_entity_key(text, text)
  from public, anon;
grant execute on function public.canonical_knowledge_entity_key(text, text)
  to authenticated, service_role;

comment on function public.canonical_knowledge_entity_key(text, text) is
  'P0.7 type-aware canonical entity key aligned with the P0.4 steel ontology for grades, standards, processes and tube families.';

-- Private knowledge belongs to a tenant. owner_id remains provenance/creator,
-- but it is no longer the uniqueness boundary for a private entity.
drop index if exists public.knowledge_entities_owner_key_uq;
create unique index if not exists knowledge_entities_organization_key_uq
  on public.knowledge_entities (organization_id, entity_type, canonical_key)
  where access_scope = 'owner';

create or replace function public.guard_knowledge_entity_alias_collision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_scope text;
  v_entity_type text;
  v_organization_id uuid;
begin
  select e.access_scope, e.entity_type, e.organization_id
    into v_scope, v_entity_type, v_organization_id
  from public.knowledge_entities e
  where e.id = new.entity_id;

  if not found then
    raise exception 'Knowledge entity % not found', new.entity_id;
  end if;

  new.normalized_alias := public.normalize_knowledge_entity_value(new.alias);
  if new.normalized_alias = '' then
    raise exception 'Knowledge entity alias cannot normalize to an empty value';
  end if;

  if exists (
    select 1
    from public.knowledge_entity_aliases a
    join public.knowledge_entities e on e.id = a.entity_id
    where a.id <> new.id
      and a.entity_id <> new.entity_id
      and a.normalized_alias = new.normalized_alias
      and e.entity_type = v_entity_type
      and (
        (v_scope = 'global' and e.access_scope = 'global')
        or (
          v_scope = 'owner'
          and e.access_scope = 'owner'
          and e.organization_id = v_organization_id
        )
      )
  ) then
    raise exception 'Ambiguous knowledge alias "%" for entity type % in scope %',
      new.alias, v_entity_type, v_scope;
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_knowledge_entity_alias_collision()
  from public, anon, authenticated;
grant execute on function public.guard_knowledge_entity_alias_collision()
  to service_role;

drop trigger if exists knowledge_entity_aliases_collision_guard
  on public.knowledge_entity_aliases;
create trigger knowledge_entity_aliases_collision_guard
before insert or update of entity_id, alias, normalized_alias
on public.knowledge_entity_aliases
for each row
execute function public.guard_knowledge_entity_alias_collision();

-- Merge audit is deliberately internal. No authenticated/anon policy is created;
-- service_role is the only application role allowed to read/write it.
create table if not exists public.knowledge_entity_merge_audit (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  source_entity_id uuid not null,
  target_entity_id uuid not null,
  entity_type text not null,
  reason text not null check (length(btrim(reason)) >= 3),
  source_snapshot jsonb not null,
  target_snapshot jsonb not null,
  merged_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.knowledge_entity_merge_audit enable row level security;
revoke all on table public.knowledge_entity_merge_audit from public, anon, authenticated;
grant select, insert on table public.knowledge_entity_merge_audit to service_role;

create index if not exists knowledge_entity_merge_audit_target_idx
  on public.knowledge_entity_merge_audit (target_entity_id, created_at desc);
create index if not exists knowledge_entity_merge_audit_organization_idx
  on public.knowledge_entity_merge_audit (organization_id, created_at desc)
  where organization_id is not null;

create or replace function public.merge_knowledge_entities(
  p_source_entity_id uuid,
  p_target_entity_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_source public.knowledge_entities%rowtype;
  v_target public.knowledge_entities%rowtype;
  v_aliases integer := 0;
  v_mentions integer := 0;
  v_bindings integer := 0;
begin
  if p_source_entity_id = p_target_entity_id then
    raise exception 'Source and target entity must be different';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 then
    raise exception 'A merge reason of at least 3 characters is required';
  end if;

  select * into v_source
  from public.knowledge_entities
  where id = p_source_entity_id
  for update;
  if not found then
    raise exception 'Source knowledge entity % not found', p_source_entity_id;
  end if;

  select * into v_target
  from public.knowledge_entities
  where id = p_target_entity_id
  for update;
  if not found then
    raise exception 'Target knowledge entity % not found', p_target_entity_id;
  end if;

  if v_source.entity_type <> v_target.entity_type then
    raise exception 'Cannot merge different entity types: % -> %', v_source.entity_type, v_target.entity_type;
  end if;
  if v_source.access_scope <> v_target.access_scope then
    raise exception 'Cannot merge different access scopes: % -> %', v_source.access_scope, v_target.access_scope;
  end if;
  if v_source.access_scope = 'owner'
     and v_source.organization_id is distinct from v_target.organization_id then
    raise exception 'Cannot merge private entities across organizations';
  end if;

  insert into public.knowledge_entity_merge_audit (
    organization_id, source_entity_id, target_entity_id, entity_type, reason,
    source_snapshot, target_snapshot, merged_by, metadata
  ) values (
    case when v_source.access_scope = 'owner' then v_source.organization_id else null end,
    v_source.id,
    v_target.id,
    v_source.entity_type,
    btrim(p_reason),
    to_jsonb(v_source),
    to_jsonb(v_target),
    auth.uid(),
    jsonb_build_object('contract', 'p0.7-v2', 'automatic', false)
  );

  -- Remove rows that would become duplicates, then move the remaining aliases.
  delete from public.knowledge_entity_aliases s
  using public.knowledge_entity_aliases t
  where s.entity_id = v_source.id
    and t.entity_id = v_target.id
    and s.normalized_alias = t.normalized_alias;

  update public.knowledge_entity_aliases
  set entity_id = v_target.id
  where entity_id = v_source.id;
  get diagnostics v_aliases = row_count;

  -- The mention table has separate unique contracts for observation and chunk
  -- grounding. Remove exact duplicates before re-pointing the rest.
  delete from public.knowledge_entity_mentions s
  using public.knowledge_entity_mentions t
  where s.entity_id = v_source.id
    and t.entity_id = v_target.id
    and s.source_field = t.source_field
    and s.normalized_mention = t.normalized_mention
    and (
      (s.observation_id is not null and s.observation_id = t.observation_id)
      or (s.chunk_id is not null and s.chunk_id = t.chunk_id)
    );

  update public.knowledge_entity_mentions
  set entity_id = v_target.id,
      metadata = metadata || jsonb_build_object(
        'merged_from_entity_id', v_source.id,
        'merge_contract', 'p0.7-v2'
      )
  where entity_id = v_source.id;
  get diagnostics v_mentions = row_count;

  delete from public.knowledge_entity_bindings s
  using public.knowledge_entity_bindings t
  where s.entity_id = v_source.id
    and t.entity_id = v_target.id
    and s.binding_field = t.binding_field
    and (
      (s.company_id is not null and s.company_id = t.company_id)
      or (s.product_id is not null and s.product_id = t.product_id)
    );

  update public.knowledge_entity_bindings
  set entity_id = v_target.id,
      metadata = metadata || jsonb_build_object(
        'merged_from_entity_id', v_source.id,
        'merge_contract', 'p0.7-v2'
      ),
      updated_at = now()
  where entity_id = v_source.id;
  get diagnostics v_bindings = row_count;

  update public.knowledge_entities
  set metadata = metadata || jsonb_build_object(
        'last_manual_merge', jsonb_build_object(
          'source_entity_id', v_source.id,
          'reason', btrim(p_reason),
          'contract', 'p0.7-v2'
        )
      ),
      updated_at = now()
  where id = v_target.id;

  delete from public.knowledge_entities where id = v_source.id;

  return jsonb_build_object(
    'source_entity_id', v_source.id,
    'target_entity_id', v_target.id,
    'entity_type', v_target.entity_type,
    'aliases_moved', v_aliases,
    'mentions_moved', v_mentions,
    'bindings_moved', v_bindings,
    'merge_contract', 'p0.7-v2',
    'automatic', false
  );
end;
$$;

revoke execute on function public.merge_knowledge_entities(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.merge_knowledge_entities(uuid, uuid, text)
  to service_role;

comment on function public.merge_knowledge_entities(uuid, uuid, text) is
  'P0.7 explicit atomic merge. Requires same type and same scope/organization; never invoked automatically or by fuzzy matching.';

create or replace function public.sync_knowledge_entity_bindings(
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_bindings integer := 0;
  v_product_bindings integer := 0;
begin
  insert into public.knowledge_entity_bindings (
    entity_id, owner_id, organization_id, company_id, binding_field,
    binding_method, confidence, metadata
  )
  select
    e.id,
    c.owner_id,
    c.organization_id,
    c.id,
    'company.name',
    'canonical_exact',
    1,
    jsonb_build_object('source', 'companies', 'contract', 'p0.7-v2')
  from public.knowledge_entities e
  join public.companies c
    on e.entity_type = 'company'
   and public.canonical_knowledge_entity_key('company', c.name) = e.canonical_key
   and (
     e.access_scope = 'global'
     or (e.access_scope = 'owner' and e.organization_id = c.organization_id)
   )
  where p_owner_id is null or c.owner_id = p_owner_id
  on conflict do nothing;

  get diagnostics v_company_bindings = row_count;

  insert into public.knowledge_entity_bindings (
    entity_id, owner_id, organization_id, product_id, binding_field,
    binding_method, confidence, metadata
  )
  select
    e.id,
    p.owner_id,
    p.organization_id,
    p.id,
    matched.binding_field,
    'canonical_exact',
    1,
    jsonb_build_object(
      'source', 'products',
      'contract', 'p0.7-v2',
      'canonical_product_id', p.canonical_product_id
    )
  from public.knowledge_entities e
  join public.products p
    on p_owner_id is null or p.owner_id = p_owner_id
  cross join lateral (
    select case
      when e.entity_type = 'grade'
        and p.grade is not null
        and public.canonical_knowledge_entity_key('grade', p.grade) = e.canonical_key
        then 'product.grade'
      when e.entity_type = 'standard'
        and p.standard is not null
        and public.canonical_knowledge_entity_key('standard', p.standard) = e.canonical_key
        then 'product.standard'
      when e.entity_type = 'product_family'
        and p.product_type is not null
        and public.canonical_knowledge_entity_key('product_family', p.product_type) = e.canonical_key
        then 'product.product_type'
      when e.entity_type = 'process'
        and p.manufacturing_process is not null
        and public.canonical_knowledge_entity_key('process', p.manufacturing_process) = e.canonical_key
        then 'product.manufacturing_process'
      else null
    end as binding_field
  ) matched
  where matched.binding_field is not null
    and (
      e.access_scope = 'global'
      or (e.access_scope = 'owner' and e.organization_id = p.organization_id)
    )
  on conflict do nothing;

  get diagnostics v_product_bindings = row_count;

  return jsonb_build_object(
    'company_bindings_created', v_company_bindings,
    'product_bindings_created', v_product_bindings,
    'binding_contract', 'p0.7-v2'
  );
end;
$$;

revoke execute on function public.sync_knowledge_entity_bindings(uuid)
  from public, anon, authenticated;
grant execute on function public.sync_knowledge_entity_bindings(uuid)
  to service_role;

create or replace function public.resolve_commercial_entities(
  p_thread_id uuid default null,
  p_document_id uuid default null,
  p_limit integer default 500
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_selected integer := 0;
  v_entities integer := 0;
  v_aliases integer := 0;
  v_mentions integer := 0;
  v_bindings jsonb := '{}'::jsonb;
  v_thread_organization_id uuid;
begin
  if p_limit < 1 or p_limit > 5000 then
    raise exception 'p_limit must be between 1 and 5000';
  end if;

  -- An explicit document is meaningful only for one thread and must be visible
  -- to that thread's tenant (or be a global knowledge source).
  if p_document_id is not null then
    if p_thread_id is null then
      raise exception 'p_document_id requires p_thread_id for tenant-safe grounding';
    end if;

    select t.organization_id into v_thread_organization_id
    from public.commercial_threads t
    where t.id = p_thread_id;

    if not found then
      raise exception 'Commercial thread % not found', p_thread_id;
    end if;

    if not exists (
      select 1
      from public.knowledge_documents d
      join public.knowledge_sources s on s.id = d.source_id
      where d.id = p_document_id
        and (
          s.access_scope = 'global'
          or s.organization_id = v_thread_organization_id
        )
    ) then
      raise exception 'Knowledge document % is not visible to thread tenant', p_document_id;
    end if;
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
      and exists (
        select 1
        from (values
          ('grade'::text, o.grade),
          ('standard'::text, o.standard),
          ('product_type'::text, o.product_type)
        ) fields(source_field, raw_value)
        where nullif(btrim(fields.raw_value), '') is not null
          and not exists (
            select 1 from public.knowledge_entity_mentions m
            where m.observation_id = o.id and m.source_field = fields.source_field
          )
      )
    order by o.id
    limit p_limit
  ), candidates as (
    select
      o.id observation_id,
      o.owner_id,
      o.organization_id,
      o.thread_id,
      least(greatest(coalesce(o.confidence, 0.5), 0), 1) source_confidence,
      valueset.entity_type,
      valueset.source_field,
      valueset.raw_value,
      public.canonical_knowledge_entity_key(valueset.entity_type, valueset.raw_value) canonical_key
    from selected_observations o
    cross join lateral (values
      ('grade'::text, 'grade'::text, o.grade),
      ('standard'::text, 'standard'::text, o.standard),
      ('product_family'::text, 'product_type'::text, o.product_type)
    ) valueset(entity_type, source_field, raw_value)
    where nullif(btrim(valueset.raw_value), '') is not null
  )
  insert into public.knowledge_entities (
    owner_id, organization_id, access_scope, entity_type, canonical_key,
    canonical_name, normalized_name, metadata
  )
  select distinct
    null::uuid,
    null::uuid,
    'global',
    c.entity_type,
    c.canonical_key,
    public.canonical_knowledge_entity_name(c.entity_type, c.raw_value),
    c.canonical_key,
    jsonb_build_object(
      'seed', 'commercial_observations',
      'resolver_contract', 'p0.7-v2',
      'canonicalization', 'p0.4-aligned'
    )
  from candidates c
  where c.canonical_key is not null and c.canonical_key <> ''
  on conflict do nothing;

  get diagnostics v_entities = row_count;

  with selected_observations as (
    select o.*
    from public.commercial_observations o
    where (p_thread_id is null or o.thread_id = p_thread_id)
      and exists (
        select 1
        from (values
          ('grade'::text, o.grade),
          ('standard'::text, o.standard),
          ('product_type'::text, o.product_type)
        ) fields(source_field, raw_value)
        where nullif(btrim(fields.raw_value), '') is not null
          and not exists (
            select 1 from public.knowledge_entity_mentions m
            where m.observation_id = o.id and m.source_field = fields.source_field
          )
      )
    order by o.id
    limit p_limit
  ), candidates as (
    select
      valueset.entity_type,
      valueset.raw_value,
      public.canonical_knowledge_entity_key(valueset.entity_type, valueset.raw_value) canonical_key,
      max(least(greatest(coalesce(o.confidence, 0.5), 0), 1)) source_confidence
    from selected_observations o
    cross join lateral (values
      ('grade'::text, o.grade),
      ('standard'::text, o.standard),
      ('product_family'::text, o.product_type)
    ) valueset(entity_type, raw_value)
    where nullif(btrim(valueset.raw_value), '') is not null
    group by valueset.entity_type, valueset.raw_value
  )
  insert into public.knowledge_entity_aliases (
    entity_id, alias, normalized_alias, alias_type, confidence, metadata
  )
  select
    e.id,
    c.raw_value,
    public.normalize_knowledge_entity_value(c.raw_value),
    'observed',
    c.source_confidence,
    jsonb_build_object('seed', 'commercial_observations', 'resolver_contract', 'p0.7-v2')
  from candidates c
  join public.knowledge_entities e
    on e.access_scope = 'global'
   and e.entity_type = c.entity_type
   and e.canonical_key = c.canonical_key
  on conflict (entity_id, normalized_alias) do update
    set confidence = greatest(public.knowledge_entity_aliases.confidence, excluded.confidence),
        metadata = public.knowledge_entity_aliases.metadata || excluded.metadata;

  get diagnostics v_aliases = row_count;

  with selected_observations as (
    select o.*
    from public.commercial_observations o
    where (p_thread_id is null or o.thread_id = p_thread_id)
      and exists (
        select 1
        from (values
          ('grade'::text, o.grade),
          ('standard'::text, o.standard),
          ('product_type'::text, o.product_type)
        ) fields(source_field, raw_value)
        where nullif(btrim(fields.raw_value), '') is not null
          and not exists (
            select 1 from public.knowledge_entity_mentions m
            where m.observation_id = o.id and m.source_field = fields.source_field
          )
      )
    order by o.id
    limit p_limit
  ), contexts as (
    select
      o.*,
      coalesce(archive_chunk.document_id, explicit_doc.id, job_doc.knowledge_document_id) resolved_document_id,
      archive_chunk.id archive_chunk_id
    from selected_observations o
    left join lateral (
      select kc.id, kc.document_id
      from public.knowledge_chunks kc
      join public.knowledge_sources s on s.id = kc.source_id
      where kc.source_locator ->> 'observation_id' = o.id::text
        and (s.access_scope = 'global' or s.organization_id = o.organization_id)
      order by kc.chunk_index
      limit 1
    ) archive_chunk on true
    left join lateral (
      select d.id
      from public.knowledge_documents d
      join public.knowledge_sources s on s.id = d.source_id
      where d.id = p_document_id
        and p_document_id is not null
        and (s.access_scope = 'global' or s.organization_id = o.organization_id)
      limit 1
    ) explicit_doc on archive_chunk.id is null
    left join lateral (
      select wj.knowledge_document_id
      from public.worker_jobs wj
      join public.knowledge_documents d on d.id = wj.knowledge_document_id
      join public.knowledge_sources s on s.id = d.source_id
      where (wj.id = o.thread_id or wj.thread_id = o.thread_id)
        and wj.organization_id = o.organization_id
        and (s.access_scope = 'global' or s.organization_id = o.organization_id)
      order by wj.created_at desc
      limit 1
    ) job_doc on archive_chunk.id is null and explicit_doc.id is null
  ), candidates as (
    select
      c.id observation_id,
      c.owner_id,
      c.organization_id,
      c.thread_id,
      c.source_text,
      c.canonical_product_id,
      least(greatest(coalesce(c.confidence, 0.5), 0), 1) source_confidence,
      c.resolved_document_id,
      c.archive_chunk_id,
      valueset.entity_type,
      valueset.source_field,
      valueset.raw_value,
      public.canonical_knowledge_entity_key(valueset.entity_type, valueset.raw_value) canonical_key
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
      coalesce(c.archive_chunk_id, matched_chunk.id) resolved_chunk_id,
      case
        when c.archive_chunk_id is not null then 'observation_locator'
        when matched_chunk.id is not null then 'exact_source_text'
        when c.resolved_document_id is not null then 'document_only'
        else 'observation_only'
      end grounding_method
    from candidates c
    left join public.knowledge_documents kd on kd.id = c.resolved_document_id
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
    g.source_confidence,
    'canonical_exact',
    'p0.7-v2',
    jsonb_build_object(
      'thread_id', g.thread_id,
      'organization_id', g.organization_id,
      'source_field', g.source_field,
      'source_observation_confidence', g.source_confidence,
      'canonical_product_id', g.canonical_product_id,
      'grounding_method', g.grounding_method,
      'resolver_contract', 'p0.7-v2'
    )
  from grounded g
  join public.knowledge_entities e
    on e.access_scope = 'global'
   and e.entity_type = g.entity_type
   and e.canonical_key = g.canonical_key
  on conflict do nothing;

  get diagnostics v_mentions = row_count;

  v_bindings := public.sync_knowledge_entity_bindings(null);

  return jsonb_build_object(
    'selected_observation_count', v_selected,
    'entities_created', v_entities,
    'aliases_upserted', v_aliases,
    'mentions_created', v_mentions,
    'bindings', v_bindings,
    'resolver_version', 'p0.7-v2',
    'canonicalization', 'p0.4-aligned',
    'automatic_merge', false
  );
end;
$$;

revoke execute on function public.resolve_commercial_entities(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.resolve_commercial_entities(uuid, uuid, integer)
  to service_role;

comment on function public.resolve_commercial_entities(uuid, uuid, integer) is
  'P0.7 v2 entity resolver: P0.4-aligned canonical keys, source confidence propagation and tenant-safe document grounding. Service-role only.';

create or replace function public.resolve_worker_job_entities_after_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = 'completed'
    and new.thread_id is not null
    and new.knowledge_document_id is not null
    and (
      old.status is distinct from new.status
      or old.thread_id is distinct from new.thread_id
      or old.knowledge_document_id is distinct from new.knowledge_document_id
    )
  then
    begin
      perform public.resolve_commercial_entities(
        new.thread_id,
        new.knowledge_document_id,
        5000
      );
    exception
      when others then
        raise warning 'P0.7 entity resolution failed for worker job %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

revoke execute on function public.resolve_worker_job_entities_after_update()
  from public, anon, authenticated;
grant execute on function public.resolve_worker_job_entities_after_update()
  to service_role;

-- Upgrade historical commercial mentions in place. The uniqueness contract does
-- not include resolver_version, so in-place versioning preserves stable mention IDs.
update public.knowledge_entity_mentions m
set confidence = least(greatest(coalesce(o.confidence, m.confidence, 0.5), 0), 1),
    resolver_method = 'canonical_exact',
    resolver_version = 'p0.7-v2',
    metadata = m.metadata || jsonb_build_object(
      'organization_id', o.organization_id,
      'source_observation_confidence', least(greatest(coalesce(o.confidence, m.confidence, 0.5), 0), 1),
      'canonical_product_id', o.canonical_product_id,
      'resolver_contract', 'p0.7-v2',
      'upgraded_from', m.resolver_version
    )
from public.commercial_observations o
where m.observation_id = o.id
  and m.source_field in ('grade', 'standard', 'product_type');

with observed_confidence as (
  select m.entity_id, m.normalized_mention, max(m.confidence) confidence
  from public.knowledge_entity_mentions m
  where m.observation_id is not null
  group by m.entity_id, m.normalized_mention
)
update public.knowledge_entity_aliases a
set confidence = o.confidence,
    metadata = a.metadata || jsonb_build_object('resolver_contract', 'p0.7-v2')
from observed_confidence o
where a.entity_id = o.entity_id
  and a.normalized_alias = o.normalized_mention
  and a.alias_type = 'observed';

update public.knowledge_entities e
set metadata = e.metadata || jsonb_build_object(
      'resolver_contract', 'p0.7-v2',
      'canonicalization', 'p0.4-aligned'
    ),
    updated_at = now()
where e.entity_type in ('grade', 'standard', 'product_family');

create or replace function public.entity_resolution_health()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with canonical_duplicates as (
  select count(*)::integer count
  from (
    select
      case when access_scope = 'global' then 'global' else organization_id::text end scope_key,
      entity_type,
      canonical_key
    from public.knowledge_entities
    group by 1,2,3
    having count(*) > 1
  ) d
), alias_collisions as (
  select count(*)::integer count
  from (
    select
      case when e.access_scope = 'global' then 'global' else e.organization_id::text end scope_key,
      e.entity_type,
      a.normalized_alias
    from public.knowledge_entity_aliases a
    join public.knowledge_entities e on e.id = a.entity_id
    group by 1,2,3
    having count(distinct a.entity_id) > 1
  ) d
), cross_tenant_groundings as (
  select count(*)::integer count
  from public.knowledge_entity_mentions m
  join public.commercial_observations o on o.id = m.observation_id
  join public.knowledge_sources s on s.id = m.source_id
  where m.source_id is not null
    and s.access_scope = 'owner'
    and s.organization_id is distinct from o.organization_id
), confidence_overclaims as (
  select count(*)::integer count
  from public.knowledge_entity_mentions m
  join public.commercial_observations o on o.id = m.observation_id
  where m.observation_id is not null
    and o.confidence is not null
    and m.confidence > o.confidence + 0.000001
), stale_mentions as (
  select count(*)::integer count
  from public.knowledge_entity_mentions m
  where m.observation_id is not null
    and m.source_field in ('grade', 'standard', 'product_type')
    and m.resolver_version <> 'p0.7-v2'
), unresolved_fields as (
  select count(*)::integer count
  from public.commercial_observations o
  cross join lateral (values
    ('grade'::text, o.grade),
    ('standard'::text, o.standard),
    ('product_type'::text, o.product_type)
  ) f(source_field, raw_value)
  where nullif(btrim(f.raw_value), '') is not null
    and not exists (
      select 1 from public.knowledge_entity_mentions m
      where m.observation_id = o.id and m.source_field = f.source_field
    )
), private_scope_errors as (
  select count(*)::integer count
  from public.knowledge_entities
  where access_scope = 'owner' and organization_id is null
), key_mismatches as (
  select count(*)::integer count
  from public.knowledge_entities e
  where e.entity_type in ('grade', 'standard', 'product_family')
    and e.canonical_key is distinct from public.canonical_knowledge_entity_key(e.entity_type, e.canonical_name)
), ungrounded_chunks as (
  select count(*)::integer count
  from public.knowledge_entity_mentions
  where observation_id is not null and chunk_id is null
), metrics as (
  select
    (select count from canonical_duplicates) canonical_duplicate_count,
    (select count from alias_collisions) alias_collision_count,
    (select count from cross_tenant_groundings) cross_tenant_grounding_count,
    (select count from confidence_overclaims) confidence_overclaim_count,
    (select count from stale_mentions) stale_resolver_mention_count,
    (select count from unresolved_fields) unresolved_field_count,
    (select count from private_scope_errors) private_scope_error_count,
    (select count from key_mismatches) canonical_key_mismatch_count,
    (select count from ungrounded_chunks) ungrounded_chunk_count
)
select jsonb_build_object(
  'resolver_version', 'p0.7-v2',
  'canonicalization', 'p0.4-aligned',
  'automatic_merge', false,
  'critical_issue_count',
    canonical_duplicate_count
    + alias_collision_count
    + cross_tenant_grounding_count
    + confidence_overclaim_count
    + stale_resolver_mention_count
    + unresolved_field_count
    + private_scope_error_count
    + canonical_key_mismatch_count,
  'canonical_duplicate_count', canonical_duplicate_count,
  'alias_collision_count', alias_collision_count,
  'cross_tenant_grounding_count', cross_tenant_grounding_count,
  'confidence_overclaim_count', confidence_overclaim_count,
  'stale_resolver_mention_count', stale_resolver_mention_count,
  'unresolved_field_count', unresolved_field_count,
  'private_scope_error_count', private_scope_error_count,
  'canonical_key_mismatch_count', canonical_key_mismatch_count,
  'ungrounded_chunk_count', ungrounded_chunk_count,
  'entity_count', (select count(*) from public.knowledge_entities),
  'alias_count', (select count(*) from public.knowledge_entity_aliases),
  'mention_count', (select count(*) from public.knowledge_entity_mentions),
  'binding_count', (select count(*) from public.knowledge_entity_bindings)
)
from metrics;
$$;

revoke execute on function public.entity_resolution_health()
  from public, anon, authenticated;
grant execute on function public.entity_resolution_health()
  to service_role;

comment on function public.entity_resolution_health() is
  'P0.7 production health contract for duplicate identity, alias ambiguity, tenant provenance, confidence propagation and resolver completeness.';
