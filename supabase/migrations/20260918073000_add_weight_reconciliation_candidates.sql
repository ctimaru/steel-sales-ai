-- P1.15 / SK4.5b — automatic weight reconciliation candidate generator.
--
-- Goal:
--   enumerate pairwise reconciliation candidates for canonical geometries that
--   have published kg/m references from at least two independent sources.
--
-- Semantics:
--   * published weights only in this first tranche;
--   * same canonical geometry is mandatory;
--   * source independence uses the same provider/independence_group contract as
--     p1_shared_steel_weight_reconciliation(...);
--   * exact_match / within_tolerance / mismatch are classified with the reusable
--     steel_weight_reconciliation_class(...) helper;
--   * no automatic mutation of is_canonical, weight_method, verified_at or source data.

create or replace function public.p1_shared_steel_weight_reconciliation_candidates(
  p_tolerance_pct numeric default 0.50,
  p_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  left_reference_id uuid,
  right_reference_id uuid,
  geometry_id uuid,
  geometry_key text,
  product_family text,
  outer_diameter_mm numeric,
  width_mm numeric,
  height_mm numeric,
  thickness_mm numeric,
  left_material_grade_id uuid,
  right_material_grade_id uuid,
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
begin
  if p_tolerance_pct is null or p_tolerance_pct < 0 then
    raise exception using
      errcode = '22023',
      message = 'steel weight reconciliation tolerance must be non-negative';
  end if;

  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using
      errcode = '22023',
      message = 'steel weight reconciliation candidate limit must be between 1 and 1000';
  end if;

  if p_offset is null or p_offset < 0 then
    raise exception using
      errcode = '22023',
      message = 'steel weight reconciliation candidate offset must be non-negative';
  end if;

  if p_status is not null
     and p_status not in ('exact_match', 'within_tolerance', 'mismatch') then
    raise exception using
      errcode = '22023',
      message = 'steel weight reconciliation candidate status must be exact_match, within_tolerance, mismatch, or null';
  end if;

  return query
  with refs as (
    select
      w.id,
      w.geometry_id,
      w.material_grade_id,
      w.weight_kg_m,
      w.knowledge_source_id,
      s.source_key,
      lower(trim(coalesce(
        nullif(s.metadata->>'independence_group',''),
        nullif(s.provider,''),
        s.source_key
      ))) as independence_key
    from public.steel_weight_references w
    join public.knowledge_sources s
      on s.id = w.knowledge_source_id
    where w.weight_method = 'published'
      and w.weight_kg_m > 0
      and w.knowledge_source_id is not null
  ),
  pairs as (
    select
      l.id as left_reference_id,
      r.id as right_reference_id,
      l.geometry_id,
      l.material_grade_id as left_material_grade_id,
      r.material_grade_id as right_material_grade_id,
      l.source_key as left_source_key,
      r.source_key as right_source_key,
      l.weight_kg_m as left_weight_kg_m,
      r.weight_kg_m as right_weight_kg_m
    from refs l
    join refs r
      on r.geometry_id = l.geometry_id
     and l.id < r.id
    where l.knowledge_source_id <> r.knowledge_source_id
      and l.independence_key is not null
      and r.independence_key is not null
      and l.independence_key <> r.independence_key
  ),
  classified as (
    select
      p.*,
      c.absolute_delta_kg_m,
      c.delta_pct,
      c.reconciliation_status,
      c.within_tolerance
    from pairs p
    cross join lateral public.steel_weight_reconciliation_class(
      p.left_weight_kg_m,
      p.right_weight_kg_m,
      p_tolerance_pct
    ) c
  )
  select
    c.left_reference_id,
    c.right_reference_id,
    c.geometry_id,
    g.geometry_key,
    g.product_family,
    g.outer_diameter_mm,
    g.width_mm,
    g.height_mm,
    g.thickness_mm,
    c.left_material_grade_id,
    c.right_material_grade_id,
    c.left_source_key,
    c.right_source_key,
    c.left_weight_kg_m,
    c.right_weight_kg_m,
    c.absolute_delta_kg_m,
    c.delta_pct,
    p_tolerance_pct,
    c.reconciliation_status,
    c.within_tolerance as eligible_for_cross_verification
  from classified c
  join public.steel_geometries g on g.id = c.geometry_id
  where p_status is null or c.reconciliation_status = p_status
  order by
    case c.reconciliation_status
      when 'mismatch' then 1
      when 'within_tolerance' then 2
      else 3
    end,
    c.delta_pct desc,
    g.geometry_key,
    c.left_reference_id,
    c.right_reference_id
  limit p_limit
  offset p_offset;
end
$$;

comment on function public.p1_shared_steel_weight_reconciliation_candidates(numeric, text, integer, integer) is
  'Read-only pairwise candidate generator for independent published steel weight references on the same canonical geometry. Classifies exact/tolerance/mismatch and never promotes canonical or verified data.';

revoke all on function public.p1_shared_steel_weight_reconciliation_candidates(numeric, text, integer, integer) from public;
revoke all on function public.p1_shared_steel_weight_reconciliation_candidates(numeric, text, integer, integer) from anon;
grant execute on function public.p1_shared_steel_weight_reconciliation_candidates(numeric, text, integer, integer)
  to authenticated, service_role;

-- Deterministic migration assertions for the controlled SK4.3/SK4.5 dataset state.
do $$
declare
  v_total integer;
  v_exact integer;
  v_tolerance integer;
  v_mismatch integer;
  v_duplicate_pairs integer;
  v_sample record;
begin
  select
    count(*),
    count(*) filter (where reconciliation_status = 'exact_match'),
    count(*) filter (where reconciliation_status = 'within_tolerance'),
    count(*) filter (where reconciliation_status = 'mismatch')
  into v_total, v_exact, v_tolerance, v_mismatch
  from public.p1_shared_steel_weight_reconciliation_candidates(0.50, null, 1000, 0);

  if v_total <> 5 or v_exact <> 5 or v_tolerance <> 0 or v_mismatch <> 0 then
    raise exception
      'SK4.5b candidate baseline regression: total %, exact %, tolerance %, mismatch %',
      v_total, v_exact, v_tolerance, v_mismatch;
  end if;

  select count(*) into v_duplicate_pairs
  from (
    select
      least(left_reference_id, right_reference_id) as a,
      greatest(left_reference_id, right_reference_id) as b,
      count(*) as n
    from public.p1_shared_steel_weight_reconciliation_candidates(0.50, null, 1000, 0)
    group by 1, 2
    having count(*) > 1
  ) d;

  if v_duplicate_pairs <> 0 then
    raise exception 'SK4.5b duplicate candidate pair regression: % duplicate pairs', v_duplicate_pairs;
  end if;

  select * into v_sample
  from public.p1_shared_steel_weight_reconciliation_candidates(0.50, 'exact_match', 1000, 0)
  where geometry_key = 'round|od=168.3|t=7.11'
    and left_weight_kg_m = 28.26
    and right_weight_kg_m = 28.26
  limit 1;

  if v_sample.left_reference_id is null
     or v_sample.reconciliation_status <> 'exact_match'
     or v_sample.delta_pct <> 0
     or not v_sample.eligible_for_cross_verification then
    raise exception 'SK4.5b expected 168.3x7.11 exact candidate was not found';
  end if;

  if has_function_privilege('anon',
       'public.p1_shared_steel_weight_reconciliation_candidates(numeric,text,integer,integer)',
       'EXECUTE') then
    raise exception 'SK4.5b anon must not execute reconciliation candidate generator';
  end if;

  if not has_function_privilege('authenticated',
       'public.p1_shared_steel_weight_reconciliation_candidates(numeric,text,integer,integer)',
       'EXECUTE') then
    raise exception 'SK4.5b authenticated must execute reconciliation candidate generator';
  end if;
end
$$;
