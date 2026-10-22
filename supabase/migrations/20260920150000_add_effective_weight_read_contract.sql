-- P1.15 / SK4.5j — effective-weight / canonical read contract.
--
-- Read invariants:
--   * commercial/reference pricing consumes only is_canonical=true weight rows;
--   * exact scope = (geometry_id, material_grade_id), including NULL as a
--     first-class grade-neutral scope;
--   * verified/published/calculated rows that are not canonical remain evidence
--     only and never affect effective kg/m or EUR/m;
--   * missing canonical is explicit and yields NULL pricing — never fallback to
--     a dimensional-row weight or another grade scope;
--   * the legacy p1_shared_steel_dimensions(...) signature is preserved, but its
--     pricing semantics are tightened to the grade-neutral canonical scope;
--   * a new grade-aware API exposes exact-scope effective weight and pricing.

create or replace function public.p1_shared_steel_effective_weight(
  p_geometry_id uuid,
  p_material_grade_id uuid default null
)
returns table (
  geometry_id uuid,
  material_grade_id uuid,
  material_grade text,
  effective_reference_id uuid,
  effective_weight_kg_m numeric,
  effective_weight_method text,
  effective_weight_status text,
  effective_weight_semantic text,
  verified_canonical boolean,
  knowledge_source_id uuid,
  source_document_id uuid,
  source_locator jsonb,
  weight_metadata jsonb
)
language sql
stable
security invoker
set search_path=''
as $$
  select
    g.id as geometry_id,
    p_material_grade_id as material_grade_id,
    mg.designation as material_grade,
    w.id as effective_reference_id,
    w.weight_kg_m as effective_weight_kg_m,
    w.weight_method as effective_weight_method,
    case
      when w.id is null then 'canonical_missing'::text
      else 'canonical_available'::text
    end as effective_weight_status,
    'canonical_exact_scope'::text as effective_weight_semantic,
    coalesce(w.weight_method='verified',false) as verified_canonical,
    w.knowledge_source_id,
    w.source_document_id,
    w.source_locator,
    w.metadata as weight_metadata
  from public.steel_geometries g
  left join public.steel_material_grades mg
    on mg.id=p_material_grade_id
  left join public.steel_weight_references w
    on w.geometry_id=g.id
   and w.material_grade_id is not distinct from p_material_grade_id
   and w.is_canonical
  where g.id=p_geometry_id;
$$;

comment on function public.p1_shared_steel_effective_weight(uuid,uuid) is
  'SK4.5j exact-scope effective-weight contract. Returns only the canonical reference for geometry+grade; missing canonical is explicit and no fallback occurs.';

revoke all on function public.p1_shared_steel_effective_weight(uuid,uuid)
  from public,anon;

grant execute on function public.p1_shared_steel_effective_weight(uuid,uuid)
  to authenticated,service_role;

create or replace function public.p1_shared_steel_effective_dimensions(
  p_standard_code text,
  p_material_grade text default null,
  p_product_family text default null,
  p_outer_diameter_mm numeric default null,
  p_thickness_mm numeric default null,
  p_base_price_eur_t numeric default null,
  p_length_m numeric default null,
  p_limit integer default 250,
  p_offset integer default 0
)
returns table (
  standard_id uuid,
  standard_code text,
  standard_title text,
  standard_edition text,
  geometry_id uuid,
  material_grade_id uuid,
  material_grade text,
  material_number text,
  grade_scope text,
  product_family text,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  thickness_mm numeric,
  applicability_types text[],
  effective_weight_reference_id uuid,
  effective_weight_kg_m numeric,
  effective_weight_method text,
  effective_weight_status text,
  effective_weight_semantic text,
  verified_canonical boolean,
  base_price_eur_t numeric,
  reference_price_eur_m numeric,
  length_m numeric,
  reference_price_eur_piece numeric,
  price_semantic text,
  weight_source_name text,
  weight_source_provider text,
  weight_source_uri text,
  weight_source_class text,
  weight_source_locator jsonb,
  weight_metadata jsonb
)
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  v_grade_id uuid;
  v_grade_ids uuid[];
  v_grade_count integer;
