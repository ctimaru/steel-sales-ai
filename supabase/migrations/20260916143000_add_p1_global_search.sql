-- P1.4 — Global Search: structured + semantic + steel filters.
-- Structured search is service-role only. The worker resolves the actor's active tenant
-- before supplying p_organization_id. Semantic retrieval remains grounded in M5 hybrid RRF.

create or replace function public.p1_global_structured_search(
  p_organization_id uuid,
  p_query text default null,
  p_types text[] default null,
  p_filters jsonb default '{}'::jsonb,
  p_limit integer default 50
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
    coalesce(p_types, array[]::text[]) as types,
    coalesce(p_filters, '{}'::jsonb) as filters,
    greatest(1, least(coalesce(p_limit, 50), 100)) as limit_value
),
observations as (
  select
    o.*,
    t.subject as thread_subject,
    t.classification as thread_classification,
    t.last_activity_at as commercial_at
  from public.commercial_observations o
  join public.commercial_threads t
    on t.id = o.thread_id
   and t.organization_id = o.organization_id
  cross join params p
  where o.organization_id = p_organization_id
    and (
      p.q is null
      or coalesce(o.search_text, '') ilike '%' || p.q || '%'
      or coalesce(o.source_text, '') ilike '%' || p.q || '%'
      or coalesce(o.source_filename, '') ilike '%' || p.q || '%'
      or coalesce(t.subject, '') ilike '%' || p.q || '%'
      or coalesce(o.grade, '') ilike '%' || p.q || '%'
      or coalesce(o.standard, '') ilike '%' || p.q || '%'
      or coalesce(o.canonical_product_key, '') ilike '%' || replace(lower(p.q), ' ', '') || '%'
    )
    and (not (p.filters ? 'item_role') or lower(coalesce(o.item_role, '')) = lower(p.filters ->> 'item_role'))
    and (not (p.filters ? 'grade') or upper(coalesce(o.grade, '')) = upper(p.filters ->> 'grade'))
    and (not (p.filters ? 'standard') or replace(upper(coalesce(o.standard, '')), ' ', '') = replace(upper(p.filters ->> 'standard'), ' ', ''))
    and (not (p.filters ? 'outer_diameter_mm') or o.outer_diameter_mm = (p.filters ->> 'outer_diameter_mm')::numeric)
    and (not (p.filters ? 'width_mm') or o.width_mm = (p.filters ->> 'width_mm')::numeric)
    and (not (p.filters ? 'height_mm') or o.height_mm = (p.filters ->> 'height_mm')::numeric)
    and (not (p.filters ? 'thickness_mm') or o.thickness_mm = (p.filters ->> 'thickness_mm')::numeric)
    and (not (p.filters ? 'length_mm') or o.length_mm = (p.filters ->> 'length_mm')::numeric)
    and (not (p.filters ? 'price_min') or o.price_value >= (p.filters ->> 'price_min')::numeric)
    and (not (p.filters ? 'price_max') or o.price_value <= (p.filters ->> 'price_max')::numeric)
    and (not (p.filters ? 'currency') or upper(coalesce(o.currency, '')) = upper(p.filters ->> 'currency'))
    and (not (p.filters ? 'date_from') or t.last_activity_at::date >= (p.filters ->> 'date_from')::date)
    and (not (p.filters ? 'date_to') or t.last_activity_at::date <= (p.filters ->> 'date_to')::date)
    and (
      not (p.filters ? 'source')
      or coalesce(o.source_filename, '') ilike '%' || (p.filters ->> 'source') || '%'
    )
    and (
      not (p.filters ? 'company')
      or exists (
        select 1
        from public.knowledge_entity_mentions m
        join public.knowledge_entities e
          on e.id = m.entity_id
         and e.entity_type = 'company'
        where m.observation_id = o.id
          and (
            e.access_scope = 'global'
            or e.organization_id = p_organization_id
          )
          and (
            e.canonical_name ilike '%' || (p.filters ->> 'company') || '%'
            or exists (
              select 1 from public.knowledge_entity_aliases a
              where a.entity_id = e.id
                and a.alias ilike '%' || (p.filters ->> 'company') || '%'
            )
          )
      )
    )
),
events as (
  select
    case o.item_role
      when 'requested' then 'rfq'
      when 'offered' then 'offer'
      when 'ordered' then 'order'
      when 'delivered' then 'delivery'
      else 'commercial_event'
    end as result_type,
    'observation:' || o.id::text as result_id,
    coalesce(nullif(o.thread_subject, ''), nullif(o.source_filename, ''), 'Evento commerciale') as title,
    concat_ws(' · ', nullif(o.grade, ''), nullif(o.standard, ''),
      case
        when o.product_type = 'round_tube' then concat('Ø ', o.outer_diameter_mm, ' × ', o.thickness_mm, ' mm')
        when o.product_type in ('square_tube','rectangular_tube') then concat(o.width_mm, ' × ', o.height_mm, ' × ', o.thickness_mm, ' mm')
        else nullif(o.product_type, '')
      end
    ) as subtitle,
    left(coalesce(nullif(o.source_text, ''), nullif(o.source_filename, ''), ''), 500) as snippet,
    o.commercial_at as event_at,
    o.item_role as role,
    o.grade,
    o.standard,
    o.product_type,
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
    o.source_filename,
    o.thread_id,
    0.90::double precision as score,
    jsonb_build_object(
      'observation_id', o.id,
      'classification', o.thread_classification,
      'canonical_product_key', o.canonical_product_key,
      'confidence', o.confidence,
      'availability_status', o.availability_status
    ) as metadata
  from observations o
  cross join params p
  where cardinality(p.types) = 0
     or (o.item_role = 'requested' and 'rfq' = any(p.types))
     or (o.item_role = 'offered' and 'offer' = any(p.types))
     or (o.item_role = 'ordered' and 'order' = any(p.types))
     or (o.item_role = 'delivered' and 'delivery' = any(p.types))
),
product_groups as (
  select
    'product'::text as result_type,
    'product:' || md5(o.canonical_product_key) as result_id,
    case
      when max(o.product_type) = 'round_tube' then concat('Tubo tondo Ø ', max(o.outer_diameter_mm), ' × ', max(o.thickness_mm), ' mm')
      when max(o.product_type) = 'square_tube' then concat('Tubo quadro ', max(o.width_mm), ' × ', max(o.height_mm), ' × ', max(o.thickness_mm), ' mm')
      when max(o.product_type) = 'rectangular_tube' then concat('Tubo rettangolare ', max(o.width_mm), ' × ', max(o.height_mm), ' × ', max(o.thickness_mm), ' mm')
      else coalesce(max(o.product_type), 'Prodotto')
    end as title,
    concat_ws(' · ', nullif(max(o.grade), ''), nullif(max(o.standard), ''), count(*)::text || ' occorrenze') as subtitle,
    left(max(o.source_text), 500) as snippet,
    max(o.commercial_at) as event_at,
    null::text as role,
    max(o.grade) as grade,
    max(o.standard) as standard,
    max(o.product_type) as product_type,
    max(o.outer_diameter_mm) as outer_diameter_mm,
    max(o.width_mm) as width_mm,
    max(o.height_mm) as height_mm,
    max(o.thickness_mm) as thickness_mm,
    max(o.length_mm) as length_mm,
    null::numeric as quantity,
    null::text as quantity_unit,
    max(o.price_value) filter (where o.price_value is not null) as price_value,
    max(o.price_unit) filter (where o.price_value is not null) as price_unit,
    max(o.currency) filter (where o.price_value is not null) as currency,
    max(o.source_filename) as source_filename,
    null::uuid as thread_id,
    0.82::double precision as score,
    jsonb_build_object(
      'canonical_product_key', o.canonical_product_key,
      'occurrences', count(*),
      'requested', count(*) filter (where o.item_role = 'requested'),
      'offered', count(*) filter (where o.item_role = 'offered'),
      'ordered', count(*) filter (where o.item_role = 'ordered'),
      'delivered', count(*) filter (where o.item_role = 'delivered')
    ) as metadata
  from observations o
  cross join params p
  where o.canonical_product_key is not null
    and (cardinality(p.types) = 0 or 'product' = any(p.types))
  group by o.canonical_product_key
),
company_rows as (
  select
    'company'::text as result_type,
    'company:' || c.id::text as result_id,
    c.name as title,
    concat_ws(' · ', nullif(c.company_type, ''), nullif(c.country, '')) as subtitle,
    left(coalesce(c.notes, ''), 500) as snippet,
    c.updated_at as event_at,
    null::text as role,
    null::text as grade,
    null::text as standard,
    null::text as product_type,
    null::numeric as outer_diameter_mm,
    null::numeric as width_mm,
    null::numeric as height_mm,
    null::numeric as thickness_mm,
    null::numeric as length_mm,
    null::numeric as quantity,
    null::text as quantity_unit,
    null::numeric as price_value,
    null::text as price_unit,
    null::text as currency,
    null::text as source_filename,
    null::uuid as thread_id,
    0.80::double precision as score,
    jsonb_build_object('company_id', c.id, 'company_type', c.company_type, 'country', c.country, 'website', c.website) as metadata
  from public.companies c
  cross join params p
  where c.organization_id = p_organization_id
    and (cardinality(p.types) = 0 or 'company' = any(p.types))
    and (p.q is null or c.name ilike '%' || p.q || '%' or coalesce(c.notes, '') ilike '%' || p.q || '%')
    and (not (p.filters ? 'company') or c.name ilike '%' || (p.filters ->> 'company') || '%')
    -- Do not claim company/product relationships until normalized company links exist.
    and not (p.filters ?| array['grade','standard','outer_diameter_mm','width_mm','height_mm','thickness_mm','length_mm','price_min','price_max','currency','source'])
),
all_results as (
  select * from events
  union all
  select * from product_groups
  union all
  select * from company_rows
),
counts as (
  select result_type, count(*)::integer as count
  from all_results
  group by result_type
),
limited as (
  select *
  from all_results
  order by score desc, event_at desc nulls last, result_id
  limit (select limit_value from params)
)
select jsonb_build_object(
  'counts', coalesce((select jsonb_object_agg(result_type, count) from counts), '{}'::jsonb),
  'results', coalesce((select jsonb_agg(to_jsonb(l) order by l.score desc, l.event_at desc nulls last, l.result_id) from limited l), '[]'::jsonb),
  'total', (select count(*) from all_results)
);
$$;

