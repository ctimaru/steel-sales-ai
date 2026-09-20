-- P1.11a — Controlled human correction promotion with append-only audit.
--
-- Browser remains read-only on commercial_observations.
-- Worker/service_role calls this SECURITY INVOKER RPC after verifying the actor.
-- The RPC re-verifies active tenant write membership and atomically:
--   review queue -> commercial observation -> canonical identity/search text -> audit ledger.

create table if not exists public.commercial_correction_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  review_id bigint not null unique references public.commercial_review_queue(id) on delete restrict,
  observation_id bigint not null references public.commercial_observations(id) on delete restrict,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  before_values jsonb not null,
  corrected_values jsonb not null,
  after_values jsonb not null,
  note text,
  previous_canonical_product_key text,
  previous_canonical_product_id uuid,
  new_canonical_product_key text,
  new_canonical_product_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commercial_correction_events_values_object_check
    check (
      jsonb_typeof(before_values)='object'
      and jsonb_typeof(corrected_values)='object'
      and jsonb_typeof(after_values)='object'
      and jsonb_typeof(metadata)='object'
    )
);

create index if not exists commercial_correction_events_org_created_idx
  on public.commercial_correction_events (organization_id,created_at desc);

create index if not exists commercial_correction_events_observation_idx
  on public.commercial_correction_events (observation_id,created_at desc);

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

create or replace function public.guard_commercial_correction_event_immutability()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  raise exception 'commercial_correction_events is append-only'
    using errcode='55000';
end
$$;

drop trigger if exists commercial_correction_events_immutable
  on public.commercial_correction_events;

create trigger commercial_correction_events_immutable
before update or delete on public.commercial_correction_events
for each row execute function public.guard_commercial_correction_event_immutability();

revoke all on function public.guard_commercial_correction_event_immutability()
  from public,anon,authenticated;
grant execute on function public.guard_commercial_correction_event_immutability()
  to service_role;