begin
  if nullif(btrim(coalesce(p_standard_code,'')),'') is null then
    raise exception using
      errcode='22023',
      message='p_standard_code is required';
  end if;

  if p_product_family is not null
     and p_product_family not in (
       'round_tube','square_tube','rectangular_tube'
     ) then
    raise exception using
      errcode='22023',
      message='p_product_family is not supported';
  end if;

  if p_base_price_eur_t is not null and p_base_price_eur_t < 0 then
    raise exception using
      errcode='22023',
      message='p_base_price_eur_t must be greater than or equal to zero';
  end if;

  if p_length_m is not null and p_length_m <= 0 then
    raise exception using
      errcode='22023',
      message='p_length_m must be greater than zero';
  end if;

  if p_outer_diameter_mm is not null and p_outer_diameter_mm <= 0 then
    raise exception using
      errcode='22023',
      message='p_outer_diameter_mm must be greater than zero';
  end if;

  if p_thickness_mm is not null and p_thickness_mm <= 0 then
    raise exception using
      errcode='22023',
      message='p_thickness_mm must be greater than zero';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using
      errcode='22023',
      message='p_limit must be between 1 and 1000';
  end if;

  if p_offset is null or p_offset < 0 then
    raise exception using
      errcode='22023',
      message='p_offset must be non-negative';
  end if;

  if nullif(btrim(coalesce(p_material_grade,'')),'') is not null then
    select
      array_agg(distinct mg.id order by mg.id),
      count(distinct mg.id)::integer
    into v_grade_ids,v_grade_count
    from public.steel_material_grades mg
    where (
      mg.designation_key=public.canonical_steel_token(p_material_grade)
      or (
        mg.material_number_key<>''
        and mg.material_number_key=public.canonical_steel_token(p_material_grade)
      )
    )
      and exists (
        select 1
        from public.steel_standard_dimension_applicability a
        join public.steel_standards s on s.id=a.standard_id
        where a.material_grade_id=mg.id
          and s.code_key=public.canonical_steel_token(p_standard_code)
          and s.status='active'
      );

    if coalesce(v_grade_count,0)=0 then
      raise exception using
        errcode='22023',
        message=format(
          'material grade %s is not available in applicability for standard %s',
          btrim(p_material_grade),
          btrim(p_standard_code)
        );
    end if;

    if v_grade_count>1 then
      raise exception using
        errcode='22023',
        message=format(
          'material grade %s is ambiguous for standard %s',
          btrim(p_material_grade),
          btrim(p_standard_code)
        );
    end if;

    v_grade_id:=v_grade_ids[1];
  else
    v_grade_id:=null;
  end if;

  return query
  with scope_geometries as (
    select
      s.id as standard_id,
      s.code as standard_code,
      s.title as standard_title,
      s.edition as standard_edition,
      g.id as geometry_id,
      g.product_family,
      g.outer_diameter_mm,
      g.width_mm,
      g.height_mm,
      g.thickness_mm,
      array_agg(distinct a.applicability_type order by a.applicability_type)
        as applicability_types
    from public.steel_standards s
    join public.steel_standard_dimension_applicability a
      on a.standard_id=s.id
     and a.material_grade_id is not distinct from v_grade_id
    join public.steel_geometries g
      on g.id=a.geometry_id
    where s.code_key=public.canonical_steel_token(p_standard_code)
      and s.status='active'
      and (p_product_family is null or g.product_family=p_product_family)
      and (
        p_outer_diameter_mm is null
        or g.outer_diameter_mm=p_outer_diameter_mm
      )
      and (
        p_thickness_mm is null
        or g.thickness_mm=p_thickness_mm
      )
    group by
      s.id,s.code,s.title,s.edition,
      g.id,g.product_family,g.outer_diameter_mm,g.width_mm,g.height_mm,
      g.thickness_mm
  )
  select
    sg.standard_id,
    sg.standard_code,
    sg.standard_title,
    sg.standard_edition,
    sg.geometry_id,
    v_grade_id as material_grade_id,
    mg.designation as material_grade,
    mg.material_number,
    case
      when v_grade_id is null then 'grade_neutral'
      else 'grade_specific'
    end as grade_scope,
    sg.product_family,
    sg.outer_diameter_mm,
    sg.width_mm,
    sg.height_mm,
    sg.thickness_mm,
    sg.applicability_types,
    ew.effective_reference_id as effective_weight_reference_id,
    ew.effective_weight_kg_m,
    ew.effective_weight_method,
    ew.effective_weight_status,
    ew.effective_weight_semantic,
    ew.verified_canonical,
    p_base_price_eur_t as base_price_eur_t,
    case
      when p_base_price_eur_t is null
        or ew.effective_weight_status<>'canonical_available'
        then null
      else round(
        (ew.effective_weight_kg_m*p_base_price_eur_t/1000.0)::numeric,
        4
      )
    end as reference_price_eur_m,
    p_length_m as length_m,
    case
      when p_base_price_eur_t is null
        or p_length_m is null
        or ew.effective_weight_status<>'canonical_available'
        then null
      else round(
        (
          ew.effective_weight_kg_m
          *p_base_price_eur_t
          /1000.0
          *p_length_m
        )::numeric,
        4
      )
    end as reference_price_eur_piece,
    case
      when ew.effective_weight_status='canonical_available'
        then 'canonical_reference_price'
      else 'unavailable_without_canonical'
    end as price_semantic,
    ks.name as weight_source_name,
    ks.provider as weight_source_provider,
    ks.source_uri as weight_source_uri,
    ks.source_class as weight_source_class,
    ew.source_locator as weight_source_locator,
    ew.weight_metadata
  from scope_geometries sg
  left join public.steel_material_grades mg
    on mg.id=v_grade_id
  cross join lateral public.p1_shared_steel_effective_weight(
    sg.geometry_id,
    v_grade_id
  ) ew
  left join public.knowledge_sources ks
    on ks.id=ew.knowledge_source_id
  order by
    sg.outer_diameter_mm nulls last,
    sg.width_mm nulls last,
    sg.height_mm nulls last,
    sg.thickness_mm,
    sg.geometry_id
  limit p_limit
  offset p_offset;
