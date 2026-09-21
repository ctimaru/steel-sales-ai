-- PA2.2e — immutable commercial entity promotion ledger.
-- Bridges append-only extraction evidence to normalized business entities.
-- No bulk backfill or automatic promotion is introduced here.

create table if not exists public.commercial_entity_promotions (
  id bigint generated always as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  observation_id bigint not null
    references public.commercial_observations(id) on delete restrict,
  entity_type text not null,
  entity_id uuid not null,
  field_scope text,
  promotion_action text not null,
  status text not null default 'applied',
  confidence numeric,
  basis text,
  promoted_by uuid not null
    references auth.users(id) on delete restrict,
  promoted_at timestamptz not null default now(),
  source_review_id bigint
    references public.commercial_review_queue(id) on delete set null,
  supersedes_promotion_id bigint
    references public.commercial_entity_promotions(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint commercial_entity_promotions_entity_type_check
    check (entity_type in (
      'rfq','rfq_line','offer','offer_line','order','order_line',
      'company','contact','product'
    )),
  constraint commercial_entity_promotions_action_check
    check (promotion_action in ('created','linked','updated','rejected','superseded')),
  constraint commercial_entity_promotions_status_check
    check (status in ('applied','rejected','superseded')),
  constraint commercial_entity_promotions_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 1)),
  constraint commercial_entity_promotions_action_status_check
    check (
      (promotion_action in ('created','linked','updated') and status = 'applied')
      or (promotion_action = 'rejected' and status = 'rejected')
      or (promotion_action = 'superseded' and status = 'superseded')
    ),
  constraint commercial_entity_promotions_supersedes_check
    check (
      (promotion_action = 'superseded' and supersedes_promotion_id is not null)
      or promotion_action <> 'superseded'
    ),
  constraint commercial_entity_promotions_not_self_supersede
    check (supersedes_promotion_id is null or supersedes_promotion_id <> id)
);

comment on table public.commercial_entity_promotions is
  'Append-only audit ledger linking commercial extraction evidence to normalized business entities.';

create index if not exists commercial_entity_promotions_org_observation_idx
  on public.commercial_entity_promotions (organization_id, observation_id);

create index if not exists commercial_entity_promotions_org_entity_idx
  on public.commercial_entity_promotions (organization_id, entity_type, entity_id);

create index if not exists commercial_entity_promotions_source_review_idx
  on public.commercial_entity_promotions (source_review_id)
  where source_review_id is not null;

create index if not exists commercial_entity_promotions_supersedes_idx
  on public.commercial_entity_promotions (supersedes_promotion_id)
  where supersedes_promotion_id is not null;

create unique index if not exists commercial_entity_promotions_idempotency_uq
  on public.commercial_entity_promotions (
    organization_id,
    observation_id,
    entity_type,
    entity_id,
    coalesce(field_scope, ''),
    promotion_action,
    coalesce(source_review_id, -1::bigint)
  );

alter table public.commercial_entity_promotions enable row level security;

drop policy if exists commercial_entity_promotions_select_member
  on public.commercial_entity_promotions;
create policy commercial_entity_promotions_select_member
on public.commercial_entity_promotions
for select
to authenticated
using (public.is_organization_member(organization_id, false));

-- Browser roles may read tenant-scoped rows but cannot mutate the ledger directly.
revoke insert, update, delete, truncate
  on public.commercial_entity_promotions
  from anon, authenticated;

grant select on public.commercial_entity_promotions to authenticated;
revoke all on sequence public.commercial_entity_promotions_id_seq from anon, authenticated;

