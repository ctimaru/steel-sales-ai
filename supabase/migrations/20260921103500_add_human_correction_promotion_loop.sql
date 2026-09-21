-- P1.11 — controlled human correction promotion loop.
--
-- A correction must be atomic:
-- review_queue pending -> corrected
-- commercial_observation structured values -> corrected values
-- canonical product identity + search_text -> recomputed
-- immutable audit event -> appended
--
-- The browser never receives direct UPDATE rights on commercial_observations.

create table if not exists public.commercial_correction_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  review_id bigint not null unique references public.commercial_review_queue(id) on delete restrict,
  observation_id bigint not null references public.commercial_observations(id) on delete restrict,
  corrected_by uuid not null references auth.users(id) on delete restrict,
  original_values jsonb not null,
  requested_values jsonb not null,
  resulting_values jsonb not null,
  previous_canonical_product_key text,
  resulting_canonical_product_key text,
  previous_canonical_product_id uuid,
  resulting_canonical_product_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists commercial_correction_events_org_created_idx
  on public.commercial_correction_events (organization_id, created_at desc);

create index if not exists commercial_correction_events_observation_idx
  on public.commercial_correction_events (observation_id, created_at desc);

alter table public.commercial_correction_events enable row level security;

revoke all on public.commercial_correction_events from public,anon,authenticated;
grant select on public.commercial_correction_events to authenticated;
grant select,insert on public.commercial_correction_events to service_role;

drop policy if exists commercial_correction_events_organization_select
  on public.commercial_correction_events;
create policy commercial_correction_events_organization_select
on public.commercial_correction_events
for select
to authenticated
using (public.is_organization_member(organization_id,false));

create or replace function public.guard_commercial_correction_event_immutable()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  raise exception using
    errcode='55000',
    message='commercial correction events are append-only';
end
$$;

revoke all on function public.guard_commercial_correction_event_immutable()
from public,anon,authenticated;

drop trigger if exists commercial_correction_events_immutable
on public.commercial_correction_events;

create trigger commercial_correction_events_immutable
before update or delete on public.commercial_correction_events
for each row execute function public.guard_commercial_correction_event_immutable();

alter table public.commercial_review_queue
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

create index if not exists commercial_review_queue_reviewed_by_idx
  on public.commercial_review_queue (reviewed_by)
  where reviewed_by is not null;

