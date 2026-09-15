-- P0.4 — Steel ontology v1 and deterministic canonical product IDs for tubes.
--
-- Canonical tube identity is intentionally independent from tenant, price,
-- quantity, length and certification. Those remain commercial / variant facts.
-- The identity captures the steel product core: family/shape, material/grade,
-- standard, cross-section geometry, wall thickness and manufacturing process.

create or replace function public.canonical_steel_token(p_value text)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select nullif(
    lower(regexp_replace(btrim(p_value), '[^[:alnum:]]+', '', 'g')),
    ''
  );
$$;

create or replace function public.canonical_mm_value(p_value numeric)
returns text
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select regexp_replace(
    regexp_replace(p_value::text, '(\.[0-9]*?)0+$', '\1'),
    '\.$',
    ''
  );
$$;

create or replace function public.canonical_tube_family(
  p_product_type text,
  p_outer_diameter_mm numeric default null,
  p_width_mm numeric default null,
  p_height_mm numeric default null
)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_type text := public.canonical_steel_token(p_product_type);
begin
  -- Geometry is authoritative when it is available.
  if p_outer_diameter_mm is not null and p_outer_diameter_mm > 0 then
    return 'round_tube';
  end if;

  if p_width_mm is not null and p_width_mm > 0
     and p_height_mm is not null and p_height_mm > 0 then
    if p_width_mm = p_height_mm then
      return 'square_tube';
    end if;
    return 'rectangular_tube';
  end if;

  return case
    when v_type in ('roundtube', 'circulartube', 'chs') then 'round_tube'
    when v_type in ('squaretube', 'shs') then 'square_tube'
    when v_type in ('rectangulartube', 'rhs') then 'rectangular_tube'
    else null
  end;
end;
$$;

create or replace function public.canonical_tube_product_key(
  p_product_type text,
  p_grade text default null,
  p_standard text default null,
  p_material_number text default null,
  p_outer_diameter_mm numeric default null,
  p_width_mm numeric default null,
  p_height_mm numeric default null,
  p_thickness_mm numeric default null,
  p_manufacturing_process text default null
)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_family text;
  v_grade text;
  v_standard text;
  v_material text;
  v_process text;
  v_geometry text;
  v_width numeric;
  v_height numeric;
begin
  v_family := public.canonical_tube_family(
    p_product_type,
    p_outer_diameter_mm,
    p_width_mm,
    p_height_mm
  );

  if v_family is null or p_thickness_mm is null or p_thickness_mm <= 0 then
    return null;
  end if;

  if v_family = 'round_tube' then
    if p_outer_diameter_mm is null or p_outer_diameter_mm <= 0 then
      return null;
    end if;
    v_geometry := 'od:' || public.canonical_mm_value(p_outer_diameter_mm);
  else
    if p_width_mm is null or p_width_mm <= 0
       or p_height_mm is null or p_height_mm <= 0 then
      return null;
    end if;

    if v_family = 'square_tube' and p_width_mm <> p_height_mm then
      return null;
    end if;

    -- RHS orientation is not identity-bearing: 120x80 = 80x120.
    v_width := greatest(p_width_mm, p_height_mm);
    v_height := least(p_width_mm, p_height_mm);
    v_geometry := public.canonical_mm_value(v_width)
      || 'x' || public.canonical_mm_value(v_height);
  end if;

  v_grade := coalesce(public.canonical_steel_token(p_grade), '_');
  v_standard := coalesce(public.canonical_steel_token(p_standard), '_');
  v_material := coalesce(public.canonical_steel_token(p_material_number), '_');
  v_process := coalesce(public.canonical_steel_token(p_manufacturing_process), '_');

  return 'tube:v1'
    || '|family=' || v_family
    || '|grade=' || v_grade
    || '|standard=' || v_standard
    || '|material=' || v_material
    || '|geom=' || v_geometry
    || '|t=' || public.canonical_mm_value(p_thickness_mm)
    || '|process=' || v_process;
end;
$$;

