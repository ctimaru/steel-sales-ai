-- P1.7 review fix: search identifies canonical products first, then aggregates their full tenant history.
-- This prevents a narrow query (for example an old price) from truncating lifecycle counts or latest-price metrics.
create or replace function public.p1_product_catalog(
  p_organization_id uuid,
  p_query text default null,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with params as (
  select
    nullif(btrim(coalesce(p_query, '')), '') as q,
    greatest(1, least(coalesce(p_limit, 100), 250)) as limit_value
),
tenant_observations as (
  select
    o.*,
    t.subject as thread_subject,
    t.last_activity_at as commercial_at
  from public.commercial_observations o
  join public.commercial_threads t
    on t.id = o.thread_id
   and t.organization_id = o.organization_id
  where o.organization_id = p_organization_id
    and o.canonical_product_id is not null
),
matching_products as (
  select distinct o.canonical_product_id
  from tenant_observations o
  cross join params p
  where p.q is null
     or coalesce(o.search_text, '') ilike '%' || p.q || '%'
     or coalesce(o.source_text, '') ilike '%' || p.q || '%'
     or coalesce(o.thread_subject, '') ilike '%' || p.q || '%'
     or coalesce(o.grade, '') ilike '%' || p.q || '%'
     or coalesce(o.standard, '') ilike '%' || p.q || '%'
     or coalesce(o.canonical_product_key, '') ilike '%' || replace(lower(p.q), ' ', '') || '%'
),
observations as (
  select o.*
  from tenant_observations o
  join matching_products m on m.canonical_product_id = o.canonical_product_id
),
grouped as (
  select
    min(o.canonical_product_id::text)::uuid as canonical_product_id,
    o.canonical_product_key,
    max(o.product_type) as product_type,
    max(o.grade) as grade,
    max(o.standard) as standard,
    max(o.material_number) as material_number,
    max(o.outer_diameter_mm) as outer_diameter_mm,
    max(o.width_mm) as width_mm,
    max(o.height_mm) as height_mm,
    max(o.thickness_mm) as thickness_mm,
    array_remove(array_agg(distinct o.length_mm order by o.length_mm), null) as observed_lengths_mm,
    count(*)::integer as event_count,
    count(*) filter (where o.item_role = 'requested')::integer as requested_count,
    count(*) filter (where o.item_role = 'offered')::integer as offered_count,
    count(*) filter (where o.item_role = 'ordered')::integer as ordered_count,
    count(*) filter (where o.item_role = 'delivered')::integer as delivered_count,
    count(distinct o.thread_id)::integer as thread_count,
    min(o.commercial_at) as first_event_at,
    max(o.commercial_at) as latest_event_at,
    (array_agg(o.price_value order by o.commercial_at desc, o.id desc)
      filter (where o.item_role = 'offered' and o.price_value is not null))[1] as latest_price_value,
    (array_agg(o.price_unit order by o.commercial_at desc, o.id desc)
      filter (where o.item_role = 'offered' and o.price_value is not null))[1] as latest_price_unit,
    (array_agg(o.currency order by o.commercial_at desc, o.id desc)
      filter (where o.item_role = 'offered' and o.price_value is not null))[1] as latest_currency,
    (array_agg(o.commercial_at order by o.commercial_at desc, o.id desc)
      filter (where o.item_role = 'offered' and o.price_value is not null))[1] as latest_price_at
  from observations o
  group by o.canonical_product_key
),
limited as (
  select g.*
  from grouped g
  order by g.latest_event_at desc nulls last, g.event_count desc, g.canonical_product_key
  limit (select limit_value from params)
)
select jsonb_build_object(
  'total', (select count(*) from grouped),
  'results', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'canonical_product_id', l.canonical_product_id,
        'canonical_product_key', l.canonical_product_key,
        'product_type', l.product_type,
        'grade', l.grade,
        'standard', l.standard,
        'material_number', l.material_number,
        'outer_diameter_mm', l.outer_diameter_mm,
        'width_mm', l.width_mm,
        'height_mm', l.height_mm,
        'thickness_mm', l.thickness_mm,
        'observed_lengths_mm', to_jsonb(l.observed_lengths_mm),
        'event_count', l.event_count,
        'requested_count', l.requested_count,
        'offered_count', l.offered_count,
        'ordered_count', l.ordered_count,
        'delivered_count', l.delivered_count,
        'thread_count', l.thread_count,
        'first_event_at', l.first_event_at,
        'latest_event_at', l.latest_event_at,
        'latest_price', case when l.latest_price_value is null then null else jsonb_build_object(
          'value', l.latest_price_value,
          'unit', l.latest_price_unit,
          'currency', l.latest_currency,
          'at', l.latest_price_at
        ) end
      )
      order by l.latest_event_at desc nulls last, l.event_count desc, l.canonical_product_key
    )
    from limited l
  ), '[]'::jsonb)
);
$$;

revoke all on function public.p1_product_catalog(uuid, text, integer)
  from public, anon, authenticated;
grant execute on function public.p1_product_catalog(uuid, text, integer)
  to service_role;

comment on function public.p1_product_catalog(uuid, text, integer) is
  'P1.7 tenant-scoped catalog: query selects canonical products, metrics aggregate their complete Commercial Memory history.';
