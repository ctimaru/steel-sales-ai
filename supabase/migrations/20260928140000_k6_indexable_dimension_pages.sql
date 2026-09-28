-- K6 — Indexable Dimension Pages & SEO Scale-Up.
--
-- Adds deterministic public slugs and a narrow detail contract for every
-- canonical K5 tube-weight reference. This turns the curated weight catalog
-- into crawlable dimension pages without exposing the backing geometry,
-- reference or provenance tables directly.

create or replace function public.k6_slug_number(p_value numeric)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select replace(
    rtrim(
      rtrim(to_char(p_value, 'FM999999990.999999'), '0'),
      '.'
    ),
    '.',
    '-'
  );
$$;

create or replace function public.k6_dimension_slug(
  p_product_family text,
  p_outer_diameter_mm numeric,
  p_width_mm numeric,
  p_height_mm numeric,
  p_thickness_mm numeric
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_product_family
    when 'round_tube' then
      'tondo-' || public.k6_slug_number(p_outer_diameter_mm) || 'x' ||
      public.k6_slug_number(p_thickness_mm)
    when 'square_tube' then
      'quadro-' || public.k6_slug_number(p_width_mm) || 'x' ||
      public.k6_slug_number(p_height_mm) || 'x' ||
      public.k6_slug_number(p_thickness_mm)
    when 'rectangular_tube' then
      'rettangolare-' || public.k6_slug_number(p_width_mm) || 'x' ||
      public.k6_slug_number(p_height_mm) || 'x' ||
      public.k6_slug_number(p_thickness_mm)
    else null
  end;
$$;

revoke all on function public.k6_slug_number(numeric) from public, anon, authenticated, service_role;
revoke all on function public.k6_dimension_slug(text,numeric,numeric,numeric,numeric) from public, anon, authenticated, service_role;

create or replace function public.k6_public_tube_dimension_pages(
  p_product_family text default null,
  p_limit integer default 250,
  p_offset integer default 0
)
returns table (
  dimension_slug text,
  reference_id uuid,
  geometry_id uuid,
  product_family text,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  thickness_mm numeric,
  weight_kg_m numeric,
  weight_method text,
  density_kg_m3 numeric,
  source_provider text,
  source_name text,
  source_url text,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.k6_dimension_slug(
      g.product_family,
      g.outer_diameter_mm,
      g.width_mm,
      g.height_mm,
      g.thickness_mm
    ) as dimension_slug,
    w.id,
    g.id,
    g.product_family,
    g.outer_diameter_mm,
    g.width_mm,
    g.height_mm,
    g.thickness_mm,
    w.weight_kg_m,
    w.weight_method,
    w.density_kg_m3,
    ks.provider,
    ks.name,
    ks.source_uri,
    greatest(g.updated_at,w.created_at)
  from public.steel_weight_references w
  join public.steel_geometries g
    on g.id=w.geometry_id
  left join public.knowledge_sources ks
    on ks.id=w.knowledge_source_id
  where w.is_canonical=true
    and g.product_family in ('round_tube','square_tube','rectangular_tube')
    and (
      nullif(btrim(coalesce(p_product_family,'')),'') is null
      or g.product_family=btrim(p_product_family)
    )
    and ks.source_uri is not null
    and btrim(ks.source_uri)<>''
    and ks.provider is not null
    and btrim(ks.provider)<>''
  order by
    case g.product_family
      when 'round_tube' then 1
      when 'square_tube' then 2
      when 'rectangular_tube' then 3
      else 9
    end,
    g.outer_diameter_mm nulls last,
    g.width_mm nulls last,
    g.height_mm nulls last,
    g.thickness_mm,
    w.id
  limit greatest(1,least(coalesce(p_limit,250),500))
  offset greatest(0,coalesce(p_offset,0));
$$;

create or replace function public.k6_public_tube_dimension_page(
  p_slug text
)
returns table (
  dimension_slug text,
  reference_id uuid,
  geometry_id uuid,
  product_family text,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  thickness_mm numeric,
  weight_kg_m numeric,
  weight_method text,
  density_kg_m3 numeric,
  source_provider text,
  source_name text,
  source_url text,
  published_at timestamptz,
  related_dimensions jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with pages as (
    select *
    from public.k6_public_tube_dimension_pages(null,500,0)
  ),
  target as (
    select *
    from pages
    where dimension_slug=lower(btrim(p_slug))
    limit 1
  )
  select
    t.dimension_slug,
    t.reference_id,
    t.geometry_id,
    t.product_family,
    t.outer_diameter_mm,
    t.width_mm,
    t.height_mm,
    t.thickness_mm,
    t.weight_kg_m,
    t.weight_method,
    t.density_kg_m3,
    t.source_provider,
    t.source_name,
    t.source_url,
    t.published_at,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'dimension_slug', r.dimension_slug,
          'product_family', r.product_family,
          'outer_diameter_mm', r.outer_diameter_mm,
          'width_mm', r.width_mm,
          'height_mm', r.height_mm,
          'thickness_mm', r.thickness_mm,
          'weight_kg_m', r.weight_kg_m
        )
        order by r.relationship_rank, r.distance_score, r.thickness_mm
      )
      from (
        select
          p.dimension_slug,
          p.product_family,
          p.outer_diameter_mm,
          p.width_mm,
          p.height_mm,
          p.thickness_mm,
          p.weight_kg_m,
          case
            when t.product_family='round_tube'
              and p.outer_diameter_mm=t.outer_diameter_mm then 0
            when t.product_family in ('square_tube','rectangular_tube')
              and p.width_mm=t.width_mm
              and p.height_mm=t.height_mm then 0
            else 1
          end as relationship_rank,
          case
            when t.product_family='round_tube' then
              abs(coalesce(p.outer_diameter_mm,0)-coalesce(t.outer_diameter_mm,0)) +
              abs(p.thickness_mm-t.thickness_mm)
            else
              abs(coalesce(p.width_mm,0)-coalesce(t.width_mm,0)) +
              abs(coalesce(p.height_mm,0)-coalesce(t.height_mm,0)) +
              abs(p.thickness_mm-t.thickness_mm)
          end as distance_score
        from pages p
        where p.product_family=t.product_family
          and p.dimension_slug<>t.dimension_slug
        order by relationship_rank,distance_score,p.thickness_mm
        limit 6
      ) r
    ), '[]'::jsonb) as related_dimensions
  from target t;
