-- P1.15 / SK4.5a — reusable weight reconciliation rule.
--
-- Goal:
--   turn the P265GH two-source validation pattern into a reusable, read-only
--   reconciliation contract without automatically mutating canonical weights.
--
-- Semantics:
--   1) compare only positive kg/m values;
--   2) use symmetric percentage difference versus the mean of the two weights;
--   3) default tolerance = 0.50%;
--   4) exact_match is distinct from within_tolerance;
--   5) cross-verification eligibility additionally requires same geometry and
--      independent knowledge sources;
--   6) no automatic promotion to verified/canonical occurs here.

create or replace function public.steel_weight_reconciliation_class(
  p_left_weight_kg_m numeric,
  p_right_weight_kg_m numeric,
  p_tolerance_pct numeric default 0.50
)
returns table (
  absolute_delta_kg_m numeric,
  delta_pct numeric,
  reconciliation_status text,
  within_tolerance boolean
)
language plpgsql
immutable
strict
parallel safe
set search_path = public, pg_temp
as $$
declare
  v_mean numeric;
begin
  if p_left_weight_kg_m <= 0 or p_right_weight_kg_m <= 0 then
    raise exception using
      errcode = '22023',
      message = 'steel weight reconciliation requires positive kg/m values';
  end if;

  if p_tolerance_pct < 0 then
    raise exception using
      errcode = '22023',
      message = 'steel weight reconciliation tolerance must be non-negative';
  end if;

  v_mean := (p_left_weight_kg_m + p_right_weight_kg_m) / 2.0;
  absolute_delta_kg_m := round(abs(p_left_weight_kg_m - p_right_weight_kg_m), 6);
  delta_pct := round((abs(p_left_weight_kg_m - p_right_weight_kg_m) / v_mean) * 100.0, 6);

  if p_left_weight_kg_m = p_right_weight_kg_m then
    reconciliation_status := 'exact_match';
    within_tolerance := true;
  elsif delta_pct <= p_tolerance_pct then
    reconciliation_status := 'within_tolerance';
    within_tolerance := true;
  else
    reconciliation_status := 'mismatch';
    within_tolerance := false;
  end if;

  return next;
end
$$;

comment on function public.steel_weight_reconciliation_class(numeric, numeric, numeric) is
  'Pure kg/m comparison helper. Uses symmetric percent difference versus the mean; does not assess geometry/source independence or mutate canonical data.';

create or replace function public.p1_shared_steel_weight_reconciliation(
  p_left_reference_id uuid,
  p_right_reference_id uuid,
  p_tolerance_pct numeric default 0.50
)
returns table (
  left_reference_id uuid,
  right_reference_id uuid,
  same_geometry boolean,
  independent_sources boolean,
  left_source_key text,
  right_source_key text,
  left_weight_kg_m numeric,
  right_weight_kg_m numeric,
  absolute_delta_kg_m numeric,
  delta_pct numeric,
  tolerance_pct numeric,
  reconciliation_status text,
  eligible_for_cross_verification boolean
)
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_left record;
  v_right record;
  v_cmp record;
  v_left_found boolean;
  v_right_found boolean;
begin
  if p_tolerance_pct is null or p_tolerance_pct < 0 then
    raise exception using
      errcode = '22023',
      message = 'steel weight reconciliation tolerance must be non-negative';
  end if;

  select
    w.id,
    w.geometry_id,
    w.weight_kg_m,
    w.knowledge_source_id,
    s.source_key,
    lower(trim(coalesce(
      nullif(s.metadata->>'independence_group',''),
      nullif(s.provider,''),
      s.source_key
    ))) as independence_key
  into v_left
  from public.steel_weight_references w
  left join public.knowledge_sources s on s.id = w.knowledge_source_id
  where w.id = p_left_reference_id;
  v_left_found := found;

  select
    w.id,
    w.geometry_id,
    w.weight_kg_m,
    w.knowledge_source_id,
    s.source_key,
    lower(trim(coalesce(
      nullif(s.metadata->>'independence_group',''),
      nullif(s.provider,''),
      s.source_key
    ))) as independence_key
  into v_right
  from public.steel_weight_references w
  left join public.knowledge_sources s on s.id = w.knowledge_source_id
  where w.id = p_right_reference_id;
  v_right_found := found;

  left_reference_id := p_left_reference_id;
  right_reference_id := p_right_reference_id;
  tolerance_pct := p_tolerance_pct;

  if not v_left_found or not v_right_found then
    same_geometry := false;
    independent_sources := false;
    left_source_key := case when v_left_found then v_left.source_key else null end;
    right_source_key := case when v_right_found then v_right.source_key else null end;
    left_weight_kg_m := case when v_left_found then v_left.weight_kg_m else null end;
    right_weight_kg_m := case when v_right_found then v_right.weight_kg_m else null end;
    absolute_delta_kg_m := null;
    delta_pct := null;
    reconciliation_status := case
      when not v_left_found and not v_right_found then 'missing_both_references'
      when not v_left_found then 'missing_left_reference'
      else 'missing_right_reference'
    end;
    eligible_for_cross_verification := false;
    return next;
    return;
  end if;

  same_geometry := v_left.geometry_id = v_right.geometry_id;
  independent_sources :=
    v_left.knowledge_source_id is not null
    and v_right.knowledge_source_id is not null
    and v_left.knowledge_source_id <> v_right.knowledge_source_id
    and v_left.independence_key is not null
    and v_right.independence_key is not null
    and v_left.independence_key <> v_right.independence_key;

  left_source_key := v_left.source_key;
  right_source_key := v_right.source_key;
  left_weight_kg_m := v_left.weight_kg_m;
  right_weight_kg_m := v_right.weight_kg_m;

  select * into v_cmp
  from public.steel_weight_reconciliation_class(
    v_left.weight_kg_m,
    v_right.weight_kg_m,
    p_tolerance_pct
  );

  absolute_delta_kg_m := v_cmp.absolute_delta_kg_m;
  delta_pct := v_cmp.delta_pct;

  if not same_geometry then
    reconciliation_status := 'geometry_mismatch';
    eligible_for_cross_verification := false;
  elsif not independent_sources then
    reconciliation_status := 'source_not_independent';
    eligible_for_cross_verification := false;
  else
    reconciliation_status := v_cmp.reconciliation_status;
    eligible_for_cross_verification := v_cmp.within_tolerance;
  end if;

  return next;
