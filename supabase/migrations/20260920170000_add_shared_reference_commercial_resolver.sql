-- P1.15 / SK6 — resolve commercial steel observations against Shared Steel Knowledge.
--
-- Exact-scope, read-only contract used by Search, Product History and parser validation.
-- No fuzzy equivalence is introduced here: standard, grade and geometry must resolve
-- explicitly; effective commercial weight is delegated to SK4.5j.

create or replace function public.p1_resolve_shared_steel_reference(
  p_standard text default null,
  p_grade text default null,
  p_product_family text default null,
  p_outer_diameter_mm numeric default null,
  p_width_mm numeric default null,
  p_height_mm numeric default null,
  p_thickness_mm numeric default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  v_standard_key text;
  v_grade_key text;
  v_family text;
  v_standard public.steel_standards%rowtype;
  v_grade public.steel_material_grades%rowtype;
  v_geometry public.steel_geometries%rowtype;
  v_effective record;
  v_grade_applicable boolean := null;
  v_dimension_applicable boolean := null;
  v_resolution_status text;
begin
  v_standard_key := nullif(regexp_replace(lower(coalesce(p_standard,'')),'[^a-z0-9]+','','g'),'');
  v_grade_key := nullif(regexp_replace(lower(coalesce(p_grade,'')),'[^a-z0-9]+','','g'),'');

  v_family := nullif(trim(p_product_family),'');
  if v_family is null then
    v_family := case
      when p_outer_diameter_mm is not null then 'round_tube'
      when p_width_mm is not null and p_height_mm is not null and p_width_mm=p_height_mm then 'square_tube'
      when p_width_mm is not null and p_height_mm is not null then 'rectangular_tube'
      else null
    end;
  end if;

  if p_thickness_mm is null
     or (
       p_outer_diameter_mm is null
       and (p_width_mm is null or p_height_mm is null)
     ) then
    return jsonb_build_object(
      'resolution_status','insufficient_dimensions',
      'matched',false,
      'calculation_allowed',false,
      'contract_version',1
    );
  end if;

  if v_standard_key is not null then
    select * into v_standard
    from public.steel_standards s
    where s.code_key=v_standard_key
    order by (s.status='active') desc,s.created_at
    limit 1;

    if v_standard.id is null then
      return jsonb_build_object(
        'resolution_status','standard_not_found',
        'matched',false,
        'standard_input',p_standard,
        'calculation_allowed',false,
        'contract_version',1
      );
    end if;
  end if;

  if v_grade_key is not null then
    select * into v_grade
    from public.steel_material_grades g
    where g.designation_key=v_grade_key
       or g.material_number_key=v_grade_key
    order by (g.designation_key=v_grade_key) desc,g.created_at
    limit 1;

    if v_grade.id is null then
      return jsonb_build_object(
        'resolution_status','grade_not_found',
        'matched',false,
        'standard_id',v_standard.id,
        'standard_code',v_standard.code,
        'grade_input',p_grade,
        'calculation_allowed',false,
        'contract_version',1
      );
    end if;
  end if;

  select * into v_geometry
  from public.steel_geometries geo
  where geo.product_family=v_family
    and geo.thickness_mm=p_thickness_mm
    and (
      (v_family='round_tube'
        and geo.outer_diameter_mm=p_outer_diameter_mm
        and geo.width_mm is null
        and geo.height_mm is null)
      or
      (v_family in ('square_tube','rectangular_tube')
        and geo.outer_diameter_mm is null
        and geo.width_mm=p_width_mm
        and geo.height_mm=p_height_mm)
    )
  order by geo.created_at
  limit 1;

  if v_geometry.id is null then
    return jsonb_build_object(
      'resolution_status','geometry_not_found',
      'matched',false,
      'standard_id',v_standard.id,
      'standard_code',v_standard.code,
      'material_grade_id',v_grade.id,
      'material_grade',v_grade.designation,
      'product_family',v_family,
      'calculation_allowed',false,
      'contract_version',1
    );
  end if;

  if v_standard.id is not null and v_grade.id is not null then
    select exists(
      select 1
      from public.steel_standard_grade_applicability ga
      where ga.standard_id=v_standard.id
        and ga.material_grade_id=v_grade.id
        and (ga.product_family is null or ga.product_family=v_family)
    ) into v_grade_applicable;

    if not v_grade_applicable then
      return jsonb_build_object(
        'resolution_status','standard_grade_not_applicable',
        'matched',false,
        'standard_id',v_standard.id,
        'standard_code',v_standard.code,
        'material_grade_id',v_grade.id,
        'material_grade',v_grade.designation,
        'geometry_id',v_geometry.id,
        'geometry_key',v_geometry.geometry_key,
        'product_family',v_family,
        'standard_grade_applicable',false,
        'calculation_allowed',false,
        'contract_version',1
      );
    end if;
  end if;

  if v_standard.id is not null then
    select exists(
      select 1
      from public.steel_standard_dimension_applicability da
      where da.standard_id=v_standard.id
        and da.geometry_id=v_geometry.id
        and (
          da.material_grade_id is null
          or da.material_grade_id is not distinct from v_grade.id
        )
    ) into v_dimension_applicable;

    if not v_dimension_applicable then
      return jsonb_build_object(
        'resolution_status','standard_dimension_not_applicable',
        'matched',false,
        'standard_id',v_standard.id,
        'standard_code',v_standard.code,
        'material_grade_id',v_grade.id,
        'material_grade',v_grade.designation,
        'geometry_id',v_geometry.id,
        'geometry_key',v_geometry.geometry_key,
        'product_family',v_family,
        'standard_grade_applicable',v_grade_applicable,
        'standard_dimension_applicable',false,
        'calculation_allowed',false,
        'contract_version',1
      );
    end if;
  end if;

  select * into v_effective
  from public.p1_shared_steel_effective_weight(
    v_geometry.id,
    v_grade.id
  );

  v_resolution_status := case
    when v_effective.effective_status='canonical_available'
      then 'matched'
    else 'matched_canonical_missing'
  end;

  return jsonb_build_object(
    'resolution_status',v_resolution_status,
    'matched',true,
    'standard_id',v_standard.id,
    'standard_code',v_standard.code,
    'material_grade_id',v_grade.id,
    'material_grade',v_grade.designation,
    'material_number',v_grade.material_number,
    'geometry_id',v_geometry.id,
    'geometry_key',v_geometry.geometry_key,
    'product_family',v_geometry.product_family,
    'standard_grade_applicable',v_grade_applicable,
    'standard_dimension_applicable',v_dimension_applicable,
    'effective_status',v_effective.effective_status,
    'calculation_allowed',v_effective.calculation_allowed,
    'effective_reference_id',v_effective.effective_reference_id,
    'effective_weight_kg_m',v_effective.effective_weight_kg_m,
    'effective_weight_method',v_effective.effective_weight_method,
    'effective_source_key',v_effective.effective_source_key,
    'contract_version',1
  );
end
$$;

comment on function public.p1_resolve_shared_steel_reference(
  text,text,text,numeric,numeric,numeric,numeric
) is
  'SK6 exact commercial-observation resolver into Shared Steel Knowledge. Validates standard/grade/geometry applicability and delegates effective weight to the canonical-only SK4.5j contract.';

revoke all on function public.p1_resolve_shared_steel_reference(
  text,text,text,numeric,numeric,numeric,numeric
) from public,anon;

grant execute on function public.p1_resolve_shared_steel_reference(
  text,text,text,numeric,numeric,numeric,numeric
) to authenticated,service_role;

do $$
declare
  v_match jsonb;
  v_missing jsonb;
begin
  v_match := public.p1_resolve_shared_steel_reference(
    'EN 10216-2','P265GH','round_tube',21.30,null,null,2.77
  );

  if v_match->>'resolution_status' <> 'matched'
     or coalesce((v_match->>'matched')::boolean,false) is not true
     or coalesce((v_match->>'calculation_allowed')::boolean,false) is not true
     or (v_match->>'effective_weight_kg_m')::numeric <> 1.27 then
    raise exception 'SK6 reference resolver canonical fixture regression: %',v_match;
  end if;

  v_missing := public.p1_resolve_shared_steel_reference(
    'EN 10216-2','P265GH','round_tube',999.99,null,null,9.99
  );

  if v_missing->>'resolution_status' <> 'geometry_not_found'
     or coalesce((v_missing->>'calculation_allowed')::boolean,false) then
    raise exception 'SK6 reference resolver missing geometry regression: %',v_missing;
  end if;

  if has_function_privilege(
       'anon',
       'public.p1_resolve_shared_steel_reference(text,text,text,numeric,numeric,numeric,numeric)',
       'EXECUTE'
     ) then
    raise exception 'SK6 reference resolver must not be anon executable';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.p1_resolve_shared_steel_reference(text,text,text,numeric,numeric,numeric,numeric)',
       'EXECUTE'
     ) then
    raise exception 'SK6 authenticated resolver execute privilege missing';
  end if;
