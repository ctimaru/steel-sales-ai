-- P1.11 — Human correction & feedback loop.
--
-- Principles:
-- * worker_staging_observations/source evidence remain immutable;
-- * commercial_observations are corrected only through one controlled RPC;
-- * every correction creates an append-only before/after audit event;
-- * product identity + search_text are recalculated atomically;
-- * correction events remain reusable as service-side parser/resolver feedback.

create table if not exists public.commercial_correction_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  review_id bigint not null references public.commercial_review_queue(id) on delete restrict,
  observation_id bigint not null references public.commercial_observations(id) on delete restrict,
  source_extraction_id bigint references public.worker_staging_observations(id) on delete set null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  before_values jsonb not null,
  corrected_values jsonb not null,
  after_values jsonb not null,
  note text,
  created_at timestamptz not null default now(),
  constraint commercial_correction_events_review_uq unique (review_id),
  constraint commercial_correction_events_corrected_object_chk
    check (jsonb_typeof(corrected_values) = 'object')
);

create index if not exists commercial_correction_events_org_created_idx
  on public.commercial_correction_events (organization_id, created_at desc);

create index if not exists commercial_correction_events_observation_created_idx
  on public.commercial_correction_events (observation_id, created_at desc);

create index if not exists commercial_correction_events_source_extraction_idx
  on public.commercial_correction_events (source_extraction_id)
  where source_extraction_id is not null;

create index if not exists commercial_correction_events_actor_idx
  on public.commercial_correction_events (actor_id);

alter table public.commercial_correction_events enable row level security;

revoke all on public.commercial_correction_events from public, anon, authenticated;
grant select on public.commercial_correction_events to authenticated, service_role;
grant insert on public.commercial_correction_events to service_role;

drop policy if exists commercial_correction_events_organization_select
  on public.commercial_correction_events;

create policy commercial_correction_events_organization_select
on public.commercial_correction_events
for select
to authenticated
using (public.is_organization_member(organization_id, false));

create or replace function private.reject_commercial_correction_event_mutation()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  raise exception 'commercial_correction_events is append-only'
    using errcode='22023';
end
$$;

revoke all on function private.reject_commercial_correction_event_mutation()
  from public, anon, authenticated, service_role;

drop trigger if exists commercial_correction_events_immutable
  on public.commercial_correction_events;

create trigger commercial_correction_events_immutable
before update or delete on public.commercial_correction_events
for each row execute function private.reject_commercial_correction_event_mutation();