create or replace function public.p1_apply_review_correction(
  p_review_id bigint,
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_corrected_values jsonb,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_review public.commercial_review_queue%rowtype;
  v_before public.commercial_observations%rowtype;
  v_after public.commercial_observations%rowtype;
  v_existing public.commercial_correction_events%rowtype;
  v_values jsonb;
  v_unknown text[];
  v_note text;
  v_event_id uuid;
begin
  if p_review_id is null or p_actor_user_id is null or p_organization_id is null then
    raise exception 'review_id, actor_user_id and organization_id are required'
      using errcode='22023';
  end if;

  if jsonb_typeof(coalesce(p_corrected_values,'null'::jsonb)) <> 'object' then
    raise exception 'corrected_values must be a JSON object'
      using errcode='22023';
  end if;

  if jsonb_typeof(coalesce(p_metadata,'{}'::jsonb)) <> 'object' then
    raise exception 'metadata must be a JSON object'
      using errcode='22023';
  end if;

  select array_agg(k order by k) into v_unknown
  from jsonb_object_keys(p_corrected_values) as x(k)
  where k <> all(array[
    'grade','standard','material_number',
    'outer_diameter_mm','width_mm','height_mm','thickness_mm','length_mm',
    'quantity','quantity_unit','price_value','price_unit','currency',
    'availability_status','note'
  ]::text[]);

  if coalesce(cardinality(v_unknown),0)>0 then
    raise exception 'unsupported correction fields: %',array_to_string(v_unknown,', ')
      using errcode='22023';
  end if;

  v_values := p_corrected_values - 'note';
  v_note := nullif(btrim(p_corrected_values->>'note'),'');

  if v_values='{}'::jsonb then
    raise exception 'at least one promotable corrected value is required'
      using errcode='22023';
  end if;

  if not exists (
    select 1
    from public.organization_memberships m
    where m.organization_id=p_organization_id
      and m.user_id=p_actor_user_id
      and m.status='active'
      and m.role in ('admin','member')
  ) then
    raise exception 'active tenant write membership is required'
      using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('p1-review-correction:'||p_review_id::text,0));

  select * into v_existing
  from public.commercial_correction_events e
  where e.review_id=p_review_id;

  if found then
    if v_existing.organization_id<>p_organization_id then
      raise exception 'existing correction belongs to another organization'
        using errcode='42501';
    end if;
    return jsonb_build_object(
      'applied',true,
      'idempotent',true,
      'event_id',v_existing.id,
      'review_id',v_existing.review_id,
      'observation_id',v_existing.observation_id,
      'canonical_product_id',v_existing.new_canonical_product_id
    );
  end if;

  select * into v_review
  from public.commercial_review_queue rq
  where rq.id=p_review_id
    and rq.organization_id=p_organization_id
    and rq.observation_id is not null
    and rq.status in ('pending','corrected')
  for update;

  if not found then
    raise exception 'review is unavailable, already confirmed, or outside tenant'
      using errcode='P0002';
  end if;

  if v_review.status='corrected'
     and v_review.corrected_values is not null
     and v_review.corrected_values<>p_corrected_values then
    raise exception 'legacy corrected review values do not match requested promotion'
      using errcode='22023';
  end if;

  select * into v_before
  from public.commercial_observations o
  where o.id=v_review.observation_id
    and o.organization_id=p_organization_id
    and o.dataset_id=v_review.dataset_id
    and o.thread_id=v_review.thread_id
  for update;

  if not found then
    raise exception 'linked observation is unavailable or tenant-mismatched'
      using errcode='P0002';
  end if;

  update public.commercial_observations o
  set
    grade = case when v_values ? 'grade'
      then nullif(btrim(v_values->>'grade'),'') else o.grade end,
    standard = case when v_values ? 'standard'
      then nullif(btrim(v_values->>'standard'),'') else o.standard end,
    material_number = case when v_values ? 'material_number'
      then nullif(btrim(v_values->>'material_number'),'') else o.material_number end,
    outer_diameter_mm = case when v_values ? 'outer_diameter_mm'
      then nullif(replace(btrim(v_values->>'outer_diameter_mm'),',','.'),'')::numeric
      else o.outer_diameter_mm end,
    width_mm = case when v_values ? 'width_mm'
      then nullif(replace(btrim(v_values->>'width_mm'),',','.'),'')::numeric
      else o.width_mm end,
    height_mm = case when v_values ? 'height_mm'
      then nullif(replace(btrim(v_values->>'height_mm'),',','.'),'')::numeric
      else o.height_mm end,
    thickness_mm = case when v_values ? 'thickness_mm'
      then nullif(replace(btrim(v_values->>'thickness_mm'),',','.'),'')::numeric
      else o.thickness_mm end,
    length_mm = case when v_values ? 'length_mm'
      then nullif(replace(btrim(v_values->>'length_mm'),',','.'),'')::numeric
      else o.length_mm end,
    quantity = case when v_values ? 'quantity'
      then nullif(replace(btrim(v_values->>'quantity'),',','.'),'')::numeric
      else o.quantity end,
    quantity_unit = case when v_values ? 'quantity_unit'
      then upper(nullif(btrim(v_values->>'quantity_unit'),'')) else o.quantity_unit end,
    price_value = case when v_values ? 'price_value'
      then nullif(replace(btrim(v_values->>'price_value'),',','.'),'')::numeric
      else o.price_value end,
    price_unit = case when v_values ? 'price_unit'
      then upper(nullif(btrim(v_values->>'price_unit'),'')) else o.price_unit end,
    currency = case when v_values ? 'currency'
      then upper(nullif(btrim(v_values->>'currency'),'')) else o.currency end,
    availability_status = case when v_values ? 'availability_status'
      then nullif(btrim(v_values->>'availability_status'),'') else o.availability_status end
  where o.id=v_before.id
  returning * into v_after;

  v_after.product_type := case
    when v_after.outer_diameter_mm is not null then 'round_tube'
    when v_after.width_mm is not null
      and v_after.height_mm is not null
      and v_after.width_mm=v_after.height_mm then 'square_tube'
    when v_after.width_mm is not null and v_after.height_mm is not null then 'rectangular_tube'
    else v_after.product_type
  end;

  v_after.canonical_product_key := public.canonical_tube_product_key(
    v_after.product_type,
    v_after.grade,
    v_after.standard,
    v_after.material_number,
    v_after.outer_diameter_mm,
    v_after.width_mm,
    v_after.height_mm,
    v_after.thickness_mm,
    null
  );

  v_after.canonical_product_id := public.canonical_tube_product_id(
    v_after.product_type,
    v_after.grade,
    v_after.standard,
    v_after.material_number,
    v_after.outer_diameter_mm,
    v_after.width_mm,
    v_after.height_mm,
    v_after.thickness_mm,
    null
  );

  v_after.search_text := lower(concat_ws(' ',
    v_after.source_text,
    v_after.grade,v_after.standard,v_after.material_number,
    v_after.outer_diameter_mm::text,v_after.width_mm::text,v_after.height_mm::text,
    v_after.thickness_mm::text,v_after.length_mm::text,
    v_after.quantity::text,v_after.quantity_unit,
    v_after.price_value::text,v_after.price_unit,v_after.currency,
    v_after.availability_status
  ));

  if jsonb_typeof(v_after.flags)<>'array' then
    v_after.flags := '[]'::jsonb;
  end if;
  if not (v_after.flags @> '["human_corrected"]'::jsonb) then
    v_after.flags := v_after.flags || '["human_corrected"]'::jsonb;
  end if;

  update public.commercial_observations o
  set
    product_type=v_after.product_type,
    canonical_product_key=v_after.canonical_product_key,
    canonical_product_id=v_after.canonical_product_id,
    search_text=v_after.search_text,
    flags=v_after.flags
  where o.id=v_after.id
  returning * into v_after;

  update public.commercial_review_queue rq
  set
    status='corrected',
    corrected_values=p_corrected_values,
    reviewed_at=coalesce(rq.reviewed_at,now())
  where rq.id=v_review.id;

  insert into public.commercial_correction_events (
    organization_id,review_id,observation_id,actor_user_id,
    before_values,corrected_values,after_values,note,
    previous_canonical_product_key,previous_canonical_product_id,
    new_canonical_product_key,new_canonical_product_id,metadata
  ) values (
    p_organization_id,
    v_review.id,
    v_after.id,
    p_actor_user_id,
    jsonb_build_object(
      'product_type',v_before.product_type,
      'grade',v_before.grade,'standard',v_before.standard,'material_number',v_before.material_number,
      'outer_diameter_mm',v_before.outer_diameter_mm,'width_mm',v_before.width_mm,
      'height_mm',v_before.height_mm,'thickness_mm',v_before.thickness_mm,'length_mm',v_before.length_mm,
      'quantity',v_before.quantity,'quantity_unit',v_before.quantity_unit,
      'price_value',v_before.price_value,'price_unit',v_before.price_unit,'currency',v_before.currency,
      'availability_status',v_before.availability_status
    ),
    v_values,
    jsonb_build_object(
      'product_type',v_after.product_type,
      'grade',v_after.grade,'standard',v_after.standard,'material_number',v_after.material_number,
      'outer_diameter_mm',v_after.outer_diameter_mm,'width_mm',v_after.width_mm,
      'height_mm',v_after.height_mm,'thickness_mm',v_after.thickness_mm,'length_mm',v_after.length_mm,
      'quantity',v_after.quantity,'quantity_unit',v_after.quantity_unit,
      'price_value',v_after.price_value,'price_unit',v_after.price_unit,'currency',v_after.currency,
      'availability_status',v_after.availability_status
    ),
    v_note,
    v_before.canonical_product_key,
    v_before.canonical_product_id,
    v_after.canonical_product_key,
    v_after.canonical_product_id,
    coalesce(p_metadata,'{}'::jsonb) || jsonb_build_object(
      'contract','p1.11a',
      'source_provenance_preserved',true
    )
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'applied',true,
    'idempotent',false,
    'event_id',v_event_id,
    'review_id',v_review.id,
    'observation_id',v_after.id,
    'canonical_product_key',v_after.canonical_product_key,
    'canonical_product_id',v_after.canonical_product_id,
    'search_text_refreshed',true
  );
