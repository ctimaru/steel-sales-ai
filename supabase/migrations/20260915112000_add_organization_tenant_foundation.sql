-- P0.2 — Organization-level SaaS tenant foundation.
--
-- This migration intentionally keeps owner_id for backwards compatibility and
-- provenance, while organization_id becomes the authorization boundary.

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member', 'viewer')),
  status text not null default 'active' check (status in ('active', 'invited', 'suspended')),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_memberships_user_idx
  on public.organization_memberships (user_id, status, is_default desc);

create unique index if not exists organization_memberships_one_default_per_user_uq
  on public.organization_memberships (user_id)
  where is_default and status = 'active';

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;

revoke all on public.organizations from anon;
revoke all on public.organization_memberships from anon;
revoke insert, update, delete on public.organizations from authenticated;
revoke insert, update, delete on public.organization_memberships from authenticated;
grant select on public.organizations to authenticated;
grant select on public.organization_memberships to authenticated;

create or replace function public.is_organization_member(
  target_organization_id uuid,
  require_write boolean default false
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = target_organization_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and (not require_write or m.role in ('admin', 'member'))
  );
$$;

revoke execute on function public.is_organization_member(uuid, boolean) from public;
revoke execute on function public.is_organization_member(uuid, boolean) from anon;
grant execute on function public.is_organization_member(uuid, boolean) to authenticated;
grant execute on function public.is_organization_member(uuid, boolean) to service_role;

create or replace function public.default_organization_for_user(target_user_id uuid)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select m.organization_id
  from public.organization_memberships m
  where m.user_id = target_user_id
    and m.status = 'active'
  order by m.is_default desc, m.created_at asc, m.organization_id
  limit 1;
$$;

revoke execute on function public.default_organization_for_user(uuid) from public;
revoke execute on function public.default_organization_for_user(uuid) from anon;
grant execute on function public.default_organization_for_user(uuid) to authenticated;
grant execute on function public.default_organization_for_user(uuid) to service_role;

-- A user can inspect their own memberships. This deliberately does not permit
-- client-side membership administration yet; P1 owns organization invitations.
drop policy if exists organization_memberships_self_select on public.organization_memberships;
create policy organization_memberships_self_select
on public.organization_memberships
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists organizations_member_select on public.organizations;
create policy organizations_member_select
on public.organizations
for select
to authenticated
using (public.is_organization_member(id, false));

-- Bootstrap one deterministic default organization for every existing auth user.
-- The UUID is stable across repeated migration/test runs.
insert into public.organizations (id, name, slug, created_by)
select
  md5(u.id::text || ':steel-sales-ai:default-organization')::uuid,
  'Steel Sales AI workspace ' || left(u.id::text, 8),
  'workspace-' || left(replace(u.id::text, '-', ''), 16),
  u.id
from auth.users u
on conflict (id) do nothing;

insert into public.organization_memberships (
  organization_id, user_id, role, status, is_default
)
select
  md5(u.id::text || ':steel-sales-ai:default-organization')::uuid,
  u.id,
  'admin',
  'active',
  true
from auth.users u
on conflict (organization_id, user_id) do update
set
  status = 'active',
  role = case
    when public.organization_memberships.role = 'viewer' then 'admin'
    else public.organization_memberships.role
  end,
  is_default = true,
  updated_at = now();

-- Add organization_id to every tenant-owned table while keeping owner_id.
do $$
declare
  table_name text;
  tenant_tables text[] := array[
    'availability', 'certificates', 'commercial_datasets',
    'commercial_observations', 'commercial_review_queue', 'commercial_threads',
    'companies', 'contacts', 'conversations', 'deliveries', 'documents',
    'extracted_fields', 'knowledge_entities', 'knowledge_entity_bindings',
    'knowledge_sources', 'messages', 'offer_lines', 'offers', 'order_lines',
    'orders', 'price_history', 'products', 'rfq_lines', 'rfqs', 'worker_jobs'
  ];
begin
  foreach table_name in array tenant_tables loop
    execute format(
      'alter table public.%I add column if not exists organization_id uuid references public.organizations(id) on delete restrict',
      table_name
    );
    execute format(
      'create index if not exists %I on public.%I (organization_id)',
      table_name || '_organization_id_idx',
      table_name
    );
  end loop;
end $$;

