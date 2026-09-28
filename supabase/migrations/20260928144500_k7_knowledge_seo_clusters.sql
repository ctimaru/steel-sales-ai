-- K7 — Knowledge SEO Cluster & Discovery Hardening.
--
-- Builds crawlable family and outer-size hubs above K6 dimension pages.
-- Size hubs are published only when at least two canonical thickness variants
-- exist, preventing thin one-row SEO pages. The contracts query canonical
-- backing data directly so they do not inherit K6's 500-row API page size.

create or replace function public.k7_tube_family_slug(p_product_family text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case p_product_family
    when 'round_tube' then 'tondo'
    when 'square_tube' then 'quadro'
    when 'rectangular_tube' then 'rettangolare'
    else null
  end;
$$;

create or replace function public.k7_tube_size_slug(
  p_product_family text,
  p_outer_diameter_mm numeric,
  p_width_mm numeric,
  p_height_mm numeric
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_product_family
    when 'round_tube' then public.k6_slug_number(p_outer_diameter_mm)
    when 'square_tube' then
      public.k6_slug_number(p_width_mm) || 'x' || public.k6_slug_number(p_height_mm)
    when 'rectangular_tube' then
      public.k6_slug_number(p_width_mm) || 'x' || public.k6_slug_number(p_height_mm)
    else null
  end;
$$;

revoke all on function public.k7_tube_family_slug(text)
  from public, anon, authenticated, service_role;
revoke all on function public.k7_tube_size_slug(text,numeric,numeric,numeric)
  from public, anon, authenticated, service_role;

create or replace function public.k7_public_tube_family_hubs()
returns table (
  family_slug text,
  product_family text,
  dimension_count integer,
  size_hub_count integer,
  min_thickness_mm numeric,
  max_thickness_mm numeric,
  min_weight_kg_m numeric,
  max_weight_kg_m numeric,
  source_count integer,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with canonical as (
    select
      g.product_family,
      g.outer_diameter_mm,
      g.width_mm,
      g.height_mm,
      g.thickness_mm,
      w.weight_kg_m,
      w.knowledge_source_id,
      greatest(g.updated_at,w.created_at) as published_at
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    join public.knowledge_sources ks on ks.id=w.knowledge_source_id
    where w.is_canonical=true
      and g.product_family in ('round_tube','square_tube','rectangular_tube')
      and ks.source_uri is not null
      and btrim(ks.source_uri)<>''
      and ks.provider is not null
      and btrim(ks.provider)<>''
  ),
  size_groups as (
    select
      product_family,
      outer_diameter_mm,
      width_mm,
      height_mm,
      count(*) as variant_count
    from canonical
    group by product_family,outer_diameter_mm,width_mm,height_mm
  ),
  family_sizes as (
    select
      product_family,
      count(*) filter (where variant_count>=2)::integer as size_hub_count
    from size_groups
    group by product_family
  )
  select
    public.k7_tube_family_slug(c.product_family),
    c.product_family,
    count(*)::integer,
    fs.size_hub_count,
    min(c.thickness_mm),
    max(c.thickness_mm),
    min(c.weight_kg_m),
    max(c.weight_kg_m),
    count(distinct c.knowledge_source_id)::integer,
    max(c.published_at)
  from canonical c
  join family_sizes fs using (product_family)
  group by c.product_family,fs.size_hub_count
  order by case c.product_family
    when 'round_tube' then 1
    when 'square_tube' then 2
    when 'rectangular_tube' then 3
    else 9
  end;
$$;

create or replace function public.k7_public_tube_size_hubs(
  p_family_slug text default null
)
returns table (
  family_slug text,
  product_family text,
  size_slug text,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  variant_count integer,
  min_thickness_mm numeric,
  max_thickness_mm numeric,
  min_weight_kg_m numeric,
  max_weight_kg_m numeric,
  source_count integer,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with canonical as (
    select
      g.product_family,
      g.outer_diameter_mm,
      g.width_mm,
      g.height_mm,
      g.thickness_mm,
      w.weight_kg_m,
      w.knowledge_source_id,
      greatest(g.updated_at,w.created_at) as published_at
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    join public.knowledge_sources ks on ks.id=w.knowledge_source_id
    where w.is_canonical=true
      and g.product_family in ('round_tube','square_tube','rectangular_tube')
      and ks.source_uri is not null
      and btrim(ks.source_uri)<>''
      and ks.provider is not null
      and btrim(ks.provider)<>''
  )
  select
    public.k7_tube_family_slug(c.product_family) as family_slug,
    c.product_family,
    public.k7_tube_size_slug(
      c.product_family,
      c.outer_diameter_mm,
      c.width_mm,
      c.height_mm
    ) as size_slug,
    c.outer_diameter_mm,
    c.width_mm,
    c.height_mm,
    count(*)::integer as variant_count,
    min(c.thickness_mm),
    max(c.thickness_mm),
    min(c.weight_kg_m),
    max(c.weight_kg_m),
    count(distinct c.knowledge_source_id)::integer as source_count,
    max(c.published_at)
  from canonical c
  where nullif(btrim(coalesce(p_family_slug,'')),'') is null
     or public.k7_tube_family_slug(c.product_family)=lower(btrim(p_family_slug))
  group by
    c.product_family,
    c.outer_diameter_mm,
    c.width_mm,
    c.height_mm
  having count(*)>=2
  order by
    case c.product_family
      when 'round_tube' then 1
      when 'square_tube' then 2
      when 'rectangular_tube' then 3
      else 9
    end,
    c.outer_diameter_mm nulls last,
    c.width_mm nulls last,
    c.height_mm nulls last;
$$;

create or replace function public.k7_public_tube_size_hub(
  p_family_slug text,
  p_size_slug text
)
returns table (
  family_slug text,
  product_family text,
  size_slug text,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  variant_count integer,
  min_thickness_mm numeric,
  max_thickness_mm numeric,
  min_weight_kg_m numeric,
  max_weight_kg_m numeric,
  source_count integer,
  published_at timestamptz,
  variants jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with hub as (
    select *
    from public.k7_public_tube_size_hubs(p_family_slug)
    where size_slug=lower(btrim(p_size_slug))
    limit 1
  ),
  variants as (
    select
      h.family_slug,
      h.product_family,
      h.size_slug,
      h.outer_diameter_mm,
      h.width_mm,
      h.height_mm,
      h.variant_count,
      h.min_thickness_mm,
      h.max_thickness_mm,
      h.min_weight_kg_m,
      h.max_weight_kg_m,
      h.source_count,
      h.published_at,
      coalesce(jsonb_agg(
        jsonb_build_object(
          'dimension_slug', public.k6_dimension_slug(
            g.product_family,
            g.outer_diameter_mm,
            g.width_mm,
            g.height_mm,
            g.thickness_mm
          ),
          'thickness_mm', g.thickness_mm,
          'weight_kg_m', w.weight_kg_m,
          'weight_method', w.weight_method,
          'density_kg_m3', w.density_kg_m3,
          'source_provider', ks.provider,
          'source_name', ks.name,
          'source_url', ks.source_uri,
          'published_at', greatest(g.updated_at,w.created_at)
        )
        order by g.thickness_mm,w.id
      ),'[]'::jsonb) as variants
    from hub h
    join public.steel_geometries g
      on g.product_family=h.product_family
     and g.outer_diameter_mm is not distinct from h.outer_diameter_mm
     and g.width_mm is not distinct from h.width_mm
     and g.height_mm is not distinct from h.height_mm
    join public.steel_weight_references w
      on w.geometry_id=g.id
     and w.is_canonical=true
    join public.knowledge_sources ks
      on ks.id=w.knowledge_source_id
     and ks.source_uri is not null
     and btrim(ks.source_uri)<>''
     and ks.provider is not null
     and btrim(ks.provider)<>''
    group by
      h.family_slug,h.product_family,h.size_slug,
      h.outer_diameter_mm,h.width_mm,h.height_mm,
      h.variant_count,h.min_thickness_mm,h.max_thickness_mm,
      h.min_weight_kg_m,h.max_weight_kg_m,h.source_count,h.published_at
  )
  select * from variants;
$$;

revoke all on function public.k7_public_tube_family_hubs() from public;
revoke all on function public.k7_public_tube_size_hubs(text) from public;
revoke all on function public.k7_public_tube_size_hub(text,text) from public;

grant execute on function public.k7_public_tube_family_hubs()
  to anon, authenticated, service_role;
grant execute on function public.k7_public_tube_size_hubs(text)
  to anon, authenticated, service_role;
grant execute on function public.k7_public_tube_size_hub(text,text)
  to anon, authenticated, service_role;

comment on function public.k7_public_tube_family_hubs() is
  'K7 crawlable tube-family SEO hubs backed only by sourced canonical references.';
comment on function public.k7_public_tube_size_hubs(text) is
  'K7 outer-size hubs. Publishes only groups with at least two canonical thickness variants to avoid thin pages.';
comment on function public.k7_public_tube_size_hub(text,text) is
  'K7 size-hub detail with canonical thickness variants and public source metadata only.';

do $$
declare
  v_family_count integer;
  v_hub_count integer;
  v_round_hubs integer;
  v_square_hubs integer;
  v_rect_hubs integer;
begin
  select count(*) into v_family_count
  from public.k7_public_tube_family_hubs();

  select
    count(*),
    count(*) filter (where product_family='round_tube'),
    count(*) filter (where product_family='square_tube'),
    count(*) filter (where product_family='rectangular_tube')
  into v_hub_count,v_round_hubs,v_square_hubs,v_rect_hubs
  from public.k7_public_tube_size_hubs(null);

  if v_family_count<>3 then
    raise exception 'K7 expected 3 family hubs, got %',v_family_count;
  end if;

  if v_hub_count<>34 or v_round_hubs<>21 or v_square_hubs<>7 or v_rect_hubs<>6 then
    raise exception 'K7 expected 34 size hubs (21/7/6), got % (%/%/%)',
      v_hub_count,v_round_hubs,v_square_hubs,v_rect_hubs;
  end if;

  if exists (
    select 1 from public.k7_public_tube_size_hubs(null)
    where variant_count<2
  ) then
    raise exception 'K7 thin-page guard regression: every size hub needs >=2 variants';
  end if;
end
$$;