create or replace function public.canonical_tube_product_id(
  p_product_type text,
  p_grade text default null,
  p_standard text default null,
  p_material_number text default null,
  p_outer_diameter_mm numeric default null,
  p_width_mm numeric default null,
  p_height_mm numeric default null,
  p_thickness_mm numeric default null,
  p_manufacturing_process text default null
)
returns uuid
language sql
immutable
security invoker
set search_path = ''
as $$
  select case
    when public.canonical_tube_product_key(
      p_product_type,
      p_grade,
      p_standard,
      p_material_number,
      p_outer_diameter_mm,
      p_width_mm,
      p_height_mm,
      p_thickness_mm,
      p_manufacturing_process
    ) is null then null
    else md5(
      'steel-sales-ai|'
      || public.canonical_tube_product_key(
        p_product_type,
        p_grade,
        p_standard,
        p_material_number,
        p_outer_diameter_mm,
        p_width_mm,
        p_height_mm,
        p_thickness_mm,
        p_manufacturing_process
      )
    )::uuid
  end;
$$;

revoke execute on function public.canonical_steel_token(text) from public, anon;
revoke execute on function public.canonical_mm_value(numeric) from public, anon;
revoke execute on function public.canonical_tube_family(text, numeric, numeric, numeric) from public, anon;
revoke execute on function public.canonical_tube_product_key(text, text, text, text, numeric, numeric, numeric, numeric, text) from public, anon;
revoke execute on function public.canonical_tube_product_id(text, text, text, text, numeric, numeric, numeric, numeric, text) from public, anon;

grant execute on function public.canonical_steel_token(text) to authenticated, service_role;
grant execute on function public.canonical_mm_value(numeric) to authenticated, service_role;
grant execute on function public.canonical_tube_family(text, numeric, numeric, numeric) to authenticated, service_role;
grant execute on function public.canonical_tube_product_key(text, text, text, text, numeric, numeric, numeric, numeric, text) to authenticated, service_role;
grant execute on function public.canonical_tube_product_id(text, text, text, text, numeric, numeric, numeric, numeric, text) to authenticated, service_role;

alter table public.commercial_observations
  add column if not exists canonical_product_key text
  generated always as (
    public.canonical_tube_product_key(
      product_type,
      grade,
      standard,
      material_number,
      outer_diameter_mm,
      width_mm,
      height_mm,
      thickness_mm,
      null
    )
  ) stored;

alter table public.commercial_observations
  add column if not exists canonical_product_id uuid
  generated always as (
    public.canonical_tube_product_id(
      product_type,
      grade,
      standard,
      material_number,
      outer_diameter_mm,
      width_mm,
      height_mm,
      thickness_mm,
      null
    )
  ) stored;

alter table public.products
  add column if not exists canonical_product_key text
  generated always as (
    public.canonical_tube_product_key(
      product_type,
      grade,
      standard,
      material_number,
      outer_diameter_mm,
      width_mm,
      height_mm,
      thickness_mm,
      manufacturing_process
    )
  ) stored;

alter table public.products
  add column if not exists canonical_product_id uuid
  generated always as (
    public.canonical_tube_product_id(
      product_type,
      grade,
      standard,
      material_number,
      outer_diameter_mm,
      width_mm,
      height_mm,
      thickness_mm,
      manufacturing_process
    )
  ) stored;

create index if not exists commercial_observations_canonical_product_id_idx
  on public.commercial_observations (organization_id, canonical_product_id)
  where canonical_product_id is not null;

create index if not exists products_canonical_product_id_idx
  on public.products (organization_id, canonical_product_id)
  where canonical_product_id is not null;

comment on function public.canonical_tube_product_key(text, text, text, text, numeric, numeric, numeric, numeric, text) is
  'P0.4 tube ontology v1 canonical identity. Excludes length, quantity, price and certification by design.';
comment on function public.canonical_tube_product_id(text, text, text, text, numeric, numeric, numeric, numeric, text) is
  'Deterministic UUID derived from the P0.4 tube:v1 canonical product key.';
comment on column public.commercial_observations.canonical_product_key is
  'Deterministic tube:v1 identity key for cross-document commercial history matching.';
comment on column public.commercial_observations.canonical_product_id is
  'Deterministic tube:v1 UUID; identical product cores resolve to the same ID across tenants without sharing tenant data.';
comment on column public.products.canonical_product_key is
  'Deterministic tube:v1 identity key aligned with commercial_observations.';
comment on column public.products.canonical_product_id is
  'Deterministic tube:v1 UUID aligned with commercial_observations.';