-- Backfill existing private rows from their legacy owner.
do $$
declare
  table_name text;
  tenant_tables text[] := array[
    'availability', 'certificates', 'commercial_datasets',
    'commercial_observations', 'commercial_review_queue', 'commercial_threads',
    'companies', 'contacts', 'conversations', 'deliveries', 'documents',
    'extracted_fields', 'knowledge_entities', 'knowledge_entity_bindings',
    'knowledge_sources', 'messages', 'offer_lines', 'offers', 'order_lines',
    'orders', 'price_history', 'products', 'rfq_lines', 'rfqs', 'worker_jobs'
  ];
begin
  foreach table_name in array tenant_tables loop
    execute format(
      'update public.%I set organization_id = public.default_organization_for_user(owner_id) where organization_id is null and owner_id is not null',
      table_name
    );
  end loop;
end $$;

-- Prevent future owner-scoped rows from being created without a tenant.
create or replace function public.assign_organization_from_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  resolved_organization_id uuid;
begin
  if new.owner_id is null then
    return new;
  end if;

  resolved_organization_id := public.default_organization_for_user(new.owner_id);
  if resolved_organization_id is null then
    raise exception 'No active organization membership for owner %', new.owner_id;
  end if;

  if new.organization_id is null then
    new.organization_id := resolved_organization_id;
  elsif not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = new.organization_id
      and m.user_id = new.owner_id
      and m.status = 'active'
  ) then
    raise exception 'Owner % is not an active member of organization %', new.owner_id, new.organization_id;
  end if;

  return new;
end;
$$;

revoke execute on function public.assign_organization_from_owner() from public;
revoke execute on function public.assign_organization_from_owner() from anon;
grant execute on function public.assign_organization_from_owner() to authenticated;
grant execute on function public.assign_organization_from_owner() to service_role;

do $$
declare
  table_name text;
  tenant_tables text[] := array[
    'availability', 'certificates', 'commercial_datasets',
    'commercial_observations', 'commercial_review_queue', 'commercial_threads',
    'companies', 'contacts', 'conversations', 'deliveries', 'documents',
    'extracted_fields', 'knowledge_entities', 'knowledge_entity_bindings',
    'knowledge_sources', 'messages', 'offer_lines', 'offers', 'order_lines',
    'orders', 'price_history', 'products', 'rfq_lines', 'rfqs', 'worker_jobs'
  ];
begin
  foreach table_name in array tenant_tables loop
    execute format('drop trigger if exists assign_organization_from_owner on public.%I', table_name);
    execute format(
      'create trigger assign_organization_from_owner before insert or update of owner_id, organization_id on public.%I for each row execute function public.assign_organization_from_owner()',
      table_name
    );
  end loop;
end $$;

-- Explicit integrity guard: any row that still has an owner must also have an organization.
do $$
declare
  table_name text;
  tenant_tables text[] := array[
    'availability', 'certificates', 'commercial_datasets',
    'commercial_observations', 'commercial_review_queue', 'commercial_threads',
    'companies', 'contacts', 'conversations', 'deliveries', 'documents',
    'extracted_fields', 'knowledge_entities', 'knowledge_entity_bindings',
    'knowledge_sources', 'messages', 'offer_lines', 'offers', 'order_lines',
    'orders', 'price_history', 'products', 'rfq_lines', 'rfqs', 'worker_jobs'
  ];
begin
  foreach table_name in array tenant_tables loop
    if not exists (
      select 1 from pg_constraint
      where conrelid = format('public.%I', table_name)::regclass
        and conname = table_name || '_owner_requires_organization'
    ) then
      execute format(
        'alter table public.%I add constraint %I check (owner_id is null or organization_id is not null)',
        table_name,
        table_name || '_owner_requires_organization'
      );
    end if;
  end loop;
end $$;

-- Replace user-owner RLS with organization membership for tenant-facing tables.
do $$
declare
  table_name text;
  rw_tables text[] := array[
    'availability', 'certificates', 'companies', 'contacts', 'conversations',
    'deliveries', 'documents', 'extracted_fields', 'messages', 'offer_lines',
    'offers', 'order_lines', 'orders', 'price_history', 'products', 'rfq_lines', 'rfqs'
  ];
begin
  foreach table_name in array rw_tables loop
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_all', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_organization_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_organization_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_organization_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_organization_delete', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using (public.is_organization_member(organization_id, false))',
      table_name || '_organization_select', table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner_id = (select auth.uid()) and public.is_organization_member(organization_id, true))',
      table_name || '_organization_insert', table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.is_organization_member(organization_id, true)) with check (public.is_organization_member(organization_id, true))',
      table_name || '_organization_update', table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.is_organization_member(organization_id, true))',
      table_name || '_organization_delete', table_name
    );
  end loop;
