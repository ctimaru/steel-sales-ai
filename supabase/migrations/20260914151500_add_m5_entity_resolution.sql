create or replace function public.normalize_knowledge_entity_value(p_value text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select lower(regexp_replace(btrim(p_value), '[^[:alnum:]]+', '', 'g'))
$$;

create or replace function public.canonical_knowledge_entity_name(
  p_entity_type text,
  p_value text
)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when p_entity_type = 'product_family' then
      initcap(regexp_replace(replace(btrim(p_value), '_', ' '), '\s+', ' ', 'g'))
    when p_entity_type in ('standard', 'grade', 'process') then
      upper(regexp_replace(btrim(p_value), '\s+', ' ', 'g'))
    else regexp_replace(btrim(p_value), '\s+', ' ', 'g')
  end
$$;

create table public.knowledge_entities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  access_scope text not null default 'global'
    check (access_scope in ('owner', 'global')),
  entity_type text not null
    check (entity_type in (
      'company', 'plant', 'country', 'standard', 'product_family',
      'grade', 'process', 'application'
    )),
  canonical_key text not null,
  canonical_name text not null,
  normalized_name text not null,
  country_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (access_scope = 'owner' and owner_id is not null)
    or (access_scope = 'global' and owner_id is null)
  )
);

create unique index knowledge_entities_global_key_uq
  on public.knowledge_entities (entity_type, canonical_key)
  where access_scope = 'global';

create unique index knowledge_entities_owner_key_uq
  on public.knowledge_entities (owner_id, entity_type, canonical_key)
  where access_scope = 'owner';

create index knowledge_entities_type_name_idx
  on public.knowledge_entities (entity_type, normalized_name);

