-- PL1.6 — rely on existing PL1 RLS for preview authorization; remove executable SECURITY DEFINER bridge.

begin;

create or replace function public.pl1_price_list_catalog(
  p_include_internal boolean default false
)
returns table(
  version_id uuid,
  price_list_id uuid,
  list_name text,
  list_code text,
  manufacturer_version_code text,
  manufacturer_revision_code text,
  source_date date,
  version_status text,
  publication_scope text,
  currency_code text,
  default_price_unit text,
  source_terms_raw text,
  item_count bigint,
  price_per_t_ready_count bigint,
  shape_codes text[],
  grade_codes text[],
  finish_codes text[],
  pricing_formula text,
  is_internal_preview boolean,
  published_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    v.id as version_id,
    pl.id as price_list_id,
    pl.name as list_name,
    pl.code as list_code,
    v.manufacturer_version_code,
    v.manufacturer_revision_code,
    v.source_date,
    v.status as version_status,
    v.publication_scope,
    pl.currency_code,
    pl.default_price_unit,
    pl.source_terms_raw,
    count(distinct i.id) as item_count,
    count(distinct i.id) filter (where ready.price_per_t_ready) as price_per_t_ready_count,
    coalesce(
      array_agg(distinct s.shape_code order by s.shape_code)
        filter (where s.shape_code is not null),
      array[]::text[]
    ) as shape_codes,
    coalesce(
      array_agg(distinct s.grade_code order by s.grade_code)
        filter (where s.grade_code is not null),
      array[]::text[]
    ) as grade_codes,
    coalesce(
      array_agg(distinct s.finish_code order by s.finish_code)
        filter (where s.finish_code is not null),
      array[]::text[]
    ) as finish_codes,
    (
      select r.rule_payload->>'formula'
      from public.price_rules r
      where r.price_list_version_id=v.id
        and r.rule_type='commercial_discount'
        and r.status='active'
      order by r.calculation_order, r.id
      limit 1
    ) as pricing_formula,
    not (
      v.status='published'
      and v.publication_scope='public'
    ) as is_internal_preview,
    v.published_at
  from public.price_list_versions v
  join public.price_lists pl on pl.id=v.price_list_id
  join public.price_list_sections s on s.price_list_version_id=v.id
  join public.price_list_items i on i.section_id=s.id and i.status='active'
  left join public.price_list_item_pricing_readiness ready
    on ready.price_list_item_id=i.id
  where
    v.status='published'
    or (
      p_include_internal
      and v.status in ('draft','review','verified')
    )
  group by
    v.id,
    pl.id,
    pl.name,
    pl.code,
    v.manufacturer_version_code,
    v.manufacturer_revision_code,
    v.source_date,
    v.status,
    v.publication_scope,
    pl.currency_code,
    pl.default_price_unit,
    pl.source_terms_raw,
    v.published_at
  order by coalesce(v.source_date, v.created_at::date) desc, v.created_at desc;
$$;

create or replace function public.pl1_price_list_explorer_items(
  p_version_id uuid,
  p_include_internal boolean default false
)
returns table(
  item_id uuid,
  section_id uuid,
  shape_code text,
  standard_code text,
  standard_raw text,
  grade_code text,
  grade_raw text,
  finish_code text,
  finish_raw text,
  dimension_label text,
  thickness_mm numeric,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  base_eur_m numeric,
  fixed_extra_eur_m numeric,
  price_per_m_ready boolean,
  resolved_weight_kg_m numeric,
  price_per_t_status text,
  price_per_t_ready boolean,
  weight_resolution_mode text,
  note_raw text,
  source_page integer,
  section_sort_order integer,
  row_sort_order integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with allowed as (
    select v.id
    from public.price_list_versions v
    where v.id=p_version_id
      and (
        v.status='published'
        or (
          p_include_internal
          and v.status in ('draft','review','verified')
        )
      )
  )
  select
    i.id as item_id,
    s.id as section_id,
    s.shape_code,
    s.standard_code,
    s.standard_raw,
    s.grade_code,
    s.grade_raw,
    s.finish_code,
    s.finish_raw,
    i.dimension_label_raw as dimension_label,
    i.thickness_mm,
    i.outer_diameter_mm,
    i.width_mm,
    i.height_mm,
    max(c.amount) filter (where c.component_type='base') as base_eur_m,
    max(c.amount) filter (where c.component_type='fixed_extra') as fixed_extra_eur_m,
    coalesce(ready.price_per_m_ready,false) as price_per_m_ready,
    ready.resolved_weight_kg_m,
    coalesce(ready.price_per_t_status,'missing_weight_link') as price_per_t_status,
    coalesce(ready.price_per_t_ready,false) as price_per_t_ready,
    ready.weight_resolution_mode,
    i.note_raw,
    nullif(i.source_locator->>'page','')::integer as source_page,
    s.sort_order as section_sort_order,
    coalesce(i.source_row_index,0) as row_sort_order
  from allowed a
  join public.price_list_sections s on s.price_list_version_id=a.id
  join public.price_list_items i on i.section_id=s.id and i.status='active'
  join public.price_list_components c on c.price_list_item_id=i.id
  left join public.price_list_item_pricing_readiness ready
    on ready.price_list_item_id=i.id
  group by
    i.id,
    s.id,
    s.shape_code,
    s.standard_code,
    s.standard_raw,
    s.grade_code,
    s.grade_raw,
    s.finish_code,
    s.finish_raw,
    i.dimension_label_raw,
    i.thickness_mm,
    i.outer_diameter_mm,
    i.width_mm,
    i.height_mm,
    ready.price_per_m_ready,
    ready.resolved_weight_kg_m,
    ready.price_per_t_status,
    ready.price_per_t_ready,
    ready.weight_resolution_mode,
    i.note_raw,
    i.source_locator,
    s.sort_order,
    i.source_row_index
  having
    count(*) filter (where c.component_type='base')=1
    and count(*) filter (where c.component_type='fixed_extra')=1
  order by s.sort_order, coalesce(i.source_row_index,0), i.dimension_label_raw;
$$;

drop function if exists public.pl1_can_preview_internal();

commit;
