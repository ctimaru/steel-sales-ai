-- P1.11 — Human correction & feedback loop.
--
-- Review Queue remains the only browser-writable surface. Authenticated users
-- receive UPDATE only on status/corrected_values/reviewed_at, protected by RLS
-- and a state-machine trigger. A private SECURITY DEFINER trigger applies
-- approved corrections to commercial_observations and records an append-only
-- audit event. Staging/parser evidence is never rewritten.

alter table public.commercial_review_queue
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

create table if not exists public.commercial_review_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  review_id bigint not null unique references public.commercial_review_queue(id) on delete restrict,
  observation_id bigint references public.commercial_observations(id) on delete set null,
  dataset_id uuid not null references public.commercial_datasets(id) on delete restrict,
  thread_id uuid not null references public.commercial_threads(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type text not null check (event_type in ('confirmed','corrected')),
  reason text not null,
  corrected_values jsonb,
  before_observation jsonb,
  after_observation jsonb,
  source_text text,
  source_extraction_id bigint,
  staging_metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists commercial_review_events_org_created_idx
  on public.commercial_review_events (organization_id,created_at desc);

create index if not exists commercial_review_events_observation_idx
  on public.commercial_review_events (observation_id)
  where observation_id is not null;

alter table public.commercial_review_events enable row level security;

revoke all on table public.commercial_review_events from public,anon,authenticated;
grant select on table public.commercial_review_events to authenticated;
grant select,insert on table public.commercial_review_events to service_role;

drop policy if exists commercial_review_events_organization_select
  on public.commercial_review_events;

create policy commercial_review_events_organization_select
on public.commercial_review_events
for select
to authenticated
using (public.is_organization_member(organization_id,false));

-- Browser users may resolve reviews, but only through these three columns.
grant update (status,corrected_values,reviewed_at)
  on public.commercial_review_queue
  to authenticated;

create or replace function private.guard_commercial_review_resolution()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_actor uuid;
  v_unknown_key text;
begin
  v_actor := auth.uid();

  if v_actor is null then
    raise exception using
      errcode='42501',
      message='Authentication required to resolve a review.';
  end if;

  if not public.is_organization_member(new.organization_id,true) then
    raise exception using
      errcode='42501',
      message='Active organization membership required to resolve this review.';
  end if;

  if old.status <> 'pending' then
    if new.status is distinct from old.status
       or new.corrected_values is distinct from old.corrected_values
       or new.reviewed_at is distinct from old.reviewed_at then
      raise exception using
        errcode='22023',
        message='Completed review decisions are immutable.';
    end if;
    return new;
  end if;

  if new.status not in ('confirmed','corrected') then
    raise exception using
      errcode='22023',
      message='A pending review can only transition to confirmed or corrected.';
  end if;

  new.reviewed_at := now();
  new.reviewed_by := v_actor;

  if new.status='confirmed' then
    new.corrected_values := null;
    return new;
  end if;

  if new.observation_id is null then
    raise exception using
      errcode='22023',
      message='A correction requires a linked commercial observation.';
  end if;

  if new.corrected_values is null
     or jsonb_typeof(new.corrected_values) <> 'object'
     or new.corrected_values = '{}'::jsonb then
    raise exception using
      errcode='22023',
      message='A correction requires at least one corrected value.';
  end if;

  select key into v_unknown_key
  from jsonb_object_keys(new.corrected_values) as x(key)
  where key not in (
    'product_type',
    'grade',
    'standard',
    'material_number',
    'outer_diameter_mm',
    'width_mm',
    'height_mm',
    'thickness_mm',
    'length_mm',
    'quantity',
    'quantity_unit',
    'price_value',
    'price_unit',
    'currency',
    'discount_percentage',
    'availability_status',
    'note'
  )
  limit 1;

  if v_unknown_key is not null then
    raise exception using
      errcode='22023',
      message='Unsupported correction field: '||v_unknown_key;
  end if;

  -- Cast validation happens before the privileged promotion trigger.
  if new.corrected_values ? 'outer_diameter_mm' then
    perform nullif(btrim(new.corrected_values->>'outer_diameter_mm'),'')::numeric;
  end if;
  if new.corrected_values ? 'width_mm' then
    perform nullif(btrim(new.corrected_values->>'width_mm'),'')::numeric;
  end if;
  if new.corrected_values ? 'height_mm' then
    perform nullif(btrim(new.corrected_values->>'height_mm'),'')::numeric;
  end if;
  if new.corrected_values ? 'thickness_mm' then
    perform nullif(btrim(new.corrected_values->>'thickness_mm'),'')::numeric;
  end if;
  if new.corrected_values ? 'length_mm' then
    perform nullif(btrim(new.corrected_values->>'length_mm'),'')::numeric;
  end if;
  if new.corrected_values ? 'quantity' then
    perform nullif(btrim(new.corrected_values->>'quantity'),'')::numeric;
  end if;
  if new.corrected_values ? 'price_value' then
    perform nullif(btrim(new.corrected_values->>'price_value'),'')::numeric;
  end if;
  if new.corrected_values ? 'discount_percentage' then
    perform nullif(btrim(new.corrected_values->>'discount_percentage'),'')::numeric;
  end if;

  return new;
end
$$;

revoke all on function private.guard_commercial_review_resolution()
  from public,anon,authenticated;

create or replace function private.apply_commercial_review_resolution()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid;
  v_observation public.commercial_observations%rowtype;
  v_after public.commercial_observations%rowtype;
  v_before_json jsonb;
  v_after_json jsonb;
  v_staging_metadata jsonb;
begin
  if old.status <> 'pending'
     or new.status not in ('confirmed','corrected') then
    return new;
  end if;

  v_actor := auth.uid();

  if v_actor is null
     or new.reviewed_by is distinct from v_actor
     or not public.is_organization_member(new.organization_id,true) then
    raise exception using
      errcode='42501',
      message='Invalid review resolution actor.';
  end if;

  if new.observation_id is not null then
    select * into v_observation
    from public.commercial_observations o
    where o.id=new.observation_id
    for update;

    if not found
       or v_observation.organization_id is distinct from new.organization_id
       or v_observation.dataset_id is distinct from new.dataset_id
       or v_observation.thread_id is distinct from new.thread_id then
      raise exception using
        errcode='22023',
        message='Review and observation tenancy/provenance do not match.';
    end if;

    v_before_json := jsonb_build_object(
      'id',v_observation.id,
      'product_type',v_observation.product_type,
      'grade',v_observation.grade,
      'standard',v_observation.standard,
      'material_number',v_observation.material_number,
      'outer_diameter_mm',v_observation.outer_diameter_mm,
      'width_mm',v_observation.width_mm,
      'height_mm',v_observation.height_mm,
      'thickness_mm',v_observation.thickness_mm,
      'length_mm',v_observation.length_mm,
      'quantity',v_observation.quantity,
      'quantity_unit',v_observation.quantity_unit,
      'price_value',v_observation.price_value,
      'price_unit',v_observation.price_unit,
      'currency',v_observation.currency,
      'discount_percentage',v_observation.discount_percentage,
      'availability_status',v_observation.availability_status,
      'canonical_product_key',v_observation.canonical_product_key,
      'canonical_product_id',v_observation.canonical_product_id,
      'flags',v_observation.flags
    );

    if new.status='corrected' then
      update public.commercial_observations o
      set
        product_type=case
          when new.corrected_values ? 'product_type'
            then nullif(btrim(new.corrected_values->>'product_type'),'')
          else o.product_type
        end,
        grade=case
          when new.corrected_values ? 'grade'
            then nullif(btrim(new.corrected_values->>'grade'),'')
          else o.grade
        end,
        standard=case
          when new.corrected_values ? 'standard'
            then nullif(btrim(new.corrected_values->>'standard'),'')
          else o.standard
        end,
        material_number=case
          when new.corrected_values ? 'material_number'
            then nullif(btrim(new.corrected_values->>'material_number'),'')
          else o.material_number
        end,
        outer_diameter_mm=case
          when new.corrected_values ? 'outer_diameter_mm'
            then nullif(btrim(new.corrected_values->>'outer_diameter_mm'),'')::numeric
          else o.outer_diameter_mm
        end,
        width_mm=case
          when new.corrected_values ? 'width_mm'
            then nullif(btrim(new.corrected_values->>'width_mm'),'')::numeric
          else o.width_mm
        end,
        height_mm=case
          when new.corrected_values ? 'height_mm'
            then nullif(btrim(new.corrected_values->>'height_mm'),'')::numeric
          else o.height_mm
        end,
        thickness_mm=case
          when new.corrected_values ? 'thickness_mm'
            then nullif(btrim(new.corrected_values->>'thickness_mm'),'')::numeric
          else o.thickness_mm
        end,
        length_mm=case
          when new.corrected_values ? 'length_mm'
            then nullif(btrim(new.corrected_values->>'length_mm'),'')::numeric
          else o.length_mm
        end,
        quantity=case
          when new.corrected_values ? 'quantity'
            then nullif(btrim(new.corrected_values->>'quantity'),'')::numeric
          else o.quantity
        end,
        quantity_unit=case
          when new.corrected_values ? 'quantity_unit'
            then nullif(btrim(new.corrected_values->>'quantity_unit'),'')
          else o.quantity_unit
        end,
        price_value=case
          when new.corrected_values ? 'price_value'
            then nullif(btrim(new.corrected_values->>'price_value'),'')::numeric
          else o.price_value
        end,
        price_unit=case
          when new.corrected_values ? 'price_unit'
            then nullif(btrim(new.corrected_values->>'price_unit'),'')
          else o.price_unit
        end,
        currency=case
          when new.corrected_values ? 'currency'
            then upper(nullif(btrim(new.corrected_values->>'currency'),''))
          else o.currency
        end,
        discount_percentage=case
          when new.corrected_values ? 'discount_percentage'
            then nullif(btrim(new.corrected_values->>'discount_percentage'),'')::numeric
          else o.discount_percentage
        end,
        availability_status=case
          when new.corrected_values ? 'availability_status'
            then nullif(btrim(new.corrected_values->>'availability_status'),'')
          else o.availability_status
        end,
        flags=case
          when coalesce(o.flags,'[]'::jsonb) @> '["human_corrected"]'::jsonb
            then coalesce(o.flags,'[]'::jsonb)
          else coalesce(o.flags,'[]'::jsonb) || '["human_corrected"]'::jsonb
        end
      where o.id=new.observation_id;

      update public.commercial_observations o
      set search_text=lower(concat_ws(' ',
        o.source_text,o.grade,o.standard,o.material_number,
        o.outer_diameter_mm::text,o.width_mm::text,o.height_mm::text,
        o.thickness_mm::text,o.length_mm::text,
        o.quantity::text,o.quantity_unit,
        o.price_value::text,o.price_unit,o.currency
      ))
      where o.id=new.observation_id
      returning * into v_after;
    else
      v_after := v_observation;
    end if;

    v_after_json := jsonb_build_object(
      'id',v_after.id,
      'product_type',v_after.product_type,
      'grade',v_after.grade,
      'standard',v_after.standard,
      'material_number',v_after.material_number,
      'outer_diameter_mm',v_after.outer_diameter_mm,
      'width_mm',v_after.width_mm,
      'height_mm',v_after.height_mm,
      'thickness_mm',v_after.thickness_mm,
      'length_mm',v_after.length_mm,
      'quantity',v_after.quantity,
      'quantity_unit',v_after.quantity_unit,
      'price_value',v_after.price_value,
      'price_unit',v_after.price_unit,
      'currency',v_after.currency,
      'discount_percentage',v_after.discount_percentage,
      'availability_status',v_after.availability_status,
      'canonical_product_key',v_after.canonical_product_key,
      'canonical_product_id',v_after.canonical_product_id,
      'flags',v_after.flags
    );

    if v_after.source_extraction_id is not null then
      select s.metadata into v_staging_metadata
      from public.worker_staging_observations s
      where s.id=v_after.source_extraction_id;
    end if;
  elsif new.status='corrected' then
    raise exception using
      errcode='22023',
      message='A correction cannot be promoted without an observation.';
  end if;

  insert into public.commercial_review_events (
    organization_id,
    review_id,
    observation_id,
    dataset_id,
    thread_id,
    actor_id,
    event_type,
    reason,
    corrected_values,
    before_observation,
    after_observation,
    source_text,
    source_extraction_id,
    staging_metadata
  ) values (
    new.organization_id,
    new.id,
    new.observation_id,
    new.dataset_id,
    new.thread_id,
    v_actor,
    new.status,
    case
      when new.status='corrected'
        then 'human_review_correction:'||new.reason
      else 'human_review_confirmation:'||new.reason
    end,
    new.corrected_values,
    v_before_json,
    v_after_json,
    new.source_text,
    case when new.observation_id is null then null else v_after.source_extraction_id end,
    v_staging_metadata
  );

  return new;
end
$$;

revoke all on function private.apply_commercial_review_resolution()
  from public,anon,authenticated;
grant execute on function private.apply_commercial_review_resolution()
  to service_role;

drop trigger if exists commercial_review_queue_resolution_guard
  on public.commercial_review_queue;

create trigger commercial_review_queue_resolution_guard
before update of status,corrected_values,reviewed_at
on public.commercial_review_queue
for each row
execute function private.guard_commercial_review_resolution();

drop trigger if exists commercial_review_queue_resolution_apply
  on public.commercial_review_queue;

create trigger commercial_review_queue_resolution_apply
after update of status,corrected_values,reviewed_at
on public.commercial_review_queue
for each row
execute function private.apply_commercial_review_resolution();

create or replace function private.guard_commercial_review_event_immutability()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  raise exception using
    errcode='22023',
    message='Commercial review feedback events are append-only.';
end
$$;

revoke all on function private.guard_commercial_review_event_immutability()
  from public,anon,authenticated;

drop trigger if exists commercial_review_events_immutable
  on public.commercial_review_events;

create trigger commercial_review_events_immutable
before update or delete
on public.commercial_review_events
for each row
execute function private.guard_commercial_review_event_immutability();

comment on table public.commercial_review_events is
  'P1.11 append-only human review feedback ledger. Captures confirmation/correction actor, provenance and observation before/after snapshots.';

comment on function private.apply_commercial_review_resolution() is
  'P1.11 privileged trigger: tenant-validates a Review Queue resolution, applies whitelisted corrections to the linked observation and writes append-only audit feedback.';
