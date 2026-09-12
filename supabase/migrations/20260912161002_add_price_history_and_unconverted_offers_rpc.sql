create index if not exists commercial_observations_owner_thread_ordered_idx
  on public.commercial_observations (owner_id, thread_id)
  where item_role = 'ordered';

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
  id bigint,
  owner_id uuid,
  thread_id uuid,
  grade text,
  standard text,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  thickness_mm numeric,
  length_mm numeric,
  quantity numeric,
  quantity_unit text,
  price_value numeric,
  price_unit text,
  currency text,
  source_text text,
  source_filename text,
  confidence numeric,
  commercial_at timestamptz,
  thread_subject text
)
language sql
security invoker
set search_path = ''
as $$
  select
    o.id,
    o.owner_id,
    o.thread_id,
    o.grade,
    o.standard,
    o.outer_diameter_mm,
    o.width_mm,
    o.height_mm,
    o.thickness_mm,
    o.length_mm,
    o.quantity,
    o.quantity_unit,
    o.price_value,
    o.price_unit,
    o.currency,
    o.source_text,
    o.source_filename,
    o.confidence,
    t.last_activity_at as commercial_at,
    t.subject as thread_subject
  from public.commercial_observations o
  join public.commercial_threads t
    on t.id = o.thread_id
   and t.owner_id = o.owner_id
  where o.owner_id = target_owner_id
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

revoke execute on function public.offered_price_history_for_owner(uuid, text, numeric, numeric, numeric, numeric, integer) from public;
revoke execute on function public.offered_price_history_for_owner(uuid, text, numeric, numeric, numeric, numeric, integer) from anon;
revoke execute on function public.offered_price_history_for_owner(uuid, text, numeric, numeric, numeric, numeric, integer) from authenticated;
grant execute on function public.offered_price_history_for_owner(uuid, text, numeric, numeric, numeric, numeric, integer) to service_role;

create or replace function public.offers_without_order_for_owner(
  target_owner_id uuid,
  target_grade text default null,
  target_since timestamptz default null,
  target_limit integer default 100
)
returns table (
  id bigint,
  owner_id uuid,
  thread_id uuid,
  grade text,
  standard text,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  thickness_mm numeric,
  length_mm numeric,
  quantity numeric,
  quantity_unit text,
  price_value numeric,
  price_unit text,
  currency text,
  source_text text,
  source_filename text,
  confidence numeric,
  offered_at timestamptz,
  thread_subject text
)
language sql
security invoker
set search_path = ''
as $$
  select
    o.id,
    o.owner_id,
    o.thread_id,
    o.grade,
    o.standard,
    o.outer_diameter_mm,
    o.width_mm,
    o.height_mm,
    o.thickness_mm,
    o.length_mm,
    o.quantity,
    o.quantity_unit,
    o.price_value,
    o.price_unit,
    o.currency,
    o.source_text,
    o.source_filename,
    o.confidence,
    t.last_activity_at as offered_at,
    t.subject as thread_subject
  from public.commercial_observations o
  join public.commercial_threads t
    on t.id = o.thread_id
   and t.owner_id = o.owner_id
  where o.owner_id = target_owner_id
    and o.item_role = 'offered'
    and (target_grade is null or upper(o.grade) = upper(target_grade))
    and (target_since is null or t.last_activity_at >= target_since)
    and not exists (
      select 1
      from public.commercial_observations ord
      where ord.owner_id = o.owner_id
        and ord.thread_id = o.thread_id
        and ord.item_role = 'ordered'
    )
  order by t.last_activity_at desc nulls last, o.id desc
  limit least(greatest(coalesce(target_limit, 100), 1), 200);
$$;

revoke execute on function public.offers_without_order_for_owner(uuid, text, timestamptz, integer) from public;
revoke execute on function public.offers_without_order_for_owner(uuid, text, timestamptz, integer) from anon;
revoke execute on function public.offers_without_order_for_owner(uuid, text, timestamptz, integer) from authenticated;
grant execute on function public.offers_without_order_for_owner(uuid, text, timestamptz, integer) to service_role;