end $$;

-- App-facing read models are service-populated and client-readable per organization.
drop policy if exists commercial_datasets_owner_select on public.commercial_datasets;
drop policy if exists commercial_datasets_organization_select on public.commercial_datasets;
create policy commercial_datasets_organization_select
on public.commercial_datasets
for select to authenticated
using (public.is_organization_member(organization_id, false));

drop policy if exists commercial_observations_owner_select on public.commercial_observations;
drop policy if exists commercial_observations_organization_select on public.commercial_observations;
create policy commercial_observations_organization_select
on public.commercial_observations
for select to authenticated
using (public.is_organization_member(organization_id, false));

drop policy if exists commercial_threads_owner_select on public.commercial_threads;
drop policy if exists commercial_threads_organization_select on public.commercial_threads;
create policy commercial_threads_organization_select
on public.commercial_threads
for select to authenticated
using (public.is_organization_member(organization_id, false));

drop policy if exists commercial_review_queue_owner_select on public.commercial_review_queue;
drop policy if exists commercial_review_queue_owner_update on public.commercial_review_queue;
drop policy if exists commercial_review_queue_organization_select on public.commercial_review_queue;
drop policy if exists commercial_review_queue_organization_update on public.commercial_review_queue;
create policy commercial_review_queue_organization_select
on public.commercial_review_queue
for select to authenticated
using (public.is_organization_member(organization_id, false));
create policy commercial_review_queue_organization_update
on public.commercial_review_queue
for update to authenticated
using (public.is_organization_member(organization_id, true))
with check (public.is_organization_member(organization_id, true));

-- Knowledge visibility: global facts remain global, private knowledge follows the organization.
drop policy if exists knowledge_sources_read_visible on public.knowledge_sources;
create policy knowledge_sources_read_visible
on public.knowledge_sources
for select to authenticated
using (
  access_scope = 'global'
  or public.is_organization_member(organization_id, false)
);

drop policy if exists knowledge_entities_read_visible on public.knowledge_entities;
create policy knowledge_entities_read_visible
on public.knowledge_entities
for select to authenticated
using (
  access_scope = 'global'
  or public.is_organization_member(organization_id, false)
);

drop policy if exists knowledge_entity_bindings_read_owner on public.knowledge_entity_bindings;
create policy knowledge_entity_bindings_read_organization
on public.knowledge_entity_bindings
for select to authenticated
using (public.is_organization_member(organization_id, false));

drop policy if exists knowledge_documents_read_visible on public.knowledge_documents;
create policy knowledge_documents_read_visible
on public.knowledge_documents
for select to authenticated
using (
  exists (
    select 1 from public.knowledge_sources s
    where s.id = knowledge_documents.source_id
      and (s.access_scope = 'global' or public.is_organization_member(s.organization_id, false))
  )
);

drop policy if exists knowledge_chunks_read_visible on public.knowledge_chunks;
create policy knowledge_chunks_read_visible
on public.knowledge_chunks
for select to authenticated
using (
  exists (
    select 1 from public.knowledge_sources s
    where s.id = knowledge_chunks.source_id
      and (s.access_scope = 'global' or public.is_organization_member(s.organization_id, false))
  )
);

drop policy if exists knowledge_evidence_read_visible on public.knowledge_evidence;
create policy knowledge_evidence_read_visible
on public.knowledge_evidence
for select to authenticated
using (
  exists (
    select 1 from public.knowledge_sources s
    where s.id = knowledge_evidence.source_id
      and (s.access_scope = 'global' or public.is_organization_member(s.organization_id, false))
  )
);

drop policy if exists knowledge_entity_aliases_read_visible on public.knowledge_entity_aliases;
create policy knowledge_entity_aliases_read_visible
on public.knowledge_entity_aliases
for select to authenticated
using (
  exists (
    select 1 from public.knowledge_entities e
    where e.id = knowledge_entity_aliases.entity_id
      and (e.access_scope = 'global' or public.is_organization_member(e.organization_id, false))
  )
);

