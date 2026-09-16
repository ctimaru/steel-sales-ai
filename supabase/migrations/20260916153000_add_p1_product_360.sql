-- P1.7 — Product 360 and canonical product history.
-- Internal RPCs are service-role only; the worker resolves the authenticated actor's active tenant.

create index if not exists commercial_observations_org_canonical_product_idx
  on public.commercial_observations (organization_id, canonical_product_id)
  where canonical_product_id is not null;

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
observations as (
  select
    o.*,
    t.subject as thread_subject,
    t.last_activity_at as commercial_at
  from public.commercial_observations o
  join public.commercial_threads t
    on t.id = o.thread_id
   and t.organization_id = o.organization_id
  cross join params p
  where o.organization_id = p_organization_id
    and o.canonical_product_id is not null
    and (
      p.q is null
      or coalesce(o.search_text, '') ilike '%' || p.q || '%'
      or coalesce(o.source_text, '') ilike '%' || p.q || '%'
      or coalesce(t.subject, '') ilike '%' || p.q || '%'
      or coalesce(o.grade, '') ilike '%' || p.q || '%'
      or coalesce(o.standard, '') ilike '%' || p.q || '%'
      or coalesce(o.canonical_product_key, '') ilike '%' || replace(lower(p.q), ' ', '') || '%'
    )
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
  'P1.7 tenant-scoped catalog of canonical steel products derived from Commercial Memory.';

create or replace function public.p1_product_360(
  p_organization_id uuid,
  p_product_id uuid,
  p_limit integer default 200
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with params as (
  select greatest(1, least(coalesce(p_limit, 200), 500)) as limit_value
),
observations as (
  select
    o.*,
    t.subject as thread_subject,
    t.classification as thread_classification,
    t.last_activity_at as commercial_at,
    c.id as company_id,
    c.name as company_name,
    c.company_type,
    c.country as company_country
  from public.commercial_observations o
  join public.commercial_threads t
    on t.id = o.thread_id
   and t.organization_id = o.organization_id
  left join public.conversations cv
    on cv.id = o.source_conversation_id
   and cv.organization_id = o.organization_id
  left join public.companies c
    on c.id = cv.company_id
   and c.organization_id = o.organization_id
  where o.organization_id = p_organization_id
    and o.canonical_product_id = p_product_id
),
product as (
  select
    min(o.canonical_product_id::text)::uuid as canonical_product_id,
    max(o.canonical_product_key) as canonical_product_key,
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
    max(o.commercial_at) as latest_event_at
  from observations o
),
price_rows as (
  select
    o.id as observation_id,
    o.thread_id,
    o.thread_subject,
    o.commercial_at,
    o.price_value,
    o.price_unit,
    o.currency,
    o.quantity,
    o.quantity_unit,
    o.source_filename,
    o.source_text,
    o.company_id,
    o.company_name,
    o.company_type,
    o.company_country
  from observations o
  where o.item_role = 'offered'
    and o.price_value is not null
  order by o.commercial_at desc nulls last, o.id desc
),
latest_price as (
  select * from price_rows limit 1
),
timeline_rows as (
  select
    o.id as observation_id,
    o.item_role,
    o.direction,
    case o.item_role
      when 'requested' then 'rfq'
      when 'offered' then 'offer'
      when 'ordered' then 'order'
      when 'delivered' then 'delivery'
      else 'commercial_event'
    end as event_type,
    o.commercial_at,
    o.thread_id,
    o.thread_subject,
    o.thread_classification,
    o.quantity,
    o.quantity_unit,
    o.price_value,
    o.price_unit,
    o.currency,
    o.availability_status,
    o.source_filename,
    left(coalesce(o.source_text, ''), 800) as source_text,
    o.confidence,
    o.company_id,
    o.company_name,
    o.company_type,
    o.company_country
  from observations o
  order by o.commercial_at desc nulls last, o.id desc
  limit (select limit_value from params)
),
price_stats as (
  select
    coalesce(o.currency, 'N/D') as currency,
    coalesce(o.price_unit, 'N/D') as price_unit,
    count(*)::integer as sample_count,
    min(o.price_value) as min_price,
    max(o.price_value) as max_price,
    avg(o.price_value)::numeric(18,4) as avg_price,
    min(o.commercial_at) as first_price_at,
    max(o.commercial_at) as latest_price_at
  from observations o
  where o.item_role = 'offered' and o.price_value is not null
  group by coalesce(o.currency, 'N/D'), coalesce(o.price_unit, 'N/D')
),
counterparties as (
  select
    o.company_id,
    o.company_name,
    o.company_type,
    o.company_country,
    count(*)::integer as event_count,
    max(o.commercial_at) as latest_event_at
  from observations o
  where o.company_id is not null
  group by o.company_id, o.company_name, o.company_type, o.company_country
),
documents as (
  select
    o.source_filename,
    count(*)::integer as observation_count,
    max(o.commercial_at) as latest_event_at,
    array_remove(array_agg(distinct o.item_role order by o.item_role), null) as roles,
    min(o.thread_id::text)::uuid as sample_thread_id
  from observations o
  where o.source_filename is not null and btrim(o.source_filename) <> ''
  group by o.source_filename
)
select case
  when not exists (select 1 from observations) then jsonb_build_object('found', false)
  else jsonb_build_object(
    'found', true,
    'product', (
      select jsonb_build_object(
        'canonical_product_id', p.canonical_product_id,
        'canonical_product_key', p.canonical_product_key,
        'product_type', p.product_type,
        'grade', p.grade,
        'standard', p.standard,
        'material_number', p.material_number,
        'outer_diameter_mm', p.outer_diameter_mm,
        'width_mm', p.width_mm,
        'height_mm', p.height_mm,
        'thickness_mm', p.thickness_mm,
        'observed_lengths_mm', to_jsonb(p.observed_lengths_mm)
      ) from product p
    ),
    'summary', (
      select jsonb_build_object(
        'event_count', p.event_count,
        'requested_count', p.requested_count,
        'offered_count', p.offered_count,
        'ordered_count', p.ordered_count,
        'delivered_count', p.delivered_count,
        'thread_count', p.thread_count,
        'first_event_at', p.first_event_at,
        'latest_event_at', p.latest_event_at
      ) from product p
    ),
    'latest_price', (
      select jsonb_build_object(
        'observation_id', lp.observation_id,
        'thread_id', lp.thread_id,
        'thread_subject', lp.thread_subject,
        'at', lp.commercial_at,
        'value', lp.price_value,
        'unit', lp.price_unit,
        'currency', lp.currency,
        'quantity', lp.quantity,
        'quantity_unit', lp.quantity_unit,
        'source_filename', lp.source_filename,
        'source_text', left(coalesce(lp.source_text, ''), 800),
        'company', case when lp.company_id is null then null else jsonb_build_object(
          'id', lp.company_id,
          'name', lp.company_name,
          'type', lp.company_type,
          'country', lp.company_country
        ) end
      ) from latest_price lp
    ),
    'price_history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'observation_id', pr.observation_id,
        'thread_id', pr.thread_id,
        'thread_subject', pr.thread_subject,
        'at', pr.commercial_at,
        'value', pr.price_value,
        'unit', pr.price_unit,
        'currency', pr.currency,
        'quantity', pr.quantity,
        'quantity_unit', pr.quantity_unit,
        'source_filename', pr.source_filename,
        'source_text', left(coalesce(pr.source_text, ''), 600),
        'company', case when pr.company_id is null then null else jsonb_build_object(
          'id', pr.company_id,
          'name', pr.company_name,
          'type', pr.company_type,
          'country', pr.company_country
        ) end
      ) order by pr.commercial_at desc nulls last, pr.observation_id desc)
      from price_rows pr
    ), '[]'::jsonb),
    'price_stats', coalesce((
      select jsonb_agg(to_jsonb(ps) order by ps.currency, ps.price_unit)
      from price_stats ps
    ), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(to_jsonb(tr) order by tr.commercial_at desc nulls last, tr.observation_id desc)
      from timeline_rows tr
    ), '[]'::jsonb),
    'counterparties', coalesce((
      select jsonb_agg(to_jsonb(cp) order by cp.event_count desc, cp.company_name)
      from counterparties cp
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.latest_event_at desc nulls last, d.source_filename)
      from documents d
    ), '[]'::jsonb)
  )
end;
$$;

revoke all on function public.p1_product_360(uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.p1_product_360(uuid, uuid, integer)
  to service_role;

comment on function public.p1_product_360(uuid, uuid, integer) is
  'P1.7 tenant-scoped Product 360: canonical identity, lifecycle counts, latest price, price history, timeline, counterparties and source documents.';
