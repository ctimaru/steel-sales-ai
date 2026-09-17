-- P1.15 / SK4 — Shared Steel Knowledge read contract + deterministic reference pricing.
--
-- This API is intentionally tenant-independent because the underlying catalog is global.
-- It is authenticated-only, security-invoker, and never persists a calculated price.
-- Reference €/m = kg/m × €/t ÷ 1000.

create or replace function public.p1_shared_steel_standards(
  p_query text default null,
  p_status text default 'active',
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  standard_id uuid,
  code text,
  title text,
  short_explanation text,
  scope_summary text,
  issuing_body text,
  edition text,
  valid_from date,
  valid_to date,
  status text,
  product_families text[],
  grades jsonb,
  source_name text,
  source_provider text,
  source_uri text,
  source_class text,
  source_locator jsonb,
  metadata jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id as standard_id,
    s.code,
    s.title,
    s.short_explanation,
    s.scope_summary,
    s.issuing_body,
    s.edition,
    s.valid_from,
    s.valid_to,
    s.status,
    coalesce((
      select array_agg(f.product_family order by f.product_family)
      from public.steel_standard_product_families f
      where f.standard_id = s.id
    ), array[]::text[]) as product_families,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'grade', g.grade,
          'material_number', g.material_number,
          'notes', g.notes,
          'metadata', g.metadata
        )
        order by g.grade_key, g.material_number_key
      )
      from public.steel_standard_grades g
      where g.standard_id = s.id
    ), '[]'::jsonb) as grades,
    ks.name as source_name,
    ks.provider as source_provider,
    ks.source_uri,
    ks.source_class,
    s.source_locator,
    s.metadata
  from public.steel_standards s
  join public.knowledge_sources ks
    on ks.id = s.knowledge_source_id
  where (p_status is null or s.status = p_status)
    and (
      nullif(btrim(coalesce(p_query, '')), '') is null
      or s.code ilike '%' || btrim(p_query) || '%'
      or s.title ilike '%' || btrim(p_query) || '%'
      or coalesce(s.short_explanation, '') ilike '%' || btrim(p_query) || '%'
      or coalesce(s.scope_summary, '') ilike '%' || btrim(p_query) || '%'
    )
  order by s.code_key, s.edition nulls last, s.id
  limit greatest(1, least(coalesce(p_limit, 100), 500))
  offset greatest(0, coalesce(p_offset, 0));
$$;

