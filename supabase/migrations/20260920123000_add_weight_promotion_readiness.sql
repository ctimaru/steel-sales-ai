-- P1.15 / SK4.5e — controlled verified-weight promotion readiness.
--
-- Read-only policy layer. It evaluates whether an existing reconciliation
-- decision is ready for a future controlled promotion to verified weight
-- evidence. It never mutates weight references and never selects canonical data.

create or replace function public.steel_weight_promotion_readiness_class(
  p_decision text,
  p_candidate_is_current boolean,
  p_decision_snapshot_is_current boolean,
  p_current_reconciliation_status text,
  p_left_material_grade_id uuid,
  p_right_material_grade_id uuid
)
returns table (
  readiness_status text,
  grade_scope text,
  verified_weight_ready boolean,
  grade_applicability_ready boolean,
  canonical_auto_promotion_allowed boolean
)
language plpgsql
immutable
security invoker
set search_path=public,pg_temp
as $$
begin
  if p_decision is null or p_decision not in ('accepted','rejected','needs_review') then
    raise exception using errcode='22023',
      message='promotion readiness decision must be accepted, rejected, or needs_review';
  end if;

  grade_scope :=
    case
      when p_left_material_grade_id is null and p_right_material_grade_id is null
        then 'grade_neutral'
      when p_left_material_grade_id is null or p_right_material_grade_id is null
        then 'grade_neutral_corroboration'
      when p_left_material_grade_id = p_right_material_grade_id
        then 'same_grade'
      else 'different_grades'
    end;

  readiness_status :=
    case
      when p_decision <> 'accepted'
        then 'decision_not_accepted'
      when not coalesce(p_candidate_is_current,false)
        then 'candidate_not_current'
      when not coalesce(p_decision_snapshot_is_current,false)
        then 'stale_decision'
      when p_current_reconciliation_status = 'mismatch'
        then 'reconciliation_mismatch'
      when p_current_reconciliation_status not in ('exact_match','within_tolerance')
        then 'unsupported_reconciliation_status'
      when grade_scope = 'different_grades'
        then 'grade_conflict'
      when grade_scope = 'same_grade'
        then 'ready_same_grade'
      else 'ready_weight_only'
    end;

  verified_weight_ready := readiness_status in ('ready_same_grade','ready_weight_only');
  grade_applicability_ready := readiness_status = 'ready_same_grade';

  -- Canonical selection remains a separate explicit policy/action.
  canonical_auto_promotion_allowed := false;

  return next;
end
$$;