revoke all on function public.p1_global_structured_search(uuid, text, text[], jsonb, integer)
  from public, anon, authenticated;
grant execute on function public.p1_global_structured_search(uuid, text, text[], jsonb, integer)
  to service_role;

comment on function public.p1_global_structured_search(uuid, text, text[], jsonb, integer) is
  'P1.4 tenant-scoped structured search across commercial events, canonical product signatures and normalized companies.';

-- Extend the M5.6 wrapper with price/currency and friendly source filters while preserving
-- the existing signature used by the worker and regression suite.
create or replace function public.hybrid_search_knowledge_filtered(
  p_owner_id uuid,
  p_query_text text,
  p_query_embedding real[],
  p_match_count integer default 10,
  p_candidate_count integer default 60,
  p_entity_filters jsonb default '{}'::jsonb,
  p_commercial_filters jsonb default '{}'::jsonb,
  p_document_filters jsonb default '{}'::jsonb,
  p_rrf_k integer default 60
)
returns table(
  chunk_id uuid,
  source_id uuid,
  document_id uuid,
  content text,
  language_code text,
  title text,
  filename text,
  document_type text,
  source_name text,
  source_class text,
  source_uri text,
  page_start integer,
  page_end integer,
  section_path text[],
  source_locator jsonb,
  chunk_metadata jsonb,
  vector_similarity double precision,
  lexical_score double precision,
  entity_match_count integer,
  rrf_score double precision,
  matched_entities jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with tenant as (
    select public.default_organization_for_user(p_owner_id) as organization_id
  )
  select h.*
  from public.hybrid_search_knowledge(
    p_owner_id,
    p_query_text,
    p_query_embedding,
    50,
    greatest(120, least(p_candidate_count, 250)),
    coalesce(p_entity_filters, '{}'::jsonb),
    coalesce(p_commercial_filters, '{}'::jsonb) - 'price_min' - 'price_max' - 'currency',
    p_rrf_k
  ) h
  join public.knowledge_documents d on d.id = h.document_id
  join public.knowledge_sources s on s.id = h.source_id
  left join public.commercial_observations o
    on o.id = case
      when coalesce(h.source_locator ->> 'observation_id', '') ~ '^[0-9]+$'
        then (h.source_locator ->> 'observation_id')::bigint
      else null
    end
   and o.organization_id = (select organization_id from tenant)
  where
    (not (coalesce(p_document_filters, '{}'::jsonb) ? 'source_class') or lower(coalesce(s.source_class, '')) = lower(p_document_filters ->> 'source_class'))
    and (not (coalesce(p_document_filters, '{}'::jsonb) ? 'source_type') or lower(coalesce(s.source_type, '')) = lower(p_document_filters ->> 'source_type'))
    and (not (coalesce(p_document_filters, '{}'::jsonb) ? 'document_type') or lower(coalesce(d.document_type, '')) = lower(p_document_filters ->> 'document_type'))
    and (not (coalesce(p_document_filters, '{}'::jsonb) ? 'document_id') or d.id = (p_document_filters ->> 'document_id')::uuid)
    and (
      not (coalesce(p_document_filters, '{}'::jsonb) ? 'document_query')
      or coalesce(d.title, '') ilike '%' || (p_document_filters ->> 'document_query') || '%'
      or coalesce(d.filename, '') ilike '%' || (p_document_filters ->> 'document_query') || '%'
      or coalesce(s.name, '') ilike '%' || (p_document_filters ->> 'document_query') || '%'
    )
    and (
      not (coalesce(p_document_filters, '{}'::jsonb) ? 'source_query')
      or coalesce(s.name, '') ilike '%' || (p_document_filters ->> 'source_query') || '%'
      or coalesce(d.filename, '') ilike '%' || (p_document_filters ->> 'source_query') || '%'
      or coalesce(d.source_uri, s.source_uri, '') ilike '%' || (p_document_filters ->> 'source_query') || '%'
    )
    and (not (coalesce(p_document_filters, '{}'::jsonb) ? 'date_from') or coalesce(d.published_at, d.fetched_at, d.extracted_at, d.created_at)::date >= (p_document_filters ->> 'date_from')::date)
    and (not (coalesce(p_document_filters, '{}'::jsonb) ? 'date_to') or coalesce(d.published_at, d.fetched_at, d.extracted_at, d.created_at)::date <= (p_document_filters ->> 'date_to')::date)
    and (not (coalesce(p_commercial_filters, '{}'::jsonb) ? 'price_min') or o.price_value >= (p_commercial_filters ->> 'price_min')::numeric)
    and (not (coalesce(p_commercial_filters, '{}'::jsonb) ? 'price_max') or o.price_value <= (p_commercial_filters ->> 'price_max')::numeric)
    and (not (coalesce(p_commercial_filters, '{}'::jsonb) ? 'currency') or upper(coalesce(o.currency, '')) = upper(p_commercial_filters ->> 'currency'))
  order by h.rrf_score desc, h.vector_similarity desc nulls last, h.lexical_score desc nulls last
  limit greatest(1, least(p_match_count, 50));
$$;

revoke execute on function public.hybrid_search_knowledge_filtered(uuid,text,real[],integer,integer,jsonb,jsonb,jsonb,integer)
  from public, anon, authenticated;
grant execute on function public.hybrid_search_knowledge_filtered(uuid,text,real[],integer,integer,jsonb,jsonb,jsonb,integer)
  to service_role;