create or replace function public.p1_apply_commercial_review_correction(
  p_review_id bigint,
  p_corrected_values jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := auth.uid();
  v_review public.commercial_review_queue%rowtype;
  v_obs public.commercial_observations%rowtype;
  v_allowed text[] := array[
    'product_type','grade','standard','material_number',
    'outer_diameter_mm','width_mm','height_mm','thickness_mm',
    'length_mm','quantity','quantity_unit',
    'price_value','price_unit','currency','discount_percentage',
    'availability_status','note'
  ];
  v_key text;
  v_product_id uuid;
  v_product_type text;
  v_grade text;
  v_standard text;
  v_material_number text;
  v_od numeric;
  v_width numeric;
  v_height numeric;
  v_thickness numeric;
  v_length numeric;
  v_quantity numeric;
  v_quantity_unit text;
  v_price numeric;
  v_price_unit text;
  v_currency text;
  v_discount numeric;
  v_availability text;
  v_note text;
  v_original jsonb;
  v_result jsonb;
  v_event_id bigint;
begin
  if v_actor is null then
    raise exception using errcode='28000',message='authentication required';
  end if;

  if p_review_id is null or p_review_id <= 0 then
    raise exception using errcode='22023',message='valid review id required';
  end if;

  if p_corrected_values is null
     or jsonb_typeof(p_corrected_values)<>'object'
     or p_corrected_values='{}'::jsonb then
    raise exception using errcode='22023',message='at least one corrected value is required';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(p_corrected_values) k
    where not (k=any(v_allowed))
  ) then
    raise exception using errcode='22023',message='unsupported correction field';
  end if;

  select * into v_review
  from public.commercial_review_queue
  where id=p_review_id
  for update;

  if v_review.id is null then
    raise exception using errcode='P0002',message='review item not found';
  end if;

  if v_review.status<>'pending' then
    raise exception using errcode='55000',message='review item is already completed';
  end if;

  if v_review.observation_id is null then
    raise exception using errcode='22023',message='review item is not linked to a commercial observation';
  end if;

  if v_review.organization_id is null
     or not public.is_organization_member(v_review.organization_id,true) then
    raise exception using errcode='42501',message='active tenant membership required';
  end if;

  select * into v_obs
  from public.commercial_observations
  where id=v_review.observation_id
  for update;

  if v_obs.id is null
     or v_obs.organization_id is distinct from v_review.organization_id
     or v_obs.dataset_id is distinct from v_review.dataset_id
     or v_obs.thread_id is distinct from v_review.thread_id then
    raise exception using errcode='55000',message='review/observation provenance mismatch';
  end if;

  v_product_type := case when p_corrected_values ? 'product_type'
    then nullif(btrim(p_corrected_values->>'product_type'),'')
    else v_obs.product_type end;
  v_grade := case when p_corrected_values ? 'grade'
    then nullif(btrim(p_corrected_values->>'grade'),'')
    else v_obs.grade end;
  v_standard := case when p_corrected_values ? 'standard'
    then nullif(btrim(p_corrected_values->>'standard'),'')
    else v_obs.standard end;
  v_material_number := case when p_corrected_values ? 'material_number'
    then nullif(btrim(p_corrected_values->>'material_number'),'')
    else v_obs.material_number end;

  v_od := case when p_corrected_values ? 'outer_diameter_mm'
    then nullif(btrim(p_corrected_values->>'outer_diameter_mm'),'')::numeric
    else v_obs.outer_diameter_mm end;
  v_width := case when p_corrected_values ? 'width_mm'
    then nullif(btrim(p_corrected_values->>'width_mm'),'')::numeric
    else v_obs.width_mm end;
  v_height := case when p_corrected_values ? 'height_mm'
    then nullif(btrim(p_corrected_values->>'height_mm'),'')::numeric
    else v_obs.height_mm end;
  v_thickness := case when p_corrected_values ? 'thickness_mm'
    then nullif(btrim(p_corrected_values->>'thickness_mm'),'')::numeric
    else v_obs.thickness_mm end;
  v_length := case when p_corrected_values ? 'length_mm'
    then nullif(btrim(p_corrected_values->>'length_mm'),'')::numeric
    else v_obs.length_mm end;
  v_quantity := case when p_corrected_values ? 'quantity'
    then nullif(btrim(p_corrected_values->>'quantity'),'')::numeric
    else v_obs.quantity end;
  v_quantity_unit := case when p_corrected_values ? 'quantity_unit'
    then nullif(btrim(p_corrected_values->>'quantity_unit'),'')
    else v_obs.quantity_unit end;
  v_price := case when p_corrected_values ? 'price_value'
    then nullif(btrim(p_corrected_values->>'price_value'),'')::numeric
    else v_obs.price_value end;
  v_price_unit := case when p_corrected_values ? 'price_unit'
    then nullif(btrim(p_corrected_values->>'price_unit'),'')
    else v_obs.price_unit end;
  v_currency := case when p_corrected_values ? 'currency'
    then upper(nullif(btrim(p_corrected_values->>'currency'),''))
    else v_obs.currency end;
  v_discount := case when p_corrected_values ? 'discount_percentage'
    then nullif(btrim(p_corrected_values->>'discount_percentage'),'')::numeric
    else v_obs.discount_percentage end;
  v_availability := case when p_corrected_values ? 'availability_status'
    then nullif(btrim(p_corrected_values->>'availability_status'),'')
    else v_obs.availability_status end;
  v_note := nullif(btrim(p_corrected_values->>'note'),'');

  if v_quantity is not null and v_quantity<0 then
    raise exception using errcode='22023',message='quantity cannot be negative';
  end if;
  if v_price is not null and v_price<0 then
    raise exception using errcode='22023',message='price cannot be negative';
  end if;
  if v_discount is not null and (v_discount<0 or v_discount>100) then
    raise exception using errcode='22023',message='discount percentage must be between 0 and 100';
  end if;

  v_key := public.canonical_tube_product_key(
    v_product_type,v_grade,v_standard,v_material_number,
    v_od,v_width,v_height,v_thickness,null
  );
  v_product_id := public.canonical_tube_product_id(
    v_product_type,v_grade,v_standard,v_material_number,
    v_od,v_width,v_height,v_thickness,null
  );

  v_original := jsonb_build_object(
    'product_type',v_obs.product_type,
    'grade',v_obs.grade,
    'standard',v_obs.standard,
    'material_number',v_obs.material_number,
    'outer_diameter_mm',v_obs.outer_diameter_mm,
    'width_mm',v_obs.width_mm,
    'height_mm',v_obs.height_mm,
    'thickness_mm',v_obs.thickness_mm,
    'length_mm',v_obs.length_mm,
    'quantity',v_obs.quantity,
    'quantity_unit',v_obs.quantity_unit,
    'price_value',v_obs.price_value,
    'price_unit',v_obs.price_unit,
    'currency',v_obs.currency,
    'discount_percentage',v_obs.discount_percentage,
    'availability_status',v_obs.availability_status
  );

  update public.commercial_observations
  set
    product_type=v_product_type,
    grade=v_grade,
    standard=v_standard,
    material_number=v_material_number,
    outer_diameter_mm=v_od,
    width_mm=v_width,
    height_mm=v_height,
    thickness_mm=v_thickness,
    length_mm=v_length,
    quantity=v_quantity,
    quantity_unit=v_quantity_unit,
    price_value=v_price,
    price_unit=v_price_unit,
    currency=v_currency,
    discount_percentage=v_discount,
    availability_status=v_availability,
    canonical_product_key=v_key,
    canonical_product_id=v_product_id,
    search_text=lower(concat_ws(' ',
      v_product_type,v_grade,v_standard,v_material_number,
      v_od::text,v_width::text,v_height::text,v_thickness::text,v_length::text,
      v_quantity::text,v_quantity_unit,v_price::text,v_price_unit,v_currency,
      v_availability
    ))
  where id=v_obs.id;

  v_result := jsonb_build_object(
    'product_type',v_product_type,
    'grade',v_grade,
    'standard',v_standard,
    'material_number',v_material_number,
    'outer_diameter_mm',v_od,
    'width_mm',v_width,
    'height_mm',v_height,
    'thickness_mm',v_thickness,
    'length_mm',v_length,
    'quantity',v_quantity,
    'quantity_unit',v_quantity_unit,
    'price_value',v_price,
    'price_unit',v_price_unit,
    'currency',v_currency,
    'discount_percentage',v_discount,
    'availability_status',v_availability
  );

  insert into public.commercial_correction_events (
    organization_id,review_id,observation_id,corrected_by,
    original_values,requested_values,resulting_values,
    previous_canonical_product_key,resulting_canonical_product_key,
    previous_canonical_product_id,resulting_canonical_product_id,note
  ) values (
    v_review.organization_id,v_review.id,v_obs.id,v_actor,
    v_original,p_corrected_values,v_result,
    v_obs.canonical_product_key,v_key,
    v_obs.canonical_product_id,v_product_id,v_note
  )
  returning id into v_event_id;

  update public.commercial_review_queue
  set
    status='corrected',
    corrected_values=p_corrected_values,
    reviewed_at=now(),
    reviewed_by=v_actor
  where id=v_review.id;

  return jsonb_build_object(
    'review_id',v_review.id,
    'observation_id',v_obs.id,
    'correction_event_id',v_event_id,
    'status','corrected',
    'canonical_product_key',v_key,
    'canonical_product_id',v_product_id,
    'resulting_values',v_result
  );
end
$$;

comment on function public.p1_apply_commercial_review_correction(bigint,jsonb) is
  'P1.11 controlled tenant-safe correction promotion: review queue -> observation, canonical identity/search refresh and append-only audit.';

revoke all on function public.p1_apply_commercial_review_correction(bigint,jsonb)
from public,anon;

grant execute on function public.p1_apply_commercial_review_correction(bigint,jsonb)
to authenticated,service_role;