end
$$;

comment on function public.p1_shared_steel_weight_reconciliation(uuid, uuid, numeric) is
  'Read-only reconciliation of two shared steel weight references. Requires same geometry and independent sources before a mass comparison can be eligible for cross-verification. No canonical/verified mutation is performed.';

revoke all on function public.steel_weight_reconciliation_class(numeric, numeric, numeric) from public;
revoke all on function public.p1_shared_steel_weight_reconciliation(uuid, uuid, numeric) from public;
grant execute on function public.steel_weight_reconciliation_class(numeric, numeric, numeric) to authenticated, service_role;
grant execute on function public.p1_shared_steel_weight_reconciliation(uuid, uuid, numeric) to authenticated, service_role;

-- Deterministic migration assertions.
do $$
declare
  v_status text;
  v_delta_pct numeric;
  v_eligible boolean;
  v_same_geometry boolean;
  v_independent boolean;
  v_msz_id uuid;
  v_ferro_id uuid;
  v_other_msz_id uuid;
begin
  select reconciliation_status, delta_pct, within_tolerance
    into v_status, v_delta_pct, v_eligible
  from public.steel_weight_reconciliation_class(100.0, 100.0, 0.50);
  if v_status <> 'exact_match' or v_delta_pct <> 0 or not v_eligible then
    raise exception 'SK4.5a exact-match classifier regression: status %, delta %, within %', v_status, v_delta_pct, v_eligible;
  end if;

  select reconciliation_status, delta_pct, within_tolerance
    into v_status, v_delta_pct, v_eligible
  from public.steel_weight_reconciliation_class(100.0, 100.4, 0.50);
  if v_status <> 'within_tolerance' or v_delta_pct > 0.50 or not v_eligible then
    raise exception 'SK4.5a tolerance classifier regression: status %, delta %, within %', v_status, v_delta_pct, v_eligible;
  end if;

  select reconciliation_status, delta_pct, within_tolerance
    into v_status, v_delta_pct, v_eligible
  from public.steel_weight_reconciliation_class(100.0, 101.0, 0.50);
  if v_status <> 'mismatch' or v_delta_pct <= 0.50 or v_eligible then
    raise exception 'SK4.5a mismatch classifier regression: status %, delta %, within %', v_status, v_delta_pct, v_eligible;
  end if;

  select m.id, f.id
    into v_msz_id, v_ferro_id
  from public.steel_weight_references m
  join public.knowledge_sources ms on ms.id = m.knowledge_source_id
  join public.steel_geometries g on g.id = m.geometry_id
  join public.steel_weight_references f
    on f.geometry_id = m.geometry_id
   and f.material_grade_id is null
   and f.weight_method = 'published'
  join public.knowledge_sources fs on fs.id = f.knowledge_source_id
  where ms.source_key = 'primary:msz:en10216-2-p265gh-dimensions'
    and fs.source_key = 'secondary:ferrostaal:piping-supply-catalogue-2014-dimensions'
    and g.geometry_key = 'round|od=168.3|t=7.11'
    and m.weight_kg_m = 28.26
    and f.weight_kg_m = 28.26
  limit 1;

  if v_msz_id is null or v_ferro_id is null then
    raise exception 'SK4.5a expected P265GH/Ferrostaal exact pair was not found';
  end if;

  select reconciliation_status, eligible_for_cross_verification, same_geometry, independent_sources
    into v_status, v_eligible, v_same_geometry, v_independent
  from public.p1_shared_steel_weight_reconciliation(v_msz_id, v_ferro_id, 0.50);

  if v_status <> 'exact_match' or not v_eligible or not v_same_geometry or not v_independent then
    raise exception 'SK4.5a exact pair contract regression: status %, eligible %, geometry %, independent %',
      v_status, v_eligible, v_same_geometry, v_independent;
  end if;

  select reconciliation_status, eligible_for_cross_verification
    into v_status, v_eligible
  from public.p1_shared_steel_weight_reconciliation(v_msz_id, v_msz_id, 0.50);

  if v_status <> 'source_not_independent' or v_eligible then
    raise exception 'SK4.5a source-independence regression: status %, eligible %', v_status, v_eligible;
  end if;

  select w.id into v_other_msz_id
  from public.steel_weight_references w
  join public.knowledge_sources s on s.id = w.knowledge_source_id
  join public.steel_geometries g on g.id = w.geometry_id
  where s.source_key = 'primary:msz:en10216-2-p265gh-dimensions'
    and g.geometry_key = 'round|od=219.1|t=8.18'
    and w.weight_method = 'published'
    and w.weight_kg_m = 42.55
  limit 1;

  select reconciliation_status, eligible_for_cross_verification, same_geometry
    into v_status, v_eligible, v_same_geometry
  from public.p1_shared_steel_weight_reconciliation(v_other_msz_id, v_ferro_id, 0.50);

  if v_status <> 'geometry_mismatch' or v_eligible or v_same_geometry then
    raise exception 'SK4.5a geometry regression: status %, eligible %, same_geometry %', v_status, v_eligible, v_same_geometry;
  end if;
end
$$;