end
$$;


-- Route parser/reference conflicts to the existing commercial Review Queue even
-- when syntactic parser confidence is high. Canonical-weight coverage gaps are
-- deliberately not review-routed: they are catalog coverage, not parser errors.
create or replace function public.route_shared_reference_conflict_to_review()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_metadata jsonb;
  v_issue jsonb;
  v_reason text;
  v_severity text;
begin
  if new.source_extraction_id is null then
    return new;
  end if;

  select s.metadata into v_metadata
  from public.worker_staging_observations s
  where s.id=new.source_extraction_id;

  select x.value into v_issue
  from jsonb_array_elements(
    case
      when jsonb_typeof(v_metadata #> '{validation,issues}')='array'
        then v_metadata #> '{validation,issues}'
      else '[]'::jsonb
    end
  ) as x(value)
  where x.value->>'code' in (
    'reference_standard_not_found',
    'reference_grade_not_found',
    'reference_geometry_not_found',
    'reference_standard_grade_not_applicable',
    'reference_standard_dimension_not_applicable'
  )
  order by case x.value->>'severity' when 'error' then 1 else 2 end
  limit 1;

  if v_issue is null then
    return new;
  end if;

  v_reason := v_issue->>'code';
  v_severity := case when v_issue->>'severity'='error' then 'error' else 'warning' end;

  insert into public.commercial_review_queue (
    owner_id,organization_id,dataset_id,thread_id,source_review_id,
    source_extraction_ordinal,reason,severity,source_text,status,observation_id
  ) values (
    new.owner_id,new.organization_id,new.dataset_id,new.thread_id,new.id,
    null,v_reason,v_severity,new.source_text,'pending',new.id
  )
  on conflict (owner_id,dataset_id,source_review_id) do nothing;

  return new;
end
$$;

drop trigger if exists commercial_observations_shared_reference_review
  on public.commercial_observations;

create trigger commercial_observations_shared_reference_review
after insert on public.commercial_observations
for each row
execute function public.route_shared_reference_conflict_to_review();

revoke execute on function public.route_shared_reference_conflict_to_review()
  from public,anon,authenticated;
grant execute on function public.route_shared_reference_conflict_to_review()
  to service_role;

comment on function public.route_shared_reference_conflict_to_review() is
  'SK6 routes high-confidence parser observations with Shared Steel Knowledge identity/applicability conflicts into the existing tenant-scoped review queue.';