end;
$$;

comment on function public.p1_shared_steel_effective_dimensions(
  text,text,text,numeric,numeric,numeric,numeric,integer,integer
) is
  'SK4.5j grade-aware shared steel dimension/pricing API. Exact geometry+grade canonical only; canonical_missing never falls back to another grade or non-canonical evidence.';

revoke all on function public.p1_shared_steel_effective_dimensions(
  text,text,text,numeric,numeric,numeric,numeric,integer,integer
) from public,anon;

grant execute on function public.p1_shared_steel_effective_dimensions(
  text,text,text,numeric,numeric,numeric,numeric,integer,integer
) to authenticated,service_role;

-- Tighten the existing public contract without changing its signature.
-- Because this legacy endpoint has no grade parameter, it is explicitly bound
-- to the grade-neutral canonical scope. Any standard/geometry that only has a
-- grade-specific canonical now returns NULL effective weight and NULL pricing
-- rather than silently using steel_dimensional_rows.theoretical_weight_kg_m.
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
set search_path=''
as $$
begin
  if nullif(btrim(coalesce(p_standard_code,'')),'') is null then
    raise exception using
      errcode='22023',
      message='p_standard_code is required';
  end if;

  if p_product_family is not null
     and p_product_family not in (
       'round_tube','square_tube','rectangular_tube'
     ) then
    raise exception using
      errcode='22023',
      message='p_product_family is not supported';
  end if;

  if p_base_price_eur_t is not null and p_base_price_eur_t < 0 then
    raise exception using
      errcode='22023',
      message='p_base_price_eur_t must be greater than or equal to zero';
  end if;

  if p_length_m is not null and p_length_m <= 0 then
    raise exception using
      errcode='22023',
      message='p_length_m must be greater than zero';
  end if;

  if p_outer_diameter_mm is not null and p_outer_diameter_mm <= 0 then
    raise exception using
      errcode='22023',
      message='p_outer_diameter_mm must be greater than zero';
  end if;

  if p_thickness_mm is not null and p_thickness_mm <= 0 then
    raise exception using
      errcode='22023',
      message='p_thickness_mm must be greater than zero';
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
    ew.weight_kg_m as theoretical_weight_kg_m,
    ew.weight_method,
    ew.formula_version as weight_formula_version,
    p_base_price_eur_t as base_price_eur_t,
    case
      when p_base_price_eur_t is null or ew.id is null then null
      else round(
        (ew.weight_kg_m*p_base_price_eur_t/1000.0)::numeric,
        4
      )
    end as reference_price_eur_m,
    p_length_m as length_m,
    case
      when p_base_price_eur_t is null
        or p_length_m is null
        or ew.id is null then null
      else round(
        (
          ew.weight_kg_m
          *p_base_price_eur_t
          /1000.0
          *p_length_m
        )::numeric,
        4
      )
    end as reference_price_eur_piece,
    case
      when ew.id is null then 'unavailable_without_canonical'
      else 'canonical_reference_price'
    end as price_semantic,
    case
      when ew.id is null then 'canonical_missing'
      when ew.weight_method='verified' then 'verified_canonical'
      when ew.weight_method='published' then 'published_canonical'
      when ew.weight_method='calculated' then 'calculated_canonical'
      else 'canonical_reference'
    end as provenance_class,
    coalesce((d.metadata->>'not_normative_complete')::boolean,false)
      as not_normative_complete,
    coalesce(weight_source.name,ks.name,standard_source.name) as source_name,
    coalesce(weight_source.provider,ks.provider,standard_source.provider)
      as source_provider,
    coalesce(weight_source.source_uri,ks.source_uri,standard_source.source_uri)
      as source_uri,
    coalesce(
      weight_source.source_class,
      ks.source_class,
      standard_source.source_class
    ) as source_class,
    coalesce(ew.source_locator,d.source_locator) as source_locator,
    d.metadata
    || jsonb_build_object(
      'effective_weight_contract','canonical_exact_scope',
      'effective_weight_contract_version',1,
      'effective_weight_scope','grade_neutral',
      'effective_weight_status',
        case when ew.id is null
          then 'canonical_missing'
          else 'canonical_available'
        end,
      'effective_weight_reference_id',ew.id,
      'legacy_dimensional_weight_kg_m',d.theoretical_weight_kg_m
    ) as row_metadata
  from public.steel_dimensional_rows d
  join public.steel_standards s
    on s.id=d.standard_id
  join public.knowledge_sources standard_source
    on standard_source.id=s.knowledge_source_id
  left join public.knowledge_sources ks
    on ks.id=d.knowledge_source_id
  left join public.steel_weight_references ew
    on ew.geometry_id=d.geometry_id
   and ew.material_grade_id is null
   and ew.is_canonical
  left join public.knowledge_sources weight_source
    on weight_source.id=ew.knowledge_source_id
  where s.code_key=public.canonical_steel_token(p_standard_code)
    and s.status='active'
    and (p_product_family is null or d.product_family=p_product_family)
    and (
      p_outer_diameter_mm is null
      or d.outer_diameter_mm=p_outer_diameter_mm
    )
    and (
      p_thickness_mm is null
      or d.thickness_mm=p_thickness_mm
    )
  order by
    d.outer_diameter_mm nulls last,
    d.width_mm nulls last,
    d.height_mm nulls last,
    d.thickness_mm,
    d.id
  limit greatest(1,least(coalesce(p_limit,250),1000))
  offset greatest(0,coalesce(p_offset,0));