end
$$;

revoke all on function public.p1_apply_review_correction(bigint,uuid,uuid,jsonb,jsonb)
  from public,anon,authenticated;
grant execute on function public.p1_apply_review_correction(bigint,uuid,uuid,jsonb,jsonb)
  to service_role;

comment on function public.p1_apply_review_correction(bigint,uuid,uuid,jsonb,jsonb) is
  'P1.11a service-only tenant-safe correction promotion. Revalidates actor membership, updates linked commercial observation, recalculates canonical product identity/search text, and records append-only audit.';

-- Recover legacy review corrections saved by the old UI but never promoted.
do $$
declare
  r record;
  v_result jsonb;
begin
  for r in
    select rq.id,rq.owner_id,rq.organization_id,rq.corrected_values
    from public.commercial_review_queue rq
    where rq.status='corrected'
      and rq.corrected_values is not null
      and rq.observation_id is not null
      and not exists (
        select 1 from public.commercial_correction_events e where e.review_id=rq.id
      )
      and exists (
        select 1
        from public.organization_memberships m
        where m.organization_id=rq.organization_id
          and m.user_id=rq.owner_id
          and m.status='active'
          and m.role in ('admin','member')
      )
  loop
    select public.p1_apply_review_correction(
      r.id,r.owner_id,r.organization_id,r.corrected_values,
      jsonb_build_object('legacy_backfill',true)
    ) into v_result;
  end loop;
end
$$;