create table public.knowledge_entity_aliases (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.knowledge_entities(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  language_code text,
  alias_type text not null default 'observed'
    check (alias_type in ('canonical', 'observed', 'synonym', 'abbreviation', 'code', 'manual')),
  confidence numeric not null default 1
    check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (entity_id, normalized_alias)
);

create index knowledge_entity_aliases_lookup_idx
  on public.knowledge_entity_aliases (normalized_alias, entity_id);

create table public.knowledge_entity_mentions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.knowledge_entities(id) on delete cascade,
  observation_id bigint references public.commercial_observations(id) on delete cascade,
  source_id uuid references public.knowledge_sources(id) on delete cascade,
  document_id uuid,
  chunk_id uuid,
  source_field text not null,
  mention_text text not null,
  normalized_mention text not null,
  confidence numeric not null default 1
    check (confidence >= 0 and confidence <= 1),
  resolver_method text not null default 'deterministic',
  resolver_version text not null default 'm5.4-v1',
  char_start integer check (char_start is null or char_start >= 0),
  char_end integer check (char_end is null or char_end >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (document_id, source_id)
    references public.knowledge_documents(id, source_id)
    on delete cascade,
  foreign key (chunk_id, document_id, source_id)
    references public.knowledge_chunks(id, document_id, source_id)
    on delete cascade,
  check (observation_id is not null or document_id is not null),
  check (char_end is null or char_start is null or char_end >= char_start),
  check (
    (chunk_id is null)
    or (document_id is not null and source_id is not null)
  )
);

create unique index knowledge_entity_mentions_observation_uq
  on public.knowledge_entity_mentions (
    observation_id, entity_id, source_field, normalized_mention
  )
  where observation_id is not null;

create unique index knowledge_entity_mentions_chunk_uq
  on public.knowledge_entity_mentions (
    chunk_id, entity_id, source_field, normalized_mention
  )
  where chunk_id is not null;

create index knowledge_entity_mentions_entity_idx
  on public.knowledge_entity_mentions (entity_id, created_at desc);

create index knowledge_entity_mentions_observation_idx
  on public.knowledge_entity_mentions (observation_id)
  where observation_id is not null;

create index knowledge_entity_mentions_chunk_idx
  on public.knowledge_entity_mentions (chunk_id)
  where chunk_id is not null;

create table public.knowledge_entity_bindings (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.knowledge_entities(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  binding_field text not null,
  binding_method text not null default 'normalized_exact',
  confidence numeric not null default 1
    check (confidence >= 0 and confidence <= 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((company_id is not null)::integer + (product_id is not null)::integer = 1)
);

create unique index knowledge_entity_bindings_company_uq
  on public.knowledge_entity_bindings (entity_id, company_id, binding_field)
  where company_id is not null;

create unique index knowledge_entity_bindings_product_uq
  on public.knowledge_entity_bindings (entity_id, product_id, binding_field)
  where product_id is not null;

create index knowledge_entity_bindings_owner_idx
  on public.knowledge_entity_bindings (owner_id, entity_id);

comment on table public.knowledge_entities is
  'Canonical entity catalog for M5.4 entity resolution across private and global knowledge.';
comment on table public.knowledge_entity_aliases is
  'Observed and curated aliases that resolve to canonical knowledge entities.';
comment on table public.knowledge_entity_mentions is
  'Resolved entity mentions grounded in commercial observations and, when available, knowledge documents/chunks.';
comment on table public.knowledge_entity_bindings is
  'Bridge from canonical knowledge entities to owner-scoped companies and products.';

alter table public.knowledge_entities enable row level security;
alter table public.knowledge_entity_aliases enable row level security;
alter table public.knowledge_entity_mentions enable row level security;
alter table public.knowledge_entity_bindings enable row level security;

revoke all on table public.knowledge_entities from public, anon, authenticated;
revoke all on table public.knowledge_entity_aliases from public, anon, authenticated;
revoke all on table public.knowledge_entity_mentions from public, anon, authenticated;
revoke all on table public.knowledge_entity_bindings from public, anon, authenticated;

grant select on table public.knowledge_entities to authenticated;
grant select on table public.knowledge_entity_aliases to authenticated;
grant select on table public.knowledge_entity_mentions to authenticated;
grant select on table public.knowledge_entity_bindings to authenticated;

grant select, insert, update, delete on table public.knowledge_entities to service_role;
grant select, insert, update, delete on table public.knowledge_entity_aliases to service_role;
grant select, insert, update, delete on table public.knowledge_entity_mentions to service_role;
grant select, insert, update, delete on table public.knowledge_entity_bindings to service_role;

create policy knowledge_entities_read_visible
  on public.knowledge_entities
  for select
  to authenticated
  using (
    access_scope = 'global'
    or owner_id = (select auth.uid())
  );

create policy knowledge_entity_aliases_read_visible
  on public.knowledge_entity_aliases
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.knowledge_entities e
      where e.id = knowledge_entity_aliases.entity_id
        and (e.access_scope = 'global' or e.owner_id = (select auth.uid()))
    )
  );

create policy knowledge_entity_mentions_read_visible
  on public.knowledge_entity_mentions
  for select
  to authenticated
  using (
    (
      source_id is not null
      and exists (
        select 1
        from public.knowledge_sources s
        where s.id = knowledge_entity_mentions.source_id
          and (s.access_scope = 'global' or s.owner_id = (select auth.uid()))
      )
    )
    or (
      observation_id is not null
      and exists (
        select 1
        from public.commercial_observations o
        where o.id = knowledge_entity_mentions.observation_id
          and o.owner_id = (select auth.uid())
      )
    )
  );

create policy knowledge_entity_bindings_read_owner
  on public.knowledge_entity_bindings
  for select
  to authenticated
  using (owner_id = (select auth.uid()));

create or replace function public.resolve_knowledge_entity(
  p_entity_type text,
  p_raw_value text,
  p_access_scope text default 'global',
  p_owner_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text;
  v_name text;
  v_entity_id uuid;
begin
  if p_entity_type not in (
    'company', 'plant', 'country', 'standard', 'product_family',
    'grade', 'process', 'application'
  ) then
    raise exception 'Unsupported entity type: %', p_entity_type;
  end if;

  if p_access_scope not in ('owner', 'global') then
    raise exception 'Unsupported access scope: %', p_access_scope;
  end if;

  if p_access_scope = 'owner' and p_owner_id is null then
    raise exception 'owner scope requires p_owner_id';
  end if;

  if p_access_scope = 'global' then
    p_owner_id := null;
  end if;

  v_key := public.normalize_knowledge_entity_value(p_raw_value);
  if v_key = '' then
    raise exception 'Entity value cannot normalize to an empty key';
  end if;
  v_name := public.canonical_knowledge_entity_name(p_entity_type, p_raw_value);

  insert into public.knowledge_entities (
    owner_id, access_scope, entity_type, canonical_key,
    canonical_name, normalized_name, metadata
  ) values (
    p_owner_id, p_access_scope, p_entity_type, v_key,
    v_name, v_key, coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict do nothing;

  if p_access_scope = 'global' then
    select e.id into v_entity_id
    from public.knowledge_entities e
    where e.access_scope = 'global'
      and e.entity_type = p_entity_type
      and e.canonical_key = v_key;
  else
    select e.id into v_entity_id
    from public.knowledge_entities e
    where e.access_scope = 'owner'
      and e.owner_id = p_owner_id
      and e.entity_type = p_entity_type
      and e.canonical_key = v_key;
  end if;

  insert into public.knowledge_entity_aliases (
    entity_id, alias, normalized_alias, alias_type, metadata
  ) values (
    v_entity_id, p_raw_value, v_key, 'observed', coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (entity_id, normalized_alias) do nothing;

  return v_entity_id;
end;
$$;

create or replace function public.sync_knowledge_entity_bindings(
  p_owner_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_bindings integer := 0;
  v_product_bindings integer := 0;
begin
  insert into public.knowledge_entity_bindings (
    entity_id, owner_id, company_id, binding_field,
    binding_method, confidence, metadata
  )
  select
    e.id,
    c.owner_id,
    c.id,
    'company.name',
    'normalized_exact',
    1,
    jsonb_build_object('source', 'companies')
  from public.knowledge_entities e
  join public.companies c
    on e.entity_type = 'company'
   and public.normalize_knowledge_entity_value(c.name) = e.normalized_name
   and (e.access_scope = 'global' or e.owner_id = c.owner_id)
  where p_owner_id is null or c.owner_id = p_owner_id
  on conflict do nothing;

  get diagnostics v_company_bindings = row_count;

  insert into public.knowledge_entity_bindings (
    entity_id, owner_id, product_id, binding_field,
    binding_method, confidence, metadata
  )
  select
    e.id,
    p.owner_id,
    p.id,
    matched.binding_field,
    'normalized_exact',
    1,
    jsonb_build_object('source', 'products')
  from public.knowledge_entities e
  join public.products p
    on p_owner_id is null or p.owner_id = p_owner_id
  cross join lateral (
    select case
      when e.entity_type = 'grade'
        and p.grade is not null
        and public.normalize_knowledge_entity_value(p.grade) = e.normalized_name
        then 'product.grade'
      when e.entity_type = 'standard'
        and p.standard is not null
        and public.normalize_knowledge_entity_value(p.standard) = e.normalized_name
        then 'product.standard'
      when e.entity_type = 'product_family'
        and p.product_type is not null
        and public.normalize_knowledge_entity_value(p.product_type) = e.normalized_name
        then 'product.product_type'
      when e.entity_type = 'process'
        and p.manufacturing_process is not null
        and public.normalize_knowledge_entity_value(p.manufacturing_process) = e.normalized_name
        then 'product.manufacturing_process'
      else null
    end as binding_field
  ) matched
  where matched.binding_field is not null
    and (e.access_scope = 'global' or e.owner_id = p.owner_id)
  on conflict do nothing;

  get diagnostics v_product_bindings = row_count;

  return jsonb_build_object(
    'company_bindings_created', v_company_bindings,
    'product_bindings_created', v_product_bindings
  );
end;
$$;

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
    null,
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
      coalesce(
        c.archive_chunk_id,
        matched_chunk.id
      ) as resolved_chunk_id
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

revoke execute on function public.normalize_knowledge_entity_value(text) from public, anon;
revoke execute on function public.canonical_knowledge_entity_name(text, text) from public, anon;
grant execute on function public.normalize_knowledge_entity_value(text) to authenticated, service_role;
grant execute on function public.canonical_knowledge_entity_name(text, text) to authenticated, service_role;

revoke execute on function public.resolve_knowledge_entity(text, text, text, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.sync_knowledge_entity_bindings(uuid) from public, anon, authenticated;
revoke execute on function public.resolve_commercial_entities(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.resolve_knowledge_entity(text, text, text, uuid, jsonb) to service_role;
grant execute on function public.sync_knowledge_entity_bindings(uuid) to service_role;
grant execute on function public.resolve_commercial_entities(uuid, uuid, integer) to service_role;