end;
$$;

comment on function public.p1_shared_steel_dimensions(
  text,text,numeric,numeric,numeric,numeric,integer,integer
) is
  'P1.15 legacy shared dimensional lookup. SK4.5j: pricing now consumes only the grade-neutral canonical exact-scope weight; missing canonical returns NULL weight/pricing and never falls back to dimensional evidence. Use p1_shared_steel_effective_dimensions for grade-aware pricing.';

revoke all on function public.p1_shared_steel_dimensions(
  text,text,numeric,numeric,numeric,numeric,integer,integer
) from public,anon;

grant execute on function public.p1_shared_steel_dimensions(
  text,text,numeric,numeric,numeric,numeric,integer,integer
) to authenticated,service_role;

-- Acceptance assertions.
do $$
declare
  v_neutral record;
  v_noncanonical_id uuid;
  v_after record;
  v_grade record;
  v_missing record;
  v_legacy record;
  v_invalid_price_count integer;
begin
  -- A currently covered grade-neutral scope must resolve its canonical.
  select *
  into v_neutral
  from public.p1_shared_steel_effective_dimensions(
    'EN 10219',
    null,
    null,
    null,
    null,
    1000,
    6,
    1000,
    0
  )
  where effective_weight_status='canonical_available'
  limit 1;

  if not found
     or v_neutral.effective_weight_reference_id is null
     or v_neutral.effective_weight_kg_m is null
     or v_neutral.reference_price_eur_m
        <>round(v_neutral.effective_weight_kg_m,4)
     or v_neutral.reference_price_eur_piece
        <>round(v_neutral.effective_weight_kg_m*6,4)
     or v_neutral.price_semantic<>'canonical_reference_price'
     or v_neutral.effective_weight_semantic<>'canonical_exact_scope' then
    raise exception
      'SK4.5j grade-neutral canonical pricing contract regression';
  end if;

  -- Insert a different non-canonical reference in the same scope; it must not
  -- alter the effective result.
  insert into public.steel_weight_references (
    geometry_id,
    material_grade_id,
    weight_kg_m,
    weight_method,
    formula_version,
    is_canonical,
    metadata
  ) values (
    v_neutral.geometry_id,
    null,
    v_neutral.effective_weight_kg_m+0.123,
    'calculated',
    'SK4.5j-noncanonical-fixture',
    false,
    jsonb_build_object('migration_fixture','SK4.5j')
  )
  returning id into v_noncanonical_id;

  select *
  into v_after
  from public.p1_shared_steel_effective_weight(
    v_neutral.geometry_id,
    null
  );

  if v_after.effective_reference_id<>v_neutral.effective_weight_reference_id
     or v_after.effective_weight_kg_m<>v_neutral.effective_weight_kg_m
     or v_after.effective_reference_id=v_noncanonical_id then
    raise exception
      'SK4.5j non-canonical reference influenced effective weight';
  end if;

  delete from public.steel_weight_references
  where id=v_noncanonical_id;

  -- Grade-aware exact scope: P265GH has canonical coverage and 1000 EUR/t means
  -- numeric EUR/m equals numeric kg/m.
  select *
  into v_grade
  from public.p1_shared_steel_effective_dimensions(
    'EN 10216-2',
    'P265GH',
    null,
    null,
    null,
    1000,
    null,
    1000,
    0
  )
  where effective_weight_status='canonical_available'
  limit 1;

  if not found
     or v_grade.material_grade<>'P265GH'
     or v_grade.grade_scope<>'grade_specific'
     or v_grade.effective_weight_reference_id is null
     or v_grade.reference_price_eur_m
        <>round(v_grade.effective_weight_kg_m,4) then
    raise exception
      'SK4.5j grade-specific canonical pricing contract regression';
  end if;

  -- P235GH applicability exists but has no exact-scope canonical today. The API
  -- must surface missing canonical and refuse to price.
  select *
  into v_missing
  from public.p1_shared_steel_effective_dimensions(
    'EN 10216-2',
    'P235GH',
    null,
    null,
    null,
    1000,
    6,
    1000,
    0
  )
  limit 1;

  if not found
     or v_missing.effective_weight_status<>'canonical_missing'
     or v_missing.effective_weight_reference_id is not null
     or v_missing.effective_weight_kg_m is not null
     or v_missing.reference_price_eur_m is not null
     or v_missing.reference_price_eur_piece is not null
     or v_missing.price_semantic<>'unavailable_without_canonical' then
    raise exception
      'SK4.5j canonical-missing contract regression';
  end if;

  -- Legacy API has no grade input, so EN 10216-2 must not silently price from
  -- its dimensional row or P265GH canonical.
  select count(*)
  into v_invalid_price_count
  from public.p1_shared_steel_dimensions(
    'EN 10216-2',
    null,
    null,
    null,
    1000,
    6,
    1000,
    0
  ) x
  where x.theoretical_weight_kg_m is not null
     or x.reference_price_eur_m is not null
     or x.reference_price_eur_piece is not null;

  if v_invalid_price_count<>0 then
    raise exception
      'SK4.5j legacy API leaked a non-neutral or non-canonical weight into pricing';
  end if;

  -- Legacy neutral API remains functional where a neutral canonical exists.
  select *
  into v_legacy
  from public.p1_shared_steel_dimensions(
    'EN 10219',
    null,
    null,
    null,
    1000,
    6,
    1000,
    0
  )
  where theoretical_weight_kg_m is not null
  limit 1;

  if not found
     or v_legacy.reference_price_eur_m
        <>round(v_legacy.theoretical_weight_kg_m,4)
     or v_legacy.reference_price_eur_piece
        <>round(v_legacy.theoretical_weight_kg_m*6,4)
     or v_legacy.price_semantic<>'canonical_reference_price'
     or v_legacy.row_metadata->>'effective_weight_contract'
        <>'canonical_exact_scope' then
    raise exception
      'SK4.5j legacy neutral canonical contract regression';
  end if;

  if has_function_privilege(
       'anon',
       'public.p1_shared_steel_effective_weight(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.p1_shared_steel_effective_dimensions(text,text,text,numeric,numeric,numeric,numeric,integer,integer)',
       'EXECUTE'
     ) then
    raise exception
      'SK4.5j effective read contract must remain authenticated-only';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.p1_shared_steel_effective_weight(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.p1_shared_steel_effective_dimensions(text,text,text,numeric,numeric,numeric,numeric,integer,integer)',
       'EXECUTE'
     ) then
    raise exception
      'SK4.5j authenticated effective read privilege missing';
  end if;
end
$$;