create or replace function private.apply_commercial_review_correction(
  p_review_id bigint,
  p_corrected_values jsonb,
  p_note text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path=''
as $$
declare
  v_actor uuid;
  v_review public.commercial_review_queue%rowtype;
  v_before public.commercial_observations%rowtype;
  v_after public.commercial_observations%rowtype;
  v_existing public.commercial_correction_events%rowtype;
  v_event_id uuid;
  v_product_type text;
  v_grade text;
  v_standard text;
  v_material_number text;
  v_outer_diameter_mm numeric;
  v_width_mm numeric;
  v_height_mm numeric;
  v_thickness_mm numeric;
  v_length_mm numeric;
  v_quantity numeric;
  v_quantity_unit text;
  v_price_value numeric;
  v_price_unit text;
  v_currency text;
  v_discount_percentage numeric;
  v_availability_status text;
  v_item_role text;
  v_key text;
  v_product_id uuid;
  v_before_json jsonb;
  v_after_json jsonb;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authenticated user required' using errcode='42501';
  end if;

  if p_review_id is null or p_review_id <= 0 then
    raise exception 'Invalid review id' using errcode='22023';
  end if;

  if p_corrected_values is null
     or jsonb_typeof(p_corrected_values) <> 'object'
     or p_corrected_values = '{}'::jsonb then
    raise exception 'At least one corrected value is required'
      using errcode='22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_corrected_values) as k(key)
    where k.key not in (
      'item_role',
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
      'availability_status'
    )
  ) then
    raise exception 'Unsupported correction field'
      using errcode='22023';
  end if;

  select * into v_existing
  from public.commercial_correction_events
  where review_id=p_review_id;

  if found then
    if v_existing.corrected_values = p_corrected_values then
      return jsonb_build_object(
        'status','already_corrected',
        'event_id',v_existing.id,
        'review_id',v_existing.review_id,
        'observation_id',v_existing.observation_id,
        'canonical_product_id',v_existing.after_values->>'canonical_product_id',
        'corrected_values',v_existing.corrected_values
      );
    end if;
    raise exception 'Review already corrected with different values'
      using errcode='22023';
  end if;

  select * into v_review
  from public.commercial_review_queue
  where id=p_review_id
  for update;

  if not found then
    raise exception 'Review item not found' using errcode='P0002';
  end if;

  if v_review.status <> 'pending' then
    raise exception 'Review item is not pending' using errcode='22023';
  end if;

  if v_review.organization_id is null
     or not public.is_organization_member(v_review.organization_id,true) then
    raise exception 'Not authorized for review organization'
      using errcode='42501';
  end if;

  if v_review.observation_id is null then
    raise exception 'Review item has no observation' using errcode='22023';
  end if;

  select * into v_before
  from public.commercial_observations
  where id=v_review.observation_id
    and organization_id=v_review.organization_id
  for update;

  if not found then
    raise exception 'Observation not found in review organization'
      using errcode='P0002';
  end if;

  v_item_role := case
    when p_corrected_values ? 'item_role'
      then nullif(btrim(p_corrected_values->>'item_role'),'')
    else v_before.item_role
  end;
  if v_item_role not in ('requested','offered','ordered','delivered') then
    raise exception 'Invalid item_role' using errcode='22023';
  end if;

  v_product_type := case
    when p_corrected_values ? 'product_type'
      then nullif(btrim(p_corrected_values->>'product_type'),'')
    else v_before.product_type
  end;

  v_grade := case
    when p_corrected_values ? 'grade'
      then nullif(btrim(p_corrected_values->>'grade'),'')
    else v_before.grade
  end;
  v_standard := case
    when p_corrected_values ? 'standard'
      then nullif(btrim(p_corrected_values->>'standard'),'')
    else v_before.standard
  end;
  v_material_number := case
    when p_corrected_values ? 'material_number'
      then nullif(btrim(p_corrected_values->>'material_number'),'')
    else v_before.material_number
  end;

  v_outer_diameter_mm := case
    when p_corrected_values ? 'outer_diameter_mm'
      then (p_corrected_values->>'outer_diameter_mm')::numeric
    else v_before.outer_diameter_mm
  end;
  v_width_mm := case
    when p_corrected_values ? 'width_mm'
      then (p_corrected_values->>'width_mm')::numeric
    else v_before.width_mm
  end;
  v_height_mm := case
    when p_corrected_values ? 'height_mm'
      then (p_corrected_values->>'height_mm')::numeric
    else v_before.height_mm
  end;
  v_thickness_mm := case
    when p_corrected_values ? 'thickness_mm'
      then (p_corrected_values->>'thickness_mm')::numeric
    else v_before.thickness_mm
  end;
  v_length_mm := case
    when p_corrected_values ? 'length_mm'
      then (p_corrected_values->>'length_mm')::numeric
    else v_before.length_mm
  end;
  v_quantity := case
    when p_corrected_values ? 'quantity'
      then (p_corrected_values->>'quantity')::numeric
    else v_before.quantity
  end;
  v_price_value := case
    when p_corrected_values ? 'price_value'
      then (p_corrected_values->>'price_value')::numeric
    else v_before.price_value
  end;
  v_discount_percentage := case
    when p_corrected_values ? 'discount_percentage'
      then (p_corrected_values->>'discount_percentage')::numeric
    else v_before.discount_percentage
  end;

  v_quantity_unit := case
    when p_corrected_values ? 'quantity_unit'
      then nullif(upper(btrim(p_corrected_values->>'quantity_unit')),'')
    else v_before.quantity_unit
  end;
  v_price_unit := case
    when p_corrected_values ? 'price_unit'
      then nullif(upper(btrim(p_corrected_values->>'price_unit')),'')
    else v_before.price_unit
  end;
  v_currency := case
    when p_corrected_values ? 'currency'
      then nullif(upper(btrim(p_corrected_values->>'currency')),'')
    else v_before.currency
  end;
  v_availability_status := case
    when p_corrected_values ? 'availability_status'
      then nullif(lower(btrim(p_corrected_values->>'availability_status')),'')
    else v_before.availability_status
  end;

  if v_outer_diameter_mm is not null and v_outer_diameter_mm <= 0
     or v_width_mm is not null and v_width_mm <= 0
     or v_height_mm is not null and v_height_mm <= 0
     or v_thickness_mm is not null and v_thickness_mm <= 0
     or v_length_mm is not null and v_length_mm <= 0
     or v_quantity is not null and v_quantity <= 0
     or v_price_value is not null and v_price_value < 0
     or v_discount_percentage is not null
        and (v_discount_percentage < 0 or v_discount_percentage > 100) then
    raise exception 'Corrected numeric values are outside allowed range'
      using errcode='22023';
  end if;

  if v_product_type is null then
    v_product_type := case
      when v_outer_diameter_mm is not null then 'round_tube'
      when v_width_mm is not null and v_height_mm is not null
        and v_width_mm=v_height_mm then 'square_tube'
      when v_width_mm is not null and v_height_mm is not null
        then 'rectangular_tube'
      else null
    end;
  end if;

  if v_product_type is not null
     and v_product_type not in ('round_tube','square_tube','rectangular_tube') then
    raise exception 'Invalid product_type' using errcode='22023';
  end if;

  v_key := public.canonical_tube_product_key(
    v_product_type,
    v_grade,
    v_standard,
    v_material_number,
    v_outer_diameter_mm,
    v_width_mm,
    v_height_mm,
    v_thickness_mm,
    null
  );

  v_product_id := public.canonical_tube_product_id(
    v_product_type,
    v_grade,
    v_standard,
    v_material_number,
    v_outer_diameter_mm,
    v_width_mm,
    v_height_mm,
    v_thickness_mm,
    null
  );

  v_before_json := jsonb_build_object(
    'item_role',v_before.item_role,
    'product_type',v_before.product_type,
    'grade',v_before.grade,
    'standard',v_before.standard,
    'material_number',v_before.material_number,
    'outer_diameter_mm',v_before.outer_diameter_mm,
    'width_mm',v_before.width_mm,
    'height_mm',v_before.height_mm,
    'thickness_mm',v_before.thickness_mm,
    'length_mm',v_before.length_mm,
    'quantity',v_before.quantity,
    'quantity_unit',v_before.quantity_unit,
    'price_value',v_before.price_value,
    'price_unit',v_before.price_unit,
    'currency',v_before.currency,
    'discount_percentage',v_before.discount_percentage,
    'availability_status',v_before.availability_status,
    'canonical_product_key',v_before.canonical_product_key,
    'canonical_product_id',v_before.canonical_product_id
  );

  update public.commercial_observations
  set
    item_role=v_item_role,
    product_type=v_product_type,
    grade=v_grade,
    standard=v_standard,
    material_number=v_material_number,
    outer_diameter_mm=v_outer_diameter_mm,
    width_mm=v_width_mm,
    height_mm=v_height_mm,
    thickness_mm=v_thickness_mm,
    length_mm=v_length_mm,
    quantity=v_quantity,
    quantity_unit=v_quantity_unit,
    price_value=v_price_value,
    price_unit=v_price_unit,
    currency=v_currency,
    discount_percentage=v_discount_percentage,
    availability_status=v_availability_status,
    canonical_product_key=v_key,
    canonical_product_id=v_product_id,
    search_text=lower(concat_ws(' ',
      source_text,
      v_item_role,
      v_product_type,
      v_grade,
      v_standard,
      v_material_number,
      v_outer_diameter_mm::text,
      v_width_mm::text,
      v_height_mm::text,
      v_thickness_mm::text,
      v_length_mm::text,
      v_quantity::text,
      v_quantity_unit,
      v_price_value::text,
      v_price_unit,
      v_currency,
      v_availability_status
    ))
  where id=v_before.id
    and organization_id=v_review.organization_id
  returning * into v_after;

  if not found then
    raise exception 'Observation correction update failed' using errcode='P0002';
  end if;

  v_after_json := jsonb_build_object(
    'item_role',v_after.item_role,
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
    'canonical_product_id',v_after.canonical_product_id
  );

  insert into public.commercial_correction_events (
    organization_id,
    review_id,
    observation_id,
    source_extraction_id,
    actor_id,
    before_values,
    corrected_values,
    after_values,
    note
  ) values (
    v_review.organization_id,
    v_review.id,
    v_after.id,
    v_after.source_extraction_id,
    v_actor,
    v_before_json,
    p_corrected_values,
    v_after_json,
    nullif(btrim(p_note),'')
  )
  returning id into v_event_id;

  update public.commercial_review_queue
  set
    status='corrected',
    corrected_values=p_corrected_values,
    reviewed_at=now()
  where id=v_review.id
    and organization_id=v_review.organization_id
    and status='pending';

  if not found then
    raise exception 'Review status update failed' using errcode='P0002';
  end if;

  return jsonb_build_object(
    'status','corrected',
    'event_id',v_event_id,
    'review_id',v_review.id,
    'observation_id',v_after.id,
    'canonical_product_key',v_after.canonical_product_key,
    'canonical_product_id',v_after.canonical_product_id,
    'corrected_values',p_corrected_values
  );