create or replace function public.p1_shared_steel_weight_promotion_readiness(
  p_readiness_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  decision_id uuid,
  left_reference_id uuid,
  right_reference_id uuid,
  geometry_id uuid,
  geometry_key text,
  decision text,
  decision_tolerance_pct numeric,
  observed_reconciliation_status text,
  observed_delta_pct numeric,
  current_reconciliation_status text,
  current_delta_pct numeric,
  candidate_is_current boolean,
  decision_snapshot_is_current boolean,
  left_material_grade_id uuid,
  right_material_grade_id uuid,
  grade_scope text,
  readiness_status text,
  verified_weight_ready boolean,
  grade_applicability_ready boolean,
  canonical_auto_promotion_allowed boolean,
  decided_by uuid,
  decided_at timestamptz
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using errcode='22023',
      message='promotion readiness limit must be between 1 and 1000';
  end if;
  if p_offset is null or p_offset < 0 then
    raise exception using errcode='22023',
      message='promotion readiness offset must be non-negative';
  end if;
  if p_readiness_status is not null and p_readiness_status not in (
    'decision_not_accepted','candidate_not_current','stale_decision',
    'reconciliation_mismatch','unsupported_reconciliation_status',
    'grade_conflict','ready_same_grade','ready_weight_only'
  ) then
    raise exception using errcode='22023',
      message='unsupported promotion readiness status filter';
  end if;

  return query
  with evaluated as (
    select
      d.id as decision_id,
      d.left_reference_id,
      d.right_reference_id,
      d.geometry_id,
      g.geometry_key,
      d.decision,
      d.tolerance_pct as decision_tolerance_pct,
      d.observed_reconciliation_status,
      d.observed_delta_pct,
      c.reconciliation_status as current_reconciliation_status,
      c.delta_pct as current_delta_pct,
      (c.left_reference_id is not null) as candidate_is_current,
      (
        c.left_reference_id is not null
        and c.reconciliation_status = d.observed_reconciliation_status
        and abs(c.delta_pct - d.observed_delta_pct) <= 0.000001
      ) as decision_snapshot_is_current,
      lw.material_grade_id as left_material_grade_id,
      rw.material_grade_id as right_material_grade_id,
      d.decided_by,
      d.decided_at
    from public.steel_weight_reconciliation_decisions d
    join public.steel_weight_references lw on lw.id=d.left_reference_id
    join public.steel_weight_references rw on rw.id=d.right_reference_id
    join public.steel_geometries g on g.id=d.geometry_id
    left join lateral (
      select c0.*
      from public.p1_shared_steel_weight_reconciliation_candidates(
        d.tolerance_pct,null,1000,0
      ) c0
      where c0.left_reference_id=d.left_reference_id
        and c0.right_reference_id=d.right_reference_id
      limit 1
    ) c on true
  ),
  classified as (
    select e.*,r.grade_scope,r.readiness_status,r.verified_weight_ready,
      r.grade_applicability_ready,r.canonical_auto_promotion_allowed
    from evaluated e
    cross join lateral public.steel_weight_promotion_readiness_class(
      e.decision,e.candidate_is_current,e.decision_snapshot_is_current,
      e.current_reconciliation_status,e.left_material_grade_id,e.right_material_grade_id
    ) r
  )
  select
    x.decision_id,x.left_reference_id,x.right_reference_id,x.geometry_id,x.geometry_key,
    x.decision,x.decision_tolerance_pct,x.observed_reconciliation_status,x.observed_delta_pct,
    x.current_reconciliation_status,x.current_delta_pct,x.candidate_is_current,
    x.decision_snapshot_is_current,x.left_material_grade_id,x.right_material_grade_id,
    x.grade_scope,x.readiness_status,x.verified_weight_ready,x.grade_applicability_ready,
    x.canonical_auto_promotion_allowed,x.decided_by,x.decided_at
  from classified x
  where p_readiness_status is null or x.readiness_status=p_readiness_status
  order by
    case x.readiness_status
      when 'ready_same_grade' then 1
      when 'ready_weight_only' then 2
      when 'stale_decision' then 3
      when 'candidate_not_current' then 4
      when 'reconciliation_mismatch' then 5
      when 'grade_conflict' then 6
      else 7
    end,
    x.decided_at desc,
    x.geometry_key
  limit p_limit offset p_offset;
end
$$;

comment on function public.steel_weight_promotion_readiness_class(text,boolean,boolean,text,uuid,uuid) is
  'Pure SK4.5 readiness classifier. Grade-neutral evidence may support weight verification but never grade applicability; canonical auto-promotion is always false.';
comment on function public.p1_shared_steel_weight_promotion_readiness(text,integer,integer) is
  'Read-only readiness view for reconciliation decisions. Revalidates live candidate status and decision snapshot before any future verified-weight promotion.';

revoke all on function public.steel_weight_promotion_readiness_class(text,boolean,boolean,text,uuid,uuid)
  from public,anon;
revoke all on function public.p1_shared_steel_weight_promotion_readiness(text,integer,integer)
  from public,anon;
grant execute on function public.steel_weight_promotion_readiness_class(text,boolean,boolean,text,uuid,uuid)
  to authenticated,service_role;
grant execute on function public.p1_shared_steel_weight_promotion_readiness(text,integer,integer)
  to authenticated,service_role;

do $$
declare
  v record;
begin
  select * into v from public.steel_weight_promotion_readiness_class(
    'accepted',true,true,'exact_match',
    '11111111-1111-4111-8111-111111111111'::uuid,
    '11111111-1111-4111-8111-111111111111'::uuid
  );
  if v.readiness_status <> 'ready_same_grade'
     or not v.verified_weight_ready
     or not v.grade_applicability_ready
     or v.canonical_auto_promotion_allowed then
    raise exception 'SK4.5e same-grade readiness regression';
  end if;

  select * into v from public.steel_weight_promotion_readiness_class(
    'accepted',true,true,'exact_match',
    '11111111-1111-4111-8111-111111111111'::uuid,null
  );
  if v.readiness_status <> 'ready_weight_only'
     or not v.verified_weight_ready
     or v.grade_applicability_ready
     or v.grade_scope <> 'grade_neutral_corroboration' then
    raise exception 'SK4.5e grade-neutral readiness regression';
  end if;

  select * into v from public.steel_weight_promotion_readiness_class(
    'accepted',true,false,'exact_match',null,null
  );
  if v.readiness_status <> 'stale_decision' or v.verified_weight_ready then
    raise exception 'SK4.5e stale decision regression';
  end if;

  select * into v from public.steel_weight_promotion_readiness_class(
    'accepted',true,true,'exact_match',
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid
  );
  if v.readiness_status <> 'grade_conflict' or v.verified_weight_ready then
    raise exception 'SK4.5e grade-conflict regression';
  end if;

  select * into v from public.steel_weight_promotion_readiness_class(
    'needs_review',true,true,'exact_match',null,null
  );
  if v.readiness_status <> 'decision_not_accepted' or v.verified_weight_ready then
    raise exception 'SK4.5e non-accepted decision regression';
  end if;

  if has_function_privilege('anon',
    'public.p1_shared_steel_weight_promotion_readiness(text,integer,integer)','EXECUTE') then
    raise exception 'SK4.5e anon must not execute promotion readiness';
  end if;
  if not has_function_privilege('authenticated',
    'public.p1_shared_steel_weight_promotion_readiness(text,integer,integer)','EXECUTE') then
    raise exception 'SK4.5e authenticated execute missing';
  end if;
end
$$;
