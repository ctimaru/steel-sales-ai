-- P1.15 / SK4.5j — effective-weight / canonical read contract.
--
-- Consumer contract for API, calculations and future frontend:
--   * the effective commercial weight is ONLY the explicit canonical reference
--     in the exact (geometry_id, material_grade_id) scope;
--   * NULL material_grade_id is a real grade-neutral scope and never falls back
--     to a grade-specific canonical;
--   * published / calculated / verified non-canonical rows remain evidence only;
--   * if no canonical exists, status is canonical_missing and calculation use is
--     blocked rather than silently falling back;
--   * read-only: no canonical, verification or decision state is mutated.

create or replace function public.p1_shared_steel_effective_weight(
  p_geometry_id uuid,
  p_material_grade_id uuid default null
)
returns table (
  geometry_id uuid,
  geometry_key text,
  material_grade_id uuid,
  material_grade text,
  scope_type text,
  effective_status text,
  canonical_found boolean,
  calculation_allowed boolean,
  effective_reference_id uuid,
  effective_weight_kg_m numeric,
  effective_weight_method text,
  effective_knowledge_source_id uuid,
  effective_source_key text,
  verification_decision_id uuid,
  latest_canonical_promotion_id uuid,
  latest_canonical_promoted_at timestamptz,
  scope_reference_count integer,
  scope_published_reference_count integer,
  scope_calculated_reference_count integer,
  scope_verified_reference_count integer,
  scope_noncanonical_verified_count integer,
  contract_version integer
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
begin
  if p_geometry_id is null then
    raise exception using errcode='22023',
      message='effective-weight lookup requires a geometry id';
  end if;

  if not exists (
    select 1 from public.steel_geometries g where g.id=p_geometry_id
  ) then
    raise exception using errcode='22023',
      message='effective-weight geometry was not found';
  end if;

  if p_material_grade_id is not null
     and not exists (
       select 1
       from public.steel_material_grades mg
       where mg.id=p_material_grade_id
     ) then
    raise exception using errcode='22023',
      message='effective-weight material grade was not found';
  end if;

  return query
  with scope_refs as (
    select w.*
    from public.steel_weight_references w
    where w.geometry_id=p_geometry_id
      and w.material_grade_id is not distinct from p_material_grade_id
  ),
  counts as (
    select
      count(*)::integer as reference_count,
      count(*) filter (where weight_method='published')::integer
        as published_count,
      count(*) filter (where weight_method='calculated')::integer
        as calculated_count,
      count(*) filter (where weight_method='verified')::integer
        as verified_count,
      count(*) filter (
        where weight_method='verified' and not is_canonical
      )::integer as noncanonical_verified_count
    from scope_refs
  ),
  canonical as (
    select w.*
    from scope_refs w
    where w.is_canonical
    limit 1
  ),
  latest_promotion as (
    select p.id,p.promoted_at
    from canonical c
    join public.steel_weight_canonical_promotions p
      on p.verified_reference_id=c.id
    order by p.promoted_at desc,p.created_at desc,p.id desc
    limit 1
  )
  select
    g.id,
    g.geometry_key,
    p_material_grade_id,
    mg.designation,
    case
      when p_material_grade_id is null then 'grade_neutral'
      else 'grade_specific'
    end,
    case
      when c.id is null then 'canonical_missing'
      else 'canonical_available'
    end,
    c.id is not null,
    c.id is not null,
    c.id,
    c.weight_kg_m,
    c.weight_method,
    c.knowledge_source_id,
    ks.source_key,
    c.verification_decision_id,
    lp.id,
    lp.promoted_at,
    cnt.reference_count,
    cnt.published_count,
    cnt.calculated_count,
    cnt.verified_count,
    cnt.noncanonical_verified_count,
    1
  from public.steel_geometries g
  cross join counts cnt
  left join public.steel_material_grades mg
    on mg.id=p_material_grade_id
  left join canonical c on true
  left join public.knowledge_sources ks
    on ks.id=c.knowledge_source_id
  left join latest_promotion lp on true
  where g.id=p_geometry_id;
end
$$;

comment on function public.p1_shared_steel_effective_weight(uuid,uuid) is
  'SK4.5j exact-scope read contract. Only is_canonical=true is an effective weight; non-canonical published/calculated/verified rows never fall back into commercial calculations.';

revoke all on function public.p1_shared_steel_effective_weight(uuid,uuid)
  from public,anon;

grant execute on function public.p1_shared_steel_effective_weight(uuid,uuid)
  to authenticated,service_role;

create or replace function public.p1_shared_steel_effective_weight_catalog(
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  geometry_id uuid,
  geometry_key text,
  material_grade_id uuid,
  material_grade text,
  scope_type text,
  effective_status text,
  canonical_found boolean,
  calculation_allowed boolean,
  effective_reference_id uuid,
  effective_weight_kg_m numeric,
  effective_weight_method text,
  scope_reference_count integer,
  scope_verified_reference_count integer,
  scope_noncanonical_verified_count integer,
  contract_version integer
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
begin
  if p_status is not null
     and p_status not in ('canonical_available','canonical_missing') then
    raise exception using errcode='22023',
      message='effective-weight catalog status must be canonical_available or canonical_missing';
  end if;

  if p_limit is null or p_limit<1 or p_limit>1000 then
    raise exception using errcode='22023',
      message='effective-weight catalog limit must be between 1 and 1000';
  end if;

  if p_offset is null or p_offset<0 then
    raise exception using errcode='22023',
      message='effective-weight catalog offset must be non-negative';
  end if;

  return query
  with scopes as (
    select distinct w.geometry_id,w.material_grade_id
    from public.steel_weight_references w
  ),
  evaluated as (
    select e.*
    from scopes s
    cross join lateral public.p1_shared_steel_effective_weight(
      s.geometry_id,
      s.material_grade_id
    ) e
  )
  select
    e.geometry_id,
    e.geometry_key,
    e.material_grade_id,
    e.material_grade,
    e.scope_type,
    e.effective_status,
    e.canonical_found,
    e.calculation_allowed,
    e.effective_reference_id,
    e.effective_weight_kg_m,
    e.effective_weight_method,
    e.scope_reference_count,
    e.scope_verified_reference_count,
    e.scope_noncanonical_verified_count,
    e.contract_version
  from evaluated e
  where p_status is null or e.effective_status=p_status
  order by
    case e.effective_status
      when 'canonical_missing' then 1
      else 2
    end,
    e.geometry_key,
    e.material_grade nulls first
  limit p_limit offset p_offset;
end
$$;

comment on function public.p1_shared_steel_effective_weight_catalog(text,integer,integer) is
  'SK4.5j catalog of every geometry+grade scope with explicit canonical_available/canonical_missing status. Useful for API/frontend coverage and QA.';

revoke all on function public.p1_shared_steel_effective_weight_catalog(
  text,integer,integer
) from public,anon;

grant execute on function public.p1_shared_steel_effective_weight_catalog(
  text,integer,integer
) to authenticated,service_role;

create or replace function public.p1_steel_price_per_meter_from_effective_weight(
  p_geometry_id uuid,
  p_material_grade_id uuid,
  p_price_per_tonne numeric
)
returns table (
  effective_status text,
  calculation_allowed boolean,
  effective_reference_id uuid,
  effective_weight_kg_m numeric,
  price_per_tonne numeric,
  price_per_meter numeric,
  formula text,
  contract_version integer
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
declare
  v_effective record;
begin
  if p_price_per_tonne is null or p_price_per_tonne<0 then
    raise exception using errcode='22023',
      message='price per tonne must be non-negative';
  end if;

  select * into v_effective
  from public.p1_shared_steel_effective_weight(
    p_geometry_id,
    p_material_grade_id
  );

  return query
  select
    v_effective.effective_status,
    v_effective.calculation_allowed,
    v_effective.effective_reference_id,
    v_effective.effective_weight_kg_m,
    p_price_per_tonne,
    case
      when v_effective.calculation_allowed
        then round(
          (p_price_per_tonne*v_effective.effective_weight_kg_m/1000.0)::numeric,
          6
        )
      else null::numeric
    end,
    'price_per_tonne * canonical_weight_kg_m / 1000',
    1;
end
$$;

comment on function public.p1_steel_price_per_meter_from_effective_weight(
  uuid,uuid,numeric
) is
  'SK4.5j calculation contract for tonne-priced steel. €/m or other currency-per-meter is produced only from the explicit canonical weight; returns NULL when canonical_missing.';

revoke all on function public.p1_steel_price_per_meter_from_effective_weight(
  uuid,uuid,numeric
) from public,anon;

grant execute on function public.p1_steel_price_per_meter_from_effective_weight(
  uuid,uuid,numeric
) to authenticated,service_role;

-- Acceptance assertions:
--   1) a real canonical scope is usable and drives price-per-meter;
--   2) a scope containing a temporary verified non-canonical but no canonical
--      remains canonical_missing and calculation is blocked;
--   3) no reference/canonical state is changed by these read APIs.
do $$
declare
  v_existing public.steel_weight_references;
  v_existing_effective record;
  v_price record;
  v_candidate record;
  v_reconciliation public.steel_weight_reconciliation_decisions;
  v_verified public.steel_weight_references;
  v_missing record;
  v_missing_price record;
  v_actor uuid := gen_random_uuid();
  v_before_canonical_count integer;
  v_after_canonical_count integer;