end
$$;

revoke all on function private.apply_commercial_review_correction(bigint,jsonb,text)
  from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.apply_commercial_review_correction(bigint,jsonb,text)
  to authenticated;

create or replace function public.p1_apply_commercial_review_correction(
  p_review_id bigint,
  p_corrected_values jsonb,
  p_note text default null
)
returns jsonb
language sql
volatile
security invoker
set search_path=''
as $$
  select private.apply_commercial_review_correction(
    p_review_id,
    p_corrected_values,
    p_note
  );
$$;

revoke all on function public.p1_apply_commercial_review_correction(bigint,jsonb,text)
  from public, anon;
grant execute on function public.p1_apply_commercial_review_correction(bigint,jsonb,text)
  to authenticated;

create or replace function public.p1_commercial_correction_feedback(
  p_organization_id uuid default null,
  p_limit integer default 100
)
returns table (
  event_id uuid,
  organization_id uuid,
  review_id bigint,
  observation_id bigint,
  source_extraction_id bigint,
  reason text,
  source_text text,
  before_values jsonb,
  corrected_values jsonb,
  after_values jsonb,
  note text,
  actor_id uuid,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path=''
as $$
  select
    e.id,
    e.organization_id,
    e.review_id,
    e.observation_id,
    e.source_extraction_id,
    rq.reason,
    o.source_text,
    e.before_values,
    e.corrected_values,
    e.after_values,
    e.note,
    e.actor_id,
    e.created_at
  from public.commercial_correction_events e
  join public.commercial_review_queue rq
    on rq.id=e.review_id
   and rq.organization_id=e.organization_id
  join public.commercial_observations o
    on o.id=e.observation_id
   and o.organization_id=e.organization_id
  where p_organization_id is null
     or e.organization_id=p_organization_id
  order by e.created_at desc,e.id
  limit greatest(1,least(coalesce(p_limit,100),1000));
$$;

revoke all on function public.p1_commercial_correction_feedback(uuid,integer)
  from public, anon, authenticated;
grant execute on function public.p1_commercial_correction_feedback(uuid,integer)
  to service_role;

comment on table public.commercial_correction_events is
  'P1.11 append-only audit trail for human corrections. Source/staging evidence is never rewritten.';

comment on function public.p1_apply_commercial_review_correction(bigint,jsonb,text) is
  'P1.11 authenticated tenant-safe correction RPC. Atomically updates one app-facing observation, recalculates search/product identity, closes the review, and appends an immutable audit event.';

comment on function public.p1_commercial_correction_feedback(uuid,integer) is
  'P1.11 service-only correction feedback dataset for future parser/resolver tuning.';