create or replace function private.validate_commercial_promotion_target(
  p_organization_id uuid,
  p_entity_type text,
  p_entity_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  case p_entity_type
    when 'rfq' then
      return exists (
        select 1 from public.rfqs
        where organization_id = p_organization_id and id = p_entity_id
      );
    when 'rfq_line' then
      return exists (
        select 1 from public.rfq_lines
        where organization_id = p_organization_id and id = p_entity_id
      );
    when 'offer' then
      return exists (
        select 1 from public.offers
        where organization_id = p_organization_id and id = p_entity_id
      );
    when 'offer_line' then
      return exists (
        select 1 from public.offer_lines
        where organization_id = p_organization_id and id = p_entity_id
      );
    when 'order' then
      return exists (
        select 1 from public.orders
        where organization_id = p_organization_id and id = p_entity_id
      );
    when 'order_line' then
      return exists (
        select 1 from public.order_lines
        where organization_id = p_organization_id and id = p_entity_id
      );
    when 'company' then
      return exists (
        select 1 from public.companies
        where organization_id = p_organization_id and id = p_entity_id
      );
    when 'contact' then
      return exists (
        select 1 from public.contacts
        where organization_id = p_organization_id and id = p_entity_id
      );
    when 'product' then
      return exists (
        select 1 from public.products
        where organization_id = p_organization_id and id = p_entity_id
      );
    else
      return false;
  end case;
end;
$$;

revoke execute on function private.validate_commercial_promotion_target(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function private.validate_commercial_promotion_target(uuid, text, uuid)
  to service_role;

create or replace function private.record_commercial_entity_promotion_impl(
  p_organization_id uuid,
  p_observation_id bigint,
  p_entity_type text,
  p_entity_id uuid,
  p_field_scope text default null,
  p_promotion_action text default 'linked',
  p_status text default 'applied',
  p_confidence numeric default null,
  p_basis text default null,
  p_source_review_id bigint default null,
  p_supersedes_promotion_id bigint default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  new_id bigint;
  normalized_entity_type text := lower(trim(p_entity_type));
  normalized_action text := lower(trim(p_promotion_action));
  normalized_status text := lower(trim(p_status));
  normalized_scope text := nullif(trim(p_field_scope), '');
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_organization_member(p_organization_id, true) then
    raise exception 'Active organization write membership required';
  end if;

  if normalized_entity_type not in (
    'rfq','rfq_line','offer','offer_line','order','order_line',
    'company','contact','product'
  ) then
    raise exception 'Unsupported promotion entity type';
  end if;

  if normalized_action not in ('created','linked','updated','rejected','superseded') then
    raise exception 'Unsupported promotion action';
  end if;

  if normalized_status not in ('applied','rejected','superseded') then
    raise exception 'Unsupported promotion status';
  end if;

  if not (
    (normalized_action in ('created','linked','updated') and normalized_status = 'applied')
    or (normalized_action = 'rejected' and normalized_status = 'rejected')
    or (normalized_action = 'superseded' and normalized_status = 'superseded')
  ) then
    raise exception 'Promotion action/status mismatch';
  end if;

  if p_confidence is not null and (p_confidence < 0 or p_confidence > 1) then
    raise exception 'Promotion confidence must be between 0 and 1';
  end if;

  if not exists (
    select 1
    from public.commercial_observations o
    where o.id = p_observation_id
      and o.organization_id = p_organization_id
  ) then
    raise exception 'Observation not found in organization';
  end if;

  if not private.validate_commercial_promotion_target(
    p_organization_id,
    normalized_entity_type,
    p_entity_id
  ) then
    raise exception 'Promotion target not found in organization';
  end if;

  if p_source_review_id is not null and not exists (
    select 1
    from public.commercial_review_queue r
    where r.id = p_source_review_id
      and r.organization_id = p_organization_id
      and r.observation_id = p_observation_id
  ) then
    raise exception 'Source review does not match organization and observation';
  end if;

  if normalized_action = 'superseded' and p_supersedes_promotion_id is null then
    raise exception 'Superseded action requires supersedes_promotion_id';
  end if;

  if p_supersedes_promotion_id is not null and not exists (
    select 1
    from public.commercial_entity_promotions p
    where p.id = p_supersedes_promotion_id
      and p.organization_id = p_organization_id
      and p.observation_id = p_observation_id
  ) then
    raise exception 'Superseded promotion does not match organization and observation';
  end if;

  insert into public.commercial_entity_promotions (
    organization_id,
    observation_id,
    entity_type,
    entity_id,
    field_scope,
    promotion_action,
    status,
    confidence,
    basis,
    promoted_by,
    source_review_id,
    supersedes_promotion_id,
    metadata
  )
  values (
    p_organization_id,
    p_observation_id,
    normalized_entity_type,
    p_entity_id,
    normalized_scope,
    normalized_action,
    normalized_status,
    p_confidence,
    nullif(trim(p_basis), ''),
    actor_id,
    p_source_review_id,
    p_supersedes_promotion_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  on conflict (
    organization_id,
    observation_id,
    entity_type,
    entity_id,
    (coalesce(field_scope, '')),
    promotion_action,
    (coalesce(source_review_id, -1::bigint))
  )
  do nothing
  returning id into new_id;

  if new_id is null then
    select p.id
    into new_id
    from public.commercial_entity_promotions p
    where p.organization_id = p_organization_id
      and p.observation_id = p_observation_id
      and p.entity_type = normalized_entity_type
      and p.entity_id = p_entity_id
      and coalesce(p.field_scope, '') = coalesce(normalized_scope, '')
      and p.promotion_action = normalized_action
      and coalesce(p.source_review_id, -1) = coalesce(p_source_review_id, -1)
    order by p.id
    limit 1;
  end if;

  return new_id;
end;
$$;

revoke execute on function private.record_commercial_entity_promotion_impl(
  uuid, bigint, text, uuid, text, text, text, numeric, text, bigint, bigint, jsonb
) from public, anon;
grant execute on function private.record_commercial_entity_promotion_impl(
  uuid, bigint, text, uuid, text, text, text, numeric, text, bigint, bigint, jsonb
) to authenticated, service_role;

create or replace function public.record_commercial_entity_promotion(
  p_organization_id uuid,
  p_observation_id bigint,
  p_entity_type text,
  p_entity_id uuid,
  p_field_scope text default null,
  p_promotion_action text default 'linked',
  p_status text default 'applied',
  p_confidence numeric default null,
  p_basis text default null,
  p_source_review_id bigint default null,
  p_supersedes_promotion_id bigint default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  select private.record_commercial_entity_promotion_impl(
    p_organization_id,
    p_observation_id,
    p_entity_type,
    p_entity_id,
    p_field_scope,
    p_promotion_action,
    p_status,
    p_confidence,
    p_basis,
    p_source_review_id,
    p_supersedes_promotion_id,
    p_metadata
  );
$$;

revoke execute on function public.record_commercial_entity_promotion(
  uuid, bigint, text, uuid, text, text, text, numeric, text, bigint, bigint, jsonb
) from public, anon;
grant execute on function public.record_commercial_entity_promotion(
  uuid, bigint, text, uuid, text, text, text, numeric, text, bigint, bigint, jsonb
) to authenticated, service_role;

-- Ledger immutability is enforced at the table privilege layer.
revoke update, delete on public.commercial_entity_promotions from service_role;