$$;

revoke all on function public.k6_public_tube_dimension_pages(text,integer,integer)
  from public;
revoke all on function public.k6_public_tube_dimension_page(text)
  from public;

grant execute on function public.k6_public_tube_dimension_pages(text,integer,integer)
  to anon, authenticated, service_role;
grant execute on function public.k6_public_tube_dimension_page(text)
  to anon, authenticated, service_role;

comment on function public.k6_public_tube_dimension_pages(text,integer,integer) is
  'K6 crawlable dimension-page index built only from canonical K5 weight references with public source metadata.';
comment on function public.k6_public_tube_dimension_page(text) is
  'K6 public dimension detail with exact kg/m, public source and related canonical dimensions; no internal provenance payloads.';

do $$
declare
  v_total integer;
  v_unique_slugs integer;
begin
  select count(*),count(distinct dimension_slug)
    into v_total,v_unique_slugs
  from public.k6_public_tube_dimension_pages(null,500,0);

  if v_total<>109 then
    raise exception 'K6 expected 109 indexable canonical dimensions, got %',v_total;
  end if;

  if v_unique_slugs<>v_total then
    raise exception 'K6 dimension slugs must be unique: % pages / % unique slugs',v_total,v_unique_slugs;
  end if;

  if not exists (
    select 1
    from public.k6_public_tube_dimension_pages('round_tube',500,0)
    where dimension_slug='tondo-406-4x6-3'
      and weight_kg_m=62.2
  ) then
    raise exception 'K6 expected tondo-406-4x6-3 with canonical weight 62.2 kg/m';
  end if;
end
$$;