drop policy if exists knowledge_entity_mentions_read_visible on public.knowledge_entity_mentions;
create policy knowledge_entity_mentions_read_visible
on public.knowledge_entity_mentions
for select to authenticated
using (
  (
    source_id is not null
    and exists (
      select 1 from public.knowledge_sources s
      where s.id = knowledge_entity_mentions.source_id
        and (s.access_scope = 'global' or public.is_organization_member(s.organization_id, false))
    )
  )
  or (
    observation_id is not null
    and exists (
      select 1 from public.commercial_observations o
      where o.id = knowledge_entity_mentions.observation_id
        and public.is_organization_member(o.organization_id, false)
    )
  )
);

-- Keep worker/evaluation persistence service-only. Make market-table intent explicit.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['market_sources','market_observations','market_sync_runs'] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_no_browser_access', table_name);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (false) with check (false)',
      table_name || '_no_browser_access', table_name
    );
  end loop;
end $$;

-- Tenant-aware dashboard while preserving the existing RPC signature used by the web app.
create or replace function public.commercial_dashboard_metrics()
returns table(
  dataset_id uuid,
  emails bigint,
  threads bigint,
  messages bigint,
  observations bigint,
  requested bigint,
  offered bigint,
  ordered bigint,
  delivered bigint,
  review_pending bigint,
  avg_confidence numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  with tenant as (
    select public.default_organization_for_user((select auth.uid())) as organization_id
  ), latest_dataset as (
    select d.*
    from public.commercial_datasets d
    cross join tenant t
    where d.organization_id = t.organization_id
      and d.status in ('ready','active')
    order by (d.status = 'active') desc, d.created_at desc
    limit 1
  )
  select
    d.id,
    d.email_count::bigint,
    d.thread_count::bigint,
    d.message_count::bigint,
    d.extraction_count::bigint,
    count(o.id) filter (where o.item_role='requested')::bigint,
    count(o.id) filter (where o.item_role='offered')::bigint,
    count(o.id) filter (where o.item_role='ordered')::bigint,
    count(o.id) filter (where o.item_role='delivered')::bigint,
    (
      select count(*)
      from public.commercial_review_queue r
      where r.dataset_id = d.id
        and r.organization_id = d.organization_id
        and r.status = 'pending'
    )::bigint,
    round(avg(o.confidence), 3)
  from latest_dataset d
  left join public.commercial_observations o
    on o.dataset_id = d.id
   and o.organization_id = d.organization_id
  group by d.id,d.email_count,d.thread_count,d.message_count,d.extraction_count,d.organization_id;
$$;

-- Compatibility RPCs: signatures remain owner-based for the current worker, but
-- the supplied authenticated user is resolved to their default organization.
create or replace function public.latest_offered_price_for_owner(
  target_owner_id uuid,
  target_grade text default null,
  target_outer_diameter_mm numeric default null,
  target_thickness_mm numeric default null,
  target_width_mm numeric default null,
  target_height_mm numeric default null
)
returns table (
  id bigint, owner_id uuid, thread_id uuid, grade text, standard text,
  outer_diameter_mm numeric, width_mm numeric, height_mm numeric,
  thickness_mm numeric, length_mm numeric, quantity numeric,
  quantity_unit text, price_value numeric, price_unit text, currency text,
  source_text text, source_filename text, confidence numeric,
  commercial_at timestamptz, thread_subject text
)
language sql
security invoker
set search_path = ''
as $$
  with tenant as (
    select public.default_organization_for_user(target_owner_id) as organization_id
  )
  select
    o.id, o.owner_id, o.thread_id, o.grade, o.standard,
    o.outer_diameter_mm, o.width_mm, o.height_mm, o.thickness_mm,
    o.length_mm, o.quantity, o.quantity_unit, o.price_value,
    o.price_unit, o.currency, o.source_text, o.source_filename,
    o.confidence, t.last_activity_at, t.subject
  from public.commercial_observations o
  join public.commercial_threads t
    on t.id = o.thread_id and t.organization_id = o.organization_id
  cross join tenant x
  where o.organization_id = x.organization_id
    and o.item_role = 'offered'
    and o.price_value is not null
    and (target_grade is null or upper(o.grade) = upper(target_grade))
    and (target_outer_diameter_mm is null or o.outer_diameter_mm = target_outer_diameter_mm)
    and (target_thickness_mm is null or o.thickness_mm = target_thickness_mm)
    and (target_width_mm is null or o.width_mm = target_width_mm)
    and (target_height_mm is null or o.height_mm = target_height_mm)
  order by t.last_activity_at desc nulls last, o.id desc
  limit 1;
$$;

create or replace function public.offered_price_history_for_owner(
  target_owner_id uuid,
  target_grade text default null,
  target_outer_diameter_mm numeric default null,
  target_thickness_mm numeric default null,
  target_width_mm numeric default null,
  target_height_mm numeric default null,
  target_limit integer default 50
)
returns table (
  id bigint, owner_id uuid, thread_id uuid, grade text, standard text,
  outer_diameter_mm numeric, width_mm numeric, height_mm numeric,
  thickness_mm numeric, length_mm numeric, quantity numeric,
  quantity_unit text, price_value numeric, price_unit text, currency text,
  source_text text, source_filename text, confidence numeric,
  commercial_at timestamptz, thread_subject text
)
language sql
security invoker
set search_path = ''
as $$
  with tenant as (
    select public.default_organization_for_user(target_owner_id) as organization_id
  )
  select
    o.id, o.owner_id, o.thread_id, o.grade, o.standard,
    o.outer_diameter_mm, o.width_mm, o.height_mm, o.thickness_mm,
    o.length_mm, o.quantity, o.quantity_unit, o.price_value,
    o.price_unit, o.currency, o.source_text, o.source_filename,
    o.confidence, t.last_activity_at, t.subject
  from public.commercial_observations o
  join public.commercial_threads t
    on t.id = o.thread_id and t.organization_id = o.organization_id
  cross join tenant x
  where o.organization_id = x.organization_id
    and o.item_role = 'offered'
    and o.price_value is not null
    and (target_grade is null or upper(o.grade) = upper(target_grade))
    and (target_outer_diameter_mm is null or o.outer_diameter_mm = target_outer_diameter_mm)
    and (target_thickness_mm is null or o.thickness_mm = target_thickness_mm)
    and (target_width_mm is null or o.width_mm = target_width_mm)
    and (target_height_mm is null or o.height_mm = target_height_mm)
  order by t.last_activity_at desc nulls last, o.id desc
  limit least(greatest(coalesce(target_limit, 50), 1), 200);
$$;

create or replace function public.offers_without_order_for_owner(
  target_owner_id uuid,
  target_grade text default null,
  target_since timestamptz default null,
  target_limit integer default 100
)
returns table (
  id bigint, owner_id uuid, thread_id uuid, grade text, standard text,
  outer_diameter_mm numeric, width_mm numeric, height_mm numeric,
  thickness_mm numeric, length_mm numeric, quantity numeric,
  quantity_unit text, price_value numeric, price_unit text, currency text,
  source_text text, source_filename text, confidence numeric,
  offered_at timestamptz, thread_subject text
)
language sql
security invoker
set search_path = ''
as $$
  with tenant as (
    select public.default_organization_for_user(target_owner_id) as organization_id
  )
  select
    o.id, o.owner_id, o.thread_id, o.grade, o.standard,
    o.outer_diameter_mm, o.width_mm, o.height_mm, o.thickness_mm,
    o.length_mm, o.quantity, o.quantity_unit, o.price_value,
    o.price_unit, o.currency, o.source_text, o.source_filename,
    o.confidence, t.last_activity_at, t.subject
  from public.commercial_observations o
  join public.commercial_threads t
    on t.id = o.thread_id and t.organization_id = o.organization_id
  cross join tenant x
  where o.organization_id = x.organization_id
    and o.item_role = 'offered'
    and (target_grade is null or upper(o.grade) = upper(target_grade))
    and (target_since is null or t.last_activity_at >= target_since)
    and not exists (
      select 1
      from public.commercial_observations ord
      where ord.organization_id = o.organization_id
        and ord.thread_id = o.thread_id
        and ord.item_role = 'ordered'
    )
  order by t.last_activity_at desc nulls last, o.id desc
  limit least(greatest(coalesce(target_limit, 100), 1), 200);
$$;

create or replace function public.commercial_observation_search_for_owner(
  target_owner_id uuid,
  target_role text default null,
  target_grade text default null,
  target_outer_diameter_mm numeric default null,
  target_min_outer_diameter_mm numeric default null,
  target_max_outer_diameter_mm numeric default null,
  target_thickness_mm numeric default null,
  target_width_mm numeric default null,
  target_height_mm numeric default null,
  target_since timestamptz default null,
  target_limit integer default 100
)
returns table (
  id bigint, owner_id uuid, thread_id uuid, item_role text, grade text,
  standard text, outer_diameter_mm numeric, width_mm numeric,
  height_mm numeric, thickness_mm numeric, length_mm numeric,
  quantity numeric, quantity_unit text, price_value numeric,
  price_unit text, currency text, source_text text, source_filename text,
  confidence numeric, commercial_at timestamptz, thread_subject text
)
language sql
security invoker
set search_path = ''
as $$
  with tenant as (
    select public.default_organization_for_user(target_owner_id) as organization_id
  )
  select
    o.id, o.owner_id, o.thread_id, o.item_role, o.grade, o.standard,
    o.outer_diameter_mm, o.width_mm, o.height_mm, o.thickness_mm,
    o.length_mm, o.quantity, o.quantity_unit, o.price_value,
    o.price_unit, o.currency, o.source_text, o.source_filename,
    o.confidence, t.last_activity_at, t.subject
  from public.commercial_observations o
  join public.commercial_threads t
    on t.id = o.thread_id and t.organization_id = o.organization_id
  cross join tenant x
  where o.organization_id = x.organization_id
    and (target_role is null or o.item_role = target_role)
    and (target_grade is null or upper(o.grade) = upper(target_grade))
    and (target_outer_diameter_mm is null or o.outer_diameter_mm = target_outer_diameter_mm)
    and (target_min_outer_diameter_mm is null or o.outer_diameter_mm >= target_min_outer_diameter_mm)
    and (target_max_outer_diameter_mm is null or o.outer_diameter_mm <= target_max_outer_diameter_mm)
    and (target_thickness_mm is null or o.thickness_mm = target_thickness_mm)
    and (target_width_mm is null or o.width_mm = target_width_mm)
    and (target_height_mm is null or o.height_mm = target_height_mm)
    and (target_since is null or t.last_activity_at >= target_since)
  order by t.last_activity_at desc nulls last, o.id desc
  limit least(greatest(coalesce(target_limit, 100), 1), 200);
$$;

-- Preserve the existing service-role-only execution boundary for compatibility RPCs.
revoke execute on function public.latest_offered_price_for_owner(uuid, text, numeric, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.latest_offered_price_for_owner(uuid, text, numeric, numeric, numeric, numeric) to service_role;
revoke execute on function public.offered_price_history_for_owner(uuid, text, numeric, numeric, numeric, numeric, integer) from public, anon, authenticated;
grant execute on function public.offered_price_history_for_owner(uuid, text, numeric, numeric, numeric, numeric, integer) to service_role;
revoke execute on function public.offers_without_order_for_owner(uuid, text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.offers_without_order_for_owner(uuid, text, timestamptz, integer) to service_role;
revoke execute on function public.commercial_observation_search_for_owner(uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.commercial_observation_search_for_owner(uuid, text, text, numeric, numeric, numeric, numeric, numeric, numeric, timestamptz, integer) to service_role;

-- P0 performance hygiene surfaced by the Supabase advisor.
create index if not exists worker_jobs_dataset_id_idx on public.worker_jobs(dataset_id);
create index if not exists worker_jobs_owner_id_idx on public.worker_jobs(owner_id);
create index if not exists worker_jobs_thread_id_idx on public.worker_jobs(thread_id);
create index if not exists parser_regression_results_run_id_idx on staging.parser_regression_results(run_id);

-- Migration guard: no owner-scoped row may remain without an organization.
do $$
declare
  table_name text;
  orphan_count bigint;
  tenant_tables text[] := array[
    'availability', 'certificates', 'commercial_datasets',
    'commercial_observations', 'commercial_review_queue', 'commercial_threads',
    'companies', 'contacts', 'conversations', 'deliveries', 'documents',
    'extracted_fields', 'knowledge_entities', 'knowledge_entity_bindings',
    'knowledge_sources', 'messages', 'offer_lines', 'offers', 'order_lines',
    'orders', 'price_history', 'products', 'rfq_lines', 'rfqs', 'worker_jobs'
  ];
begin
  foreach table_name in array tenant_tables loop
    execute format(
      'select count(*) from public.%I where owner_id is not null and organization_id is null',
      table_name
    ) into orphan_count;
    if orphan_count > 0 then
      raise exception 'Tenant backfill failed for public.%: % owner rows have no organization', table_name, orphan_count;
    end if;
  end loop;
end $$;