create or replace function public.p1_shared_steel_dimensions(
  p_standard_code text,
  p_product_family text default null,
  p_outer_diameter_mm numeric default null,
  p_thickness_mm numeric default null,
  p_base_price_eur_t numeric default null,
  p_length_m numeric default null,
  p_limit integer default 250,
  p_offset integer default 0
)
returns table (
  dimension_id uuid,
  standard_id uuid,
  standard_code text,
  standard_title text,
  standard_edition text,
  product_family text,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  thickness_mm numeric,
  theoretical_weight_kg_m numeric,
  weight_method text,
  weight_formula_version text,
  base_price_eur_t numeric,
  reference_price_eur_m numeric,
  length_m numeric,
  reference_price_eur_piece numeric,
  price_semantic text,
  provenance_class text,
  not_normative_complete boolean,
  source_name text,
  source_provider text,
  source_uri text,
  source_class text,
  source_locator jsonb,
  row_metadata jsonb
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if nullif(btrim(coalesce(p_standard_code, '')), '') is null then
    raise exception using
      errcode = '22023',
      message = 'p_standard_code is required';
  end if;

  if p_product_family is not null
     and p_product_family not in ('round_tube', 'square_tube', 'rectangular_tube') then
    raise exception using
      errcode = '22023',
      message = 'p_product_family is not supported';
  end if;

  if p_base_price_eur_t is not null and p_base_price_eur_t < 0 then
    raise exception using
      errcode = '22023',
      message = 'p_base_price_eur_t must be greater than or equal to zero';
  end if;

  if p_length_m is not null and p_length_m <= 0 then
    raise exception using
      errcode = '22023',
      message = 'p_length_m must be greater than zero';
  end if;

  if p_outer_diameter_mm is not null and p_outer_diameter_mm <= 0 then
    raise exception using
      errcode = '22023',
      message = 'p_outer_diameter_mm must be greater than zero';
  end if;

  if p_thickness_mm is not null and p_thickness_mm <= 0 then
    raise exception using
      errcode = '22023',
      message = 'p_thickness_mm must be greater than zero';
  end if;

  return query
  select
    d.id as dimension_id,
    s.id as standard_id,
    s.code as standard_code,
    s.title as standard_title,
    s.edition as standard_edition,
    d.product_family,
    d.outer_diameter_mm,
    d.width_mm,
    d.height_mm,
    d.thickness_mm,
    d.theoretical_weight_kg_m,
    d.weight_method,
    d.weight_formula_version,
    p_base_price_eur_t as base_price_eur_t,
    case
      when p_base_price_eur_t is null then null
      else round((d.theoretical_weight_kg_m * p_base_price_eur_t / 1000.0)::numeric, 4)
    end as reference_price_eur_m,
    p_length_m as length_m,
    case
      when p_base_price_eur_t is null or p_length_m is null then null
      else round((d.theoretical_weight_kg_m * p_base_price_eur_t / 1000.0 * p_length_m)::numeric, 4)
    end as reference_price_eur_piece,
    'reference_price'::text as price_semantic,
    coalesce(
      nullif(d.metadata ->> 'provenance_class', ''),
      nullif(d.metadata ->> 'dataset_scope', ''),
      case d.weight_method
        when 'published' then 'published_reference'
        when 'calculated' then 'calculated_reference'
        else 'verified_internal_reference'
      end
    ) as provenance_class,
    coalesce((d.metadata ->> 'not_normative_complete')::boolean, false) as not_normative_complete,
    coalesce(ks.name, standard_source.name) as source_name,
    coalesce(ks.provider, standard_source.provider) as source_provider,
    coalesce(ks.source_uri, standard_source.source_uri) as source_uri,
    coalesce(ks.source_class, standard_source.source_class) as source_class,
    d.source_locator,
    d.metadata as row_metadata
  from public.steel_dimensional_rows d
  join public.steel_standards s
    on s.id = d.standard_id
  join public.knowledge_sources standard_source
    on standard_source.id = s.knowledge_source_id
  left join public.knowledge_sources ks
    on ks.id = d.knowledge_source_id
  where s.code_key = public.canonical_steel_token(p_standard_code)
    and s.status = 'active'
    and (p_product_family is null or d.product_family = p_product_family)
    and (p_outer_diameter_mm is null or d.outer_diameter_mm = p_outer_diameter_mm)
    and (p_thickness_mm is null or d.thickness_mm = p_thickness_mm)
  order by
    d.outer_diameter_mm nulls last,
    d.width_mm nulls last,
    d.height_mm nulls last,
    d.thickness_mm,
    d.id
  limit greatest(1, least(coalesce(p_limit, 250), 1000))
  offset greatest(0, coalesce(p_offset, 0));
end;
$$;

revoke all on function public.p1_shared_steel_standards(text, text, integer, integer)
  from public, anon;
grant execute on function public.p1_shared_steel_standards(text, text, integer, integer)
  to authenticated, service_role;

revoke all on function public.p1_shared_steel_dimensions(text, text, numeric, numeric, numeric, numeric, integer, integer)
  from public, anon;
grant execute on function public.p1_shared_steel_dimensions(text, text, numeric, numeric, numeric, numeric, integer, integer)
  to authenticated, service_role;

comment on function public.p1_shared_steel_standards(text, text, integer, integer) is
  'P1.15 authenticated shared standards index/detail read contract with source provenance; tenant-independent and read-only.';
comment on function public.p1_shared_steel_dimensions(text, text, numeric, numeric, numeric, numeric, integer, integer) is
  'P1.15 authenticated shared dimensional lookup. Calculates non-persisted EUR/m and EUR/piece reference values from kg/m and user-supplied EUR/t; never represents market truth.';
