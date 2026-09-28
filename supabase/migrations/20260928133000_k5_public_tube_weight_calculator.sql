-- K5 — Public Tube Weight Calculator & Dimensions Foundation.
--
-- Exposes curated canonical tube-weight references to the public Knowledge layer
-- through a narrow anonymous-safe RPC. Arbitrary calculator results remain
-- mathematical estimates and are never promoted into the canonical reference
-- database by the public frontend.

create function public.k5_public_tube_weight_references(
  p_product_family text default null,
  p_limit integer default 250,
  p_offset integer default 0
)
returns table (
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
  source_url text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
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
    ks.source_uri
  from public.steel_weight_references w
  join public.steel_geometries g
    on g.id=w.geometry_id
  left join public.knowledge_sources ks
    on ks.id=w.knowledge_source_id
  where w.is_canonical=true
    and (
      nullif(btrim(coalesce(p_product_family,'')),'') is null
      or g.product_family=btrim(p_product_family)
    )
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

revoke all on function public.k5_public_tube_weight_references(text,integer,integer)
  from public;

grant execute on function public.k5_public_tube_weight_references(text,integer,integer)
  to anon, authenticated, service_role;

comment on function public.k5_public_tube_weight_references(text,integer,integer) is
  'K5 public canonical tube-weight references. Returns curated geometry, kg/m, declared method and public source label/URL only; backing reference tables remain private.';

do $$
declare
  v_round integer;
  v_square integer;
  v_rect integer;
begin
  select count(*) into v_round
  from public.k5_public_tube_weight_references('round_tube',500,0);

  select count(*) into v_square
  from public.k5_public_tube_weight_references('square_tube',500,0);

  select count(*) into v_rect
  from public.k5_public_tube_weight_references('rectangular_tube',500,0);

  if v_round < 59 then
    raise exception 'K5 expected at least 59 public round references, got %',v_round;
  end if;

  if v_square < 27 then
    raise exception 'K5 expected at least 27 public square references, got %',v_square;
  end if;

  if v_rect < 23 then
    raise exception 'K5 expected at least 23 public rectangular references, got %',v_rect;
  end if;
end
$$;
