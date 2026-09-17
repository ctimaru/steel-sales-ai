-- P1.8 — Price History: quote/order separation, transparent unit normalization and deterministic comparables.
-- Internal RPC only: the worker resolves the actor's active organization before calling it.

create or replace function public.p1_price_history(
  p_organization_id uuid,
  p_product_id uuid,
  p_limit integer default 250,
  p_comparable_limit integer default 20
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
with params as (
  select
    greatest(1, least(coalesce(p_limit, 250), 500)) as history_limit,
    greatest(1, least(coalesce(p_comparable_limit, 20), 50)) as comparable_limit
),
target_observations as (
  select
    o.*,
    t.subject as thread_subject,
    coalesce(t.last_activity_at, o.created_at) as commercial_at,
    c.id as company_id,
    c.name as company_name,
    c.company_type,
    c.country as company_country,
    terms.delivery_term,
    terms.payment_terms
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
  left join lateral (
    select f.delivery_term, f.payment_terms
    from public.offers f
    where f.organization_id = o.organization_id
      and f.conversation_id = o.source_conversation_id
    order by f.offered_at desc nulls last, f.created_at desc, f.id desc
    limit 1
  ) terms on o.item_role = 'offered'
  where o.organization_id = p_organization_id
    and o.canonical_product_id = p_product_id
),
base_product as (
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
    max(o.thickness_mm) as thickness_mm
  from target_observations o
),
target_product as (
  select
    b.*,
    case
      when b.product_type = 'round_tube'
        and b.outer_diameter_mm is not null
        and b.thickness_mm is not null
        and b.outer_diameter_mm > 2 * b.thickness_mm
      then (pi() / 4.0 * (
        power(b.outer_diameter_mm, 2) - power(b.outer_diameter_mm - 2 * b.thickness_mm, 2)
      ) * 0.00785)::numeric(18,6)
      when b.product_type in ('rectangular_tube', 'square_tube')
        and b.width_mm is not null
        and b.height_mm is not null
        and b.thickness_mm is not null
        and b.width_mm > 2 * b.thickness_mm
        and b.height_mm > 2 * b.thickness_mm
      then ((
        b.width_mm * b.height_mm
        - (b.width_mm - 2 * b.thickness_mm) * (b.height_mm - 2 * b.thickness_mm)
      ) * 0.00785)::numeric(18,6)
      else null
    end as theoretical_weight_kg_m
  from base_product b
),
price_rows_base as (
  select
    o.id as observation_id,
    o.item_role,
    case o.item_role
      when 'offered' then 'quote'
      when 'ordered' then 'order'
      when 'requested' then 'rfq_reference'
      when 'delivered' then 'delivery_reference'
      else 'reference'
    end as price_kind,
    o.direction,
    o.thread_id,
    o.thread_subject,
    o.commercial_at,
    o.price_value,
    upper(nullif(btrim(coalesce(o.price_unit, '')), '')) as price_unit,
    upper(nullif(btrim(coalesce(o.currency, '')), '')) as currency,
    o.quantity,
    o.quantity_unit,
    o.discount_percentage,
    o.source_filename,
    left(coalesce(o.source_text, ''), 800) as source_text,
    o.confidence,
    o.company_id,
    o.company_name,
    o.company_type,
    o.company_country,
    o.delivery_term,
    o.payment_terms,
    tp.theoretical_weight_kg_m
  from target_observations o
  cross join target_product tp
  where o.price_value is not null
),
price_rows as (
  select
    p.*,
    case
      when p.price_unit = 'M' then p.price_value
      when p.price_unit = 'T' and p.theoretical_weight_kg_m > 0
        then p.price_value * p.theoretical_weight_kg_m / 1000.0
      when p.price_unit = 'KG' and p.theoretical_weight_kg_m > 0
        then p.price_value * p.theoretical_weight_kg_m
      else null
    end::numeric(18,4) as normalized_per_m,
    case
      when p.price_unit = 'T' then p.price_value
      when p.price_unit = 'KG' then p.price_value * 1000.0
      when p.price_unit = 'M' and p.theoretical_weight_kg_m > 0
        then p.price_value * 1000.0 / p.theoretical_weight_kg_m
      else null
    end::numeric(18,4) as normalized_per_tonne,
    case
      when p.price_unit in ('M', 'T', 'KG') and p.theoretical_weight_kg_m > 0
        then 'theoretical_section_weight'
      else 'raw_only'
    end as normalization_method,
    case when p.delivery_term is not null and btrim(p.delivery_term) <> ''
      then 'structured_offer_term' else 'not_structured' end as delivery_term_status
  from price_rows_base p
),
latest_quote as (
  select * from price_rows
  where price_kind = 'quote'
  order by commercial_at desc nulls last, observation_id desc
  limit 1
),
latest_order as (
  select * from price_rows
  where price_kind = 'order'
  order by commercial_at desc nulls last, observation_id desc
  limit 1
),
quote_trend_values as (
  select
    count(*)::integer as sample_count,
    (array_agg(p.normalized_per_tonne order by p.commercial_at desc nulls last, p.observation_id desc))[1] as latest_value,
    (array_agg(p.normalized_per_tonne order by p.commercial_at desc nulls last, p.observation_id desc))[2] as previous_value,
    max(lq.currency) as currency
  from price_rows p
  cross join latest_quote lq
  where p.price_kind = 'quote'
    and p.currency is not distinct from lq.currency
    and p.normalized_per_tonne is not null
),
order_trend_values as (
  select
    count(*)::integer as sample_count,
    (array_agg(p.normalized_per_tonne order by p.commercial_at desc nulls last, p.observation_id desc))[1] as latest_value,
    (array_agg(p.normalized_per_tonne order by p.commercial_at desc nulls last, p.observation_id desc))[2] as previous_value,
    max(lo.currency) as currency
  from price_rows p
  cross join latest_order lo
  where p.price_kind = 'order'
    and p.currency is not distinct from lo.currency
    and p.normalized_per_tonne is not null
),
price_stats as (
  select
    p.price_kind,
    coalesce(p.currency, 'N/D') as currency,
    count(*)::integer as sample_count,
    min(p.normalized_per_tonne) as min_per_tonne,
    max(p.normalized_per_tonne) as max_per_tonne,
    avg(p.normalized_per_tonne)::numeric(18,4) as avg_per_tonne,
    min(p.commercial_at) as first_price_at,
    max(p.commercial_at) as latest_price_at
  from price_rows p
  where p.price_kind in ('quote', 'order')
    and p.normalized_per_tonne is not null
  group by p.price_kind, coalesce(p.currency, 'N/D')
),
history_rows as (
  select p.*
  from price_rows p
  order by p.commercial_at desc nulls last, p.observation_id desc
  limit (select history_limit from params)
),
candidate_base as (
  select
    o.id as observation_id,
    o.canonical_product_id,
    o.canonical_product_key,
    o.product_type,
    o.grade,
    o.standard,
    o.material_number,
    o.outer_diameter_mm,
    o.width_mm,
    o.height_mm,
    o.thickness_mm,
    o.item_role,
    case o.item_role when 'offered' then 'quote' else 'order' end as price_kind,
    o.price_value,
    upper(nullif(btrim(coalesce(o.price_unit, '')), '')) as price_unit,
    upper(nullif(btrim(coalesce(o.currency, '')), '')) as currency,
    o.quantity,
    o.quantity_unit,
    o.thread_id,
    t.subject as thread_subject,
    coalesce(t.last_activity_at, o.created_at) as commercial_at,
    o.source_filename,
    left(coalesce(o.source_text, ''), 600) as source_text,
    c.id as company_id,
    c.name as company_name,
    case
      when o.product_type = 'round_tube'
        and o.outer_diameter_mm is not null
        and o.thickness_mm is not null
        and o.outer_diameter_mm > 2 * o.thickness_mm
      then (pi() / 4.0 * (
        power(o.outer_diameter_mm, 2) - power(o.outer_diameter_mm - 2 * o.thickness_mm, 2)
      ) * 0.00785)::numeric(18,6)
      when o.product_type in ('rectangular_tube', 'square_tube')
        and o.width_mm is not null
        and o.height_mm is not null
        and o.thickness_mm is not null
        and o.width_mm > 2 * o.thickness_mm
        and o.height_mm > 2 * o.thickness_mm
      then ((
        o.width_mm * o.height_mm
        - (o.width_mm - 2 * o.thickness_mm) * (o.height_mm - 2 * o.thickness_mm)
      ) * 0.00785)::numeric(18,6)
      else null
    end as theoretical_weight_kg_m
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
  cross join target_product tp
  where o.organization_id = p_organization_id
    and o.canonical_product_id is not null
    and o.canonical_product_id <> p_product_id
    and o.price_value is not null
    and o.item_role in ('offered', 'ordered')
    and o.product_type = tp.product_type
    and lower(coalesce(o.grade, '')) = lower(coalesce(tp.grade, ''))
),
candidate_normalized as (
  select
    c.*,
    case
      when c.price_unit = 'T' then c.price_value
      when c.price_unit = 'KG' then c.price_value * 1000.0
      when c.price_unit = 'M' and c.theoretical_weight_kg_m > 0
        then c.price_value * 1000.0 / c.theoretical_weight_kg_m
      else null
    end::numeric(18,4) as normalized_per_tonne
  from candidate_base c
),
candidate_similarity as (
  select
    c.*,
    case
      when tp.product_type = 'round_tube'
        and tp.outer_diameter_mm is not null and c.outer_diameter_mm is not null
      then greatest(0::numeric, 1 - abs(c.outer_diameter_mm - tp.outer_diameter_mm) / greatest(abs(tp.outer_diameter_mm), 1))
      when tp.product_type in ('rectangular_tube', 'square_tube')
        and tp.width_mm is not null and tp.height_mm is not null
        and c.width_mm is not null and c.height_mm is not null
      then (
        greatest(0::numeric, 1 - abs(c.width_mm - tp.width_mm) / greatest(abs(tp.width_mm), 1))
        + greatest(0::numeric, 1 - abs(c.height_mm - tp.height_mm) / greatest(abs(tp.height_mm), 1))
      ) / 2.0
      else 0::numeric
    end as geometry_similarity,
    case
      when tp.thickness_mm is not null and c.thickness_mm is not null
      then greatest(0::numeric, 1 - abs(c.thickness_mm - tp.thickness_mm) / greatest(abs(tp.thickness_mm), 1))
      else 0::numeric
    end as thickness_similarity,
    case
      when tp.standard is not null and c.standard is not null
        and lower(tp.standard) = lower(c.standard) then 15::numeric
      when tp.standard is null or c.standard is null then 5::numeric
      else 0::numeric
    end as standard_score
  from candidate_normalized c
  cross join target_product tp
  where c.normalized_per_tonne is not null
),
candidate_scored as (
  select
    c.*,
    (50 + c.standard_score + 20 * c.geometry_similarity + 15 * c.thickness_similarity)::numeric(6,2) as comparability_score,
    row_number() over (
      partition by c.canonical_product_id, c.item_role
      order by c.commercial_at desc nulls last, c.observation_id desc
    ) as kind_rank
  from candidate_similarity c
),
comparable_rows as (
  select c.*
  from candidate_scored c
  where c.kind_rank = 1
  order by c.comparability_score desc, c.commercial_at desc nulls last, c.observation_id desc
  limit (select comparable_limit from params)
)
select case
  when not exists (select 1 from target_observations) then jsonb_build_object('found', false)
  else jsonb_build_object(
    'found', true,
    'product', (
      select jsonb_build_object(
        'canonical_product_id', tp.canonical_product_id,
        'canonical_product_key', tp.canonical_product_key,
        'product_type', tp.product_type,
        'grade', tp.grade,
        'standard', tp.standard,
        'material_number', tp.material_number,
        'outer_diameter_mm', tp.outer_diameter_mm,
        'width_mm', tp.width_mm,
        'height_mm', tp.height_mm,
        'thickness_mm', tp.thickness_mm,
        'theoretical_weight_kg_m', tp.theoretical_weight_kg_m,
        'weight_method', case when tp.theoretical_weight_kg_m is null then 'unavailable' else 'simplified_section_theoretical' end
      ) from target_product tp
    ),
    'latest_quote', (
      select jsonb_build_object(
        'observation_id', q.observation_id, 'price_kind', q.price_kind,
        'at', q.commercial_at, 'value', q.price_value, 'unit', q.price_unit, 'currency', q.currency,
        'normalized_per_m', q.normalized_per_m, 'normalized_per_tonne', q.normalized_per_tonne,
        'normalization_method', q.normalization_method,
        'quantity', q.quantity, 'quantity_unit', q.quantity_unit,
        'delivery_term', q.delivery_term, 'delivery_term_status', q.delivery_term_status,
        'payment_terms', q.payment_terms,
        'thread_id', q.thread_id, 'thread_subject', q.thread_subject,
        'source_filename', q.source_filename, 'source_text', q.source_text,
        'company', case when q.company_id is null then null else jsonb_build_object('id', q.company_id, 'name', q.company_name, 'type', q.company_type, 'country', q.company_country) end
      ) from latest_quote q
    ),
    'latest_order', (
      select jsonb_build_object(
        'observation_id', o.observation_id, 'price_kind', o.price_kind,
        'at', o.commercial_at, 'value', o.price_value, 'unit', o.price_unit, 'currency', o.currency,
        'normalized_per_m', o.normalized_per_m, 'normalized_per_tonne', o.normalized_per_tonne,
        'normalization_method', o.normalization_method,
        'quantity', o.quantity, 'quantity_unit', o.quantity_unit,
        'delivery_term', o.delivery_term, 'delivery_term_status', o.delivery_term_status,
        'payment_terms', o.payment_terms,
        'thread_id', o.thread_id, 'thread_subject', o.thread_subject,
        'source_filename', o.source_filename, 'source_text', o.source_text,
        'company', case when o.company_id is null then null else jsonb_build_object('id', o.company_id, 'name', o.company_name, 'type', o.company_type, 'country', o.company_country) end
      ) from latest_order o
    ),
    'trend', jsonb_build_object(
      'quote', (
        select case when q.sample_count = 0 then null else jsonb_build_object(
          'sample_count', q.sample_count, 'currency', q.currency, 'normalized_unit', 'T',
          'latest_value', q.latest_value, 'previous_value', q.previous_value,
          'delta_value', case when q.previous_value is null then null else q.latest_value - q.previous_value end,
          'delta_pct', case when q.previous_value is null or q.previous_value = 0 then null else ((q.latest_value - q.previous_value) / q.previous_value * 100)::numeric(10,2) end,
          'direction', case when q.previous_value is null then 'insufficient_data' when q.latest_value > q.previous_value then 'up' when q.latest_value < q.previous_value then 'down' else 'flat' end
        ) end from quote_trend_values q
      ),
      'order', (
        select case when o.sample_count = 0 then null else jsonb_build_object(
          'sample_count', o.sample_count, 'currency', o.currency, 'normalized_unit', 'T',
          'latest_value', o.latest_value, 'previous_value', o.previous_value,
          'delta_value', case when o.previous_value is null then null else o.latest_value - o.previous_value end,
          'delta_pct', case when o.previous_value is null or o.previous_value = 0 then null else ((o.latest_value - o.previous_value) / o.previous_value * 100)::numeric(10,2) end,
          'direction', case when o.previous_value is null then 'insufficient_data' when o.latest_value > o.previous_value then 'up' when o.latest_value < o.previous_value then 'down' else 'flat' end
        ) end from order_trend_values o
      )
    ),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'observation_id', h.observation_id, 'item_role', h.item_role, 'price_kind', h.price_kind,
        'at', h.commercial_at, 'value', h.price_value, 'unit', h.price_unit, 'currency', h.currency,
        'normalized_per_m', h.normalized_per_m, 'normalized_per_tonne', h.normalized_per_tonne,
        'normalization_method', h.normalization_method,
        'quantity', h.quantity, 'quantity_unit', h.quantity_unit,
        'discount_percentage', h.discount_percentage,
        'delivery_term', h.delivery_term, 'delivery_term_status', h.delivery_term_status,
        'payment_terms', h.payment_terms,
        'thread_id', h.thread_id, 'thread_subject', h.thread_subject,
        'source_filename', h.source_filename, 'source_text', h.source_text, 'confidence', h.confidence,
        'company', case when h.company_id is null then null else jsonb_build_object('id', h.company_id, 'name', h.company_name, 'type', h.company_type, 'country', h.company_country) end
      ) order by h.commercial_at desc nulls last, h.observation_id desc)
      from history_rows h
    ), '[]'::jsonb),
    'stats', coalesce((select jsonb_agg(to_jsonb(s) order by s.price_kind, s.currency) from price_stats s), '[]'::jsonb),
    'comparables', coalesce((
      select jsonb_agg(jsonb_build_object(
        'canonical_product_id', c.canonical_product_id,
        'canonical_product_key', c.canonical_product_key,
        'product_type', c.product_type, 'grade', c.grade, 'standard', c.standard,
        'outer_diameter_mm', c.outer_diameter_mm, 'width_mm', c.width_mm, 'height_mm', c.height_mm, 'thickness_mm', c.thickness_mm,
        'price_kind', c.price_kind, 'at', c.commercial_at,
        'value', c.price_value, 'unit', c.price_unit, 'currency', c.currency,
        'normalized_per_tonne', c.normalized_per_tonne,
        'theoretical_weight_kg_m', c.theoretical_weight_kg_m,
        'quantity', c.quantity, 'quantity_unit', c.quantity_unit,
        'comparability_score', c.comparability_score,
        'comparability_tier', case when c.comparability_score >= 90 then 'high' when c.comparability_score >= 75 then 'medium' else 'contextual' end,
        'reasons', to_jsonb(array_remove(array[
          'stessa famiglia prodotto',
          'stessa qualità',
          case when c.standard_score = 15 then 'stessa norma' when c.standard_score = 5 then 'norma parzialmente non strutturata' else 'norma differente' end,
          case when c.geometry_similarity >= 0.90 then 'geometria molto vicina' when c.geometry_similarity >= 0.75 then 'geometria vicina' else 'geometria della stessa famiglia' end,
          case when c.thickness_similarity >= 0.90 then 'spessore molto vicino' when c.thickness_similarity >= 0.75 then 'spessore vicino' else 'spessore differente' end
        ]::text[], null)),
        'difference_vs_target_pct', case
          when c.price_kind = 'quote'
            and exists (select 1 from latest_quote q where q.currency is not distinct from c.currency and q.normalized_per_tonne is not null and q.normalized_per_tonne <> 0)
          then ((c.normalized_per_tonne - (select q.normalized_per_tonne from latest_quote q)) / (select q.normalized_per_tonne from latest_quote q) * 100)::numeric(10,2)
          when c.price_kind = 'order'
            and exists (select 1 from latest_order o where o.currency is not distinct from c.currency and o.normalized_per_tonne is not null and o.normalized_per_tonne <> 0)
          then ((c.normalized_per_tonne - (select o.normalized_per_tonne from latest_order o)) / (select o.normalized_per_tonne from latest_order o) * 100)::numeric(10,2)
          else null end,
        'thread_id', c.thread_id, 'thread_subject', c.thread_subject,
        'source_filename', c.source_filename, 'source_text', c.source_text,
        'company', case when c.company_id is null then null else jsonb_build_object('id', c.company_id, 'name', c.company_name) end
      ) order by c.comparability_score desc, c.commercial_at desc nulls last, c.observation_id desc)
      from comparable_rows c
    ), '[]'::jsonb),
    'comparability_policy', jsonb_build_object(
      'required', jsonb_build_array('same_product_family', 'same_grade'),
      'score', '50 base + 15 standard + 20 geometry similarity + 15 thickness similarity',
      'high_threshold', 90, 'medium_threshold', 75,
      'currency_policy', 'never_fx_convert',
      'normalization_policy', 'M/T/KG only; cross-unit values use simplified theoretical section weight'
    ),
    'data_quality', jsonb_build_object(
      'counterparty_policy', 'shown only when a structured company link exists',
      'delivery_term_policy', 'shown only from structured offers.delivery_term; never inferred from source text',
      'normalization_warning', 'theoretical kg/m ignores manufacturing tolerances and rectangular corner radii; raw price remains authoritative'
    )
  )
end;
$$;

revoke all on function public.p1_price_history(uuid, uuid, integer, integer)
  from public, anon, authenticated;
grant execute on function public.p1_price_history(uuid, uuid, integer, integer)
  to service_role;

comment on function public.p1_price_history(uuid, uuid, integer, integer) is
  'P1.8 tenant-scoped price history: quote/order separation, transparent M/T normalization, trends, evidence and deterministic steel-product comparables.';