begin
  select * into v_existing
  from public.steel_weight_references
  where is_canonical
  order by id
  limit 1;

  if v_existing.id is null then
    raise exception 'SK4.5j requires at least one canonical reference';
  end if;

  select * into v_existing_effective
  from public.p1_shared_steel_effective_weight(
    v_existing.geometry_id,
    v_existing.material_grade_id
  );

  if v_existing_effective.effective_status<>'canonical_available'
     or not v_existing_effective.canonical_found
     or not v_existing_effective.calculation_allowed
     or v_existing_effective.effective_reference_id<>v_existing.id
     or v_existing_effective.effective_weight_kg_m<>v_existing.weight_kg_m then
    raise exception 'SK4.5j canonical read contract regression';
  end if;

  select * into v_price
  from public.p1_steel_price_per_meter_from_effective_weight(
    v_existing.geometry_id,
    v_existing.material_grade_id,
    1000
  );

  if not v_price.calculation_allowed
     or v_price.price_per_meter<>round(v_existing.weight_kg_m,6) then
    raise exception 'SK4.5j price-per-meter canonical calculation regression';
  end if;

  select count(*) into v_before_canonical_count
  from public.steel_weight_references
  where is_canonical;

  select c.* into v_candidate
  from public.p1_shared_steel_weight_reconciliation_candidates(
    0.50,'exact_match',1000,0
  ) c
  where not exists (
    select 1
    from public.steel_weight_reconciliation_decisions d
    where d.left_reference_id=c.left_reference_id
      and d.right_reference_id=c.right_reference_id
  )
    and (
      (c.left_material_grade_id is null and c.right_material_grade_id is not null)
      or
      (c.left_material_grade_id is not null and c.right_material_grade_id is null)
    )
    and not exists (
      select 1
      from public.steel_weight_references x
      where x.geometry_id=c.geometry_id
        and x.material_grade_id is null
        and x.is_canonical
    )
  order by c.geometry_key,c.left_reference_id,c.right_reference_id
  limit 1;

  if v_candidate.left_reference_id is null then
    raise exception 'SK4.5j requires one unreviewed grade-neutral candidate without a canonical';
  end if;

  insert into auth.users (
    instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_actor,
    'authenticated',
    'authenticated',
    'sk45j-ci-'||v_actor::text||'@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  select * into v_reconciliation
  from public.p1_record_steel_weight_reconciliation_decision(
    v_candidate.left_reference_id,
    v_candidate.right_reference_id,
    0.50,
    'accepted',
    'SK4.5j temporary verification fixture',
    v_actor
  );

  select * into v_verified
  from public.p1_promote_steel_weight_reconciliation_decision(
    v_reconciliation.id,
    null,
    'SK4.5j temporary non-canonical verified fixture',
    v_actor
  );

  if v_verified.material_grade_id is not null or v_verified.is_canonical then
    raise exception 'SK4.5j missing-canonical fixture must be grade-neutral and non-canonical';
  end if;

  select * into v_missing
  from public.p1_shared_steel_effective_weight(
    v_verified.geometry_id,
    null
  );

  if v_missing.effective_status<>'canonical_missing'
     or v_missing.canonical_found
     or v_missing.calculation_allowed
     or v_missing.effective_reference_id is not null
     or v_missing.effective_weight_kg_m is not null
     or v_missing.scope_verified_reference_count<1
     or v_missing.scope_noncanonical_verified_count<1 then
    raise exception
      'SK4.5j non-canonical verified reference leaked into effective-weight contract';
  end if;

  select * into v_missing_price
  from public.p1_steel_price_per_meter_from_effective_weight(
    v_verified.geometry_id,
    null,
    1000
  );

  if v_missing_price.effective_status<>'canonical_missing'
     or v_missing_price.calculation_allowed
     or v_missing_price.price_per_meter is not null then
    raise exception
      'SK4.5j commercial calculation unexpectedly fell back without canonical';
  end if;

  if (
    select count(*)
    from public.p1_shared_steel_effective_weight_catalog(
      'canonical_missing',1000,0
    ) c
    where c.geometry_id=v_verified.geometry_id
      and c.material_grade_id is null
  )<>1 then
    raise exception 'SK4.5j missing scope not surfaced by effective-weight catalog';
  end if;

  if has_function_privilege(
       'anon',
       'public.p1_shared_steel_effective_weight(uuid,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.p1_shared_steel_effective_weight_catalog(text,integer,integer)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.p1_steel_price_per_meter_from_effective_weight(uuid,uuid,numeric)',
       'EXECUTE'
     ) then
    raise exception 'SK4.5j read/calculation contract must not be anon executable';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.p1_shared_steel_effective_weight(uuid,uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.p1_shared_steel_effective_weight_catalog(text,integer,integer)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.p1_steel_price_per_meter_from_effective_weight(uuid,uuid,numeric)',
       'EXECUTE'
     ) then
    raise exception 'SK4.5j authenticated read/calculation execute privilege missing';
  end if;

  delete from public.steel_weight_references
  where id=v_verified.id;

  delete from public.steel_weight_reconciliation_decisions
  where id=v_reconciliation.id;

  delete from auth.users
  where id=v_actor;

  select count(*) into v_after_canonical_count
  from public.steel_weight_references
  where is_canonical;

  if v_after_canonical_count<>v_before_canonical_count then
    raise exception 'SK4.5j read contract changed canonical state';
  end if;
end
$$;
