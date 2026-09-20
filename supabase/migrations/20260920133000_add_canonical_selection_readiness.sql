-- P1.15 / SK4.5g — canonical-selection readiness.
--
-- Read-only policy layer after controlled verified-weight promotion.
--
-- Purpose:
--   * evaluate whether an existing weight_method='verified' reference is ready
--     for an explicit future canonical review;
--   * preserve canonical scope as (geometry_id, material_grade_id), including
--     a distinct grade-neutral scope where material_grade_id is NULL;
--   * surface conflicts/staleness before any canonical write path exists;
--   * never mutate is_canonical and never select a canonical automatically.
--
-- SK4.5g intentionally introduces no canonical decision ledger and no canonical
-- promotion writer. Those remain later microblocks.

create or replace function public.steel_weight_canonical_readiness_class(
  p_is_canonical boolean,
  p_verification_complete boolean,
  p_verification_basis_current boolean,
  p_grade_scope_consistent boolean,
  p_scope_canonical_count integer,
  p_scope_distinct_verified_weight_count integer,
  p_scope_canonical_is_verified boolean,
  p_verified_weight_kg_m numeric,
  p_scope_canonical_weight_kg_m numeric
)
returns table (
  readiness_status text,
  canonical_review_ready boolean,
  canonical_action_hint text,
  canonical_auto_promotion_allowed boolean
)
language plpgsql
immutable
security invoker
set search_path=public,pg_temp
as $$
begin
  if p_scope_canonical_count is null or p_scope_canonical_count < 0 then
    raise exception using errcode='22023',
      message='canonical readiness scope canonical count must be non-negative';
  end if;

  if p_scope_distinct_verified_weight_count is null
     or p_scope_distinct_verified_weight_count < 0 then
    raise exception using errcode='22023',
      message='canonical readiness distinct verified-weight count must be non-negative';
  end if;

  if p_verified_weight_kg_m is null or p_verified_weight_kg_m <= 0 then
    raise exception using errcode='22023',
      message='canonical readiness requires a positive verified kg/m';
  end if;

  readiness_status :=
    case
      when coalesce(p_is_canonical,false)
        then 'already_canonical'
      when not coalesce(p_verification_complete,false)
        then 'invalid_verified_reference'
      when not coalesce(p_verification_basis_current,false)
        then 'stale_evidence'
      when not coalesce(p_grade_scope_consistent,false)
        then 'grade_scope_conflict'
      when p_scope_canonical_count > 1
        then 'canonical_scope_conflict'
      when p_scope_distinct_verified_weight_count > 1
        then 'multiple_verified_values'
      when p_scope_canonical_count = 1
        and coalesce(p_scope_canonical_is_verified,false)
        then 'canonical_already_verified'
      else 'ready_for_canonical_review'
    end;

  canonical_review_ready := readiness_status='ready_for_canonical_review';

  canonical_action_hint :=
    case
      when not canonical_review_ready then 'none'
      when p_scope_canonical_count=0 then 'create_scope_canonical'
      when p_scope_canonical_weight_kg_m=p_verified_weight_kg_m
        then 'confirm_existing_value'
      else 'replace_existing_canonical'
    end;

  -- SK4.5g is strictly advisory/read-only.
  canonical_auto_promotion_allowed := false;

  return next;
end
$$;

create or replace function public.p1_shared_steel_weight_canonical_readiness(
  p_readiness_status text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns table (
  verified_reference_id uuid,
  geometry_id uuid,
  geometry_key text,
  material_grade_id uuid,
  material_grade text,
  weight_kg_m numeric,
  verification_decision_id uuid,
  verified_by uuid,
  verified_at timestamptz,
  verification_basis_readiness_status text,
  verification_basis_current boolean,
  grade_scope text,
  grade_scope_consistent boolean,
  scope_canonical_count integer,
  current_canonical_reference_id uuid,
  current_canonical_weight_kg_m numeric,
  current_canonical_weight_method text,
  scope_verified_reference_count integer,
  scope_distinct_verified_weight_count integer,
  readiness_status text,
  canonical_review_ready boolean,
  canonical_action_hint text,
  canonical_auto_promotion_allowed boolean
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
begin
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using errcode='22023',
      message='canonical readiness limit must be between 1 and 1000';
  end if;

  if p_offset is null or p_offset < 0 then
    raise exception using errcode='22023',
      message='canonical readiness offset must be non-negative';
  end if;

  if p_readiness_status is not null and p_readiness_status not in (
    'ready_for_canonical_review',
    'already_canonical',
    'invalid_verified_reference',
    'stale_evidence',
    'grade_scope_conflict',
    'canonical_scope_conflict',
    'multiple_verified_values',
    'canonical_already_verified'
  ) then
    raise exception using errcode='22023',
      message='unsupported canonical readiness status filter';
  end if;

  return query
  with verified as (
    select
      w.id as verified_reference_id,
      w.geometry_id,
      g.geometry_key,
      w.material_grade_id,
      mg.designation as material_grade,
      w.weight_kg_m,
      w.is_canonical,
      w.verification_decision_id,
      w.verified_by,
      w.verified_at
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    left join public.steel_material_grades mg on mg.id=w.material_grade_id
    where w.weight_method='verified'
  ),
  decision_context as (
    select
      v.verified_reference_id,
      d.id as decision_id,
      d.decision,
      d.tolerance_pct,
      d.observed_reconciliation_status,
      d.observed_delta_pct,
      lw.id as left_reference_id,
      rw.id as right_reference_id,
      lw.weight_kg_m as left_weight_kg_m,
      rw.weight_kg_m as right_weight_kg_m,
      lw.material_grade_id as left_material_grade_id,
      rw.material_grade_id as right_material_grade_id,
      (
        lw.weight_method='published'
        and rw.weight_method='published'
        and lw.geometry_id=d.geometry_id
        and rw.geometry_id=d.geometry_id
        and lw.geometry_id=rw.geometry_id
        and lw.knowledge_source_id is not null
        and rw.knowledge_source_id is not null
        and lw.knowledge_source_id<>rw.knowledge_source_id
        and lower(trim(coalesce(
          nullif(ls.metadata->>'independence_group',''),
          nullif(ls.provider,''),
          ls.source_key
        ))) is not null
        and lower(trim(coalesce(
          nullif(rs.metadata->>'independence_group',''),
          nullif(rs.provider,''),
          rs.source_key
        ))) is not null
        and lower(trim(coalesce(
          nullif(ls.metadata->>'independence_group',''),
          nullif(ls.provider,''),
          ls.source_key
        ))) <> lower(trim(coalesce(
          nullif(rs.metadata->>'independence_group',''),
          nullif(rs.provider,''),
          rs.source_key
        )))
      ) as candidate_is_current,
      rc.reconciliation_status as current_reconciliation_status,
      rc.delta_pct as current_delta_pct
    from verified v
    join public.steel_weight_reconciliation_decisions d
      on d.id=v.verification_decision_id
    join public.steel_weight_references lw on lw.id=d.left_reference_id
    join public.steel_weight_references rw on rw.id=d.right_reference_id
    left join public.knowledge_sources ls on ls.id=lw.knowledge_source_id
    left join public.knowledge_sources rs on rs.id=rw.knowledge_source_id
    left join lateral public.steel_weight_reconciliation_class(
      lw.weight_kg_m,rw.weight_kg_m,d.tolerance_pct
    ) rc on true
  ),
  basis as (
    select
      dc.*,
      (
        dc.candidate_is_current
        and dc.current_reconciliation_status=dc.observed_reconciliation_status
        and abs(dc.current_delta_pct-dc.observed_delta_pct)<=0.000001
      ) as decision_snapshot_is_current
    from decision_context dc
  ),
  promotion_basis as (
    select
      b.verified_reference_id,
      r.grade_scope,
      r.readiness_status as verification_basis_readiness_status,
      r.verified_weight_ready,
      b.left_material_grade_id,
      b.right_material_grade_id
    from basis b
    cross join lateral public.steel_weight_promotion_readiness_class(
      b.decision,
      b.candidate_is_current,
      b.decision_snapshot_is_current,
      b.current_reconciliation_status,
      b.left_material_grade_id,
      b.right_material_grade_id
    ) r
  ),
  evaluated as (
    select
      v.*,
      pb.verification_basis_readiness_status,
      (
        pb.verification_basis_readiness_status in ('ready_same_grade','ready_weight_only')
        and coalesce(pb.verified_weight_ready,false)
      ) as verification_basis_current,
      pb.grade_scope,
      case
        when pb.grade_scope='same_grade' then
          v.material_grade_id is not null
          and v.material_grade_id=pb.left_material_grade_id
          and v.material_grade_id=pb.right_material_grade_id
        when pb.grade_scope in ('grade_neutral','grade_neutral_corroboration') then
          v.material_grade_id is null
        else false
      end as grade_scope_consistent,
      (
        v.verification_decision_id is not null
        and v.verified_by is not null
        and v.verified_at is not null
        and pb.verification_basis_readiness_status is not null
      ) as verification_complete
    from verified v
    left join promotion_basis pb
      on pb.verified_reference_id=v.verified_reference_id
  ),
  scoped as (
    select
      e.*,
      s.scope_canonical_count,
      s.current_canonical_reference_id,
      s.current_canonical_weight_kg_m,
      s.current_canonical_weight_method,
      s.scope_canonical_is_verified,
      s.scope_verified_reference_count,
      s.scope_distinct_verified_weight_count
    from evaluated e
    cross join lateral (
      select
        count(*) filter (where x.is_canonical)::integer as scope_canonical_count,
        min(x.id) filter (where x.is_canonical) as current_canonical_reference_id,
        min(x.weight_kg_m) filter (where x.is_canonical) as current_canonical_weight_kg_m,
        min(x.weight_method) filter (where x.is_canonical) as current_canonical_weight_method,
        coalesce(bool_or(x.weight_method='verified') filter (where x.is_canonical),false)
          as scope_canonical_is_verified,
        count(*) filter (where x.weight_method='verified')::integer
          as scope_verified_reference_count,
        count(distinct x.weight_kg_m) filter (where x.weight_method='verified')::integer
          as scope_distinct_verified_weight_count
      from public.steel_weight_references x
      where x.geometry_id=e.geometry_id
        and x.material_grade_id is not distinct from e.material_grade_id
    ) s
  ),
  classified as (
    select
      s.*,
      c.readiness_status,
      c.canonical_review_ready,
      c.canonical_action_hint,
      c.canonical_auto_promotion_allowed
    from scoped s
    cross join lateral public.steel_weight_canonical_readiness_class(
      s.is_canonical,
      s.verification_complete,
      s.verification_basis_current,
      s.grade_scope_consistent,
      s.scope_canonical_count,
      s.scope_distinct_verified_weight_count,
      s.scope_canonical_is_verified,
      s.weight_kg_m,
      s.current_canonical_weight_kg_m
    ) c
  )
  select
    c.verified_reference_id,
    c.geometry_id,
    c.geometry_key,
    c.material_grade_id,
    c.material_grade,
    c.weight_kg_m,
    c.verification_decision_id,
    c.verified_by,
    c.verified_at,
    c.verification_basis_readiness_status,
    c.verification_basis_current,
    c.grade_scope,
    c.grade_scope_consistent,
    c.scope_canonical_count,
    c.current_canonical_reference_id,
    c.current_canonical_weight_kg_m,
    c.current_canonical_weight_method,
    c.scope_verified_reference_count,
    c.scope_distinct_verified_weight_count,
    c.readiness_status,
    c.canonical_review_ready,
    c.canonical_action_hint,
    c.canonical_auto_promotion_allowed
  from classified c
  where p_readiness_status is null
     or c.readiness_status=p_readiness_status
  order by
    case c.readiness_status
      when 'ready_for_canonical_review' then 1
      when 'multiple_verified_values' then 2
      when 'stale_evidence' then 3
      when 'grade_scope_conflict' then 4
      when 'canonical_scope_conflict' then 5
      when 'invalid_verified_reference' then 6
      when 'canonical_already_verified' then 7
      when 'already_canonical' then 8
      else 9
    end,
    c.verified_at desc nulls last,
    c.geometry_key,
    c.material_grade nulls first
  limit p_limit offset p_offset;
end
$$;

comment on function public.steel_weight_canonical_readiness_class(
  boolean,boolean,boolean,boolean,integer,integer,boolean,numeric,numeric
) is
  'Pure SK4.5g classifier for explicit canonical review readiness. It never authorizes automatic canonical promotion.';

comment on function public.p1_shared_steel_weight_canonical_readiness(
  text,integer,integer
) is
  'SK4.5g read-only queue of verified weights evaluated for future explicit canonical review within exact geometry+grade scope. No is_canonical writes occur.';

revoke all on function public.steel_weight_canonical_readiness_class(
  boolean,boolean,boolean,boolean,integer,integer,boolean,numeric,numeric
) from public,anon;

revoke all on function public.p1_shared_steel_weight_canonical_readiness(
  text,integer,integer
) from public,anon;

grant execute on function public.steel_weight_canonical_readiness_class(
  boolean,boolean,boolean,boolean,integer,integer,boolean,numeric,numeric
) to authenticated,service_role;

grant execute on function public.p1_shared_steel_weight_canonical_readiness(
  text,integer,integer
) to authenticated,service_role;

-- Pure classifier acceptance.
do $$
declare
  v record;
begin
  select * into v
  from public.steel_weight_canonical_readiness_class(
    false,true,true,true,0,1,false,28.26,null
  );
  if v.readiness_status<>'ready_for_canonical_review'
     or not v.canonical_review_ready
     or v.canonical_action_hint<>'create_scope_canonical'
     or v.canonical_auto_promotion_allowed then
    raise exception 'SK4.5g create-scope readiness regression';
  end if;

  select * into v
  from public.steel_weight_canonical_readiness_class(
    false,true,true,true,1,1,false,28.26,28.26
  );
  if v.readiness_status<>'ready_for_canonical_review'
     or v.canonical_action_hint<>'confirm_existing_value' then
    raise exception 'SK4.5g confirm-existing-value readiness regression';
  end if;

  select * into v
  from public.steel_weight_canonical_readiness_class(
    false,true,true,true,1,1,false,28.26,28.30
  );
  if v.readiness_status<>'ready_for_canonical_review'
     or v.canonical_action_hint<>'replace_existing_canonical' then
    raise exception 'SK4.5g replace-existing readiness regression';
  end if;

  select * into v
  from public.steel_weight_canonical_readiness_class(
    false,true,true,true,1,2,false,28.26,28.26
  );
  if v.readiness_status<>'multiple_verified_values'
     or v.canonical_review_ready then
    raise exception 'SK4.5g multiple-verified-values regression';
  end if;

  select * into v
  from public.steel_weight_canonical_readiness_class(
    false,true,false,true,1,1,false,28.26,28.26
  );
  if v.readiness_status<>'stale_evidence'
     or v.canonical_review_ready then
    raise exception 'SK4.5g stale-evidence regression';
  end if;

  select * into v
  from public.steel_weight_canonical_readiness_class(
    false,true,true,false,1,1,false,28.26,28.26
  );
  if v.readiness_status<>'grade_scope_conflict'
     or v.canonical_review_ready then
    raise exception 'SK4.5g grade-scope regression';
  end if;

  select * into v
  from public.steel_weight_canonical_readiness_class(
    false,true,true,true,2,1,false,28.26,28.26
  );
  if v.readiness_status<>'canonical_scope_conflict'
     or v.canonical_review_ready then
    raise exception 'SK4.5g canonical-scope regression';
  end if;

  select * into v
  from public.steel_weight_canonical_readiness_class(
    false,true,true,true,1,1,true,28.26,28.26
  );
  if v.readiness_status<>'canonical_already_verified'
     or v.canonical_review_ready then
    raise exception 'SK4.5g canonical-already-verified regression';
  end if;

  select * into v
  from public.steel_weight_canonical_readiness_class(
    true,true,true,true,1,1,true,28.26,28.26
  );
  if v.readiness_status<>'already_canonical'
     or v.canonical_review_ready then
    raise exception 'SK4.5g already-canonical regression';
  end if;
end
$$;

-- End-to-end read-only acceptance.
-- Create one temporary verified reference via the already-tested SK4.5f write
-- path, evaluate it with SK4.5g, prove canonical state is unchanged, then clean
-- up every temporary artifact.
do $$
declare
  v_candidate record;
  v_decision public.steel_weight_reconciliation_decisions;
  v_verified public.steel_weight_references;
  v_readiness record;
  v_actor uuid := gen_random_uuid();
  v_before_canonical jsonb;
  v_after_canonical jsonb;
  v_before_published jsonb;
  v_after_published jsonb;
  v_before_verified_count integer;
  v_after_verified_count integer;
begin
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
  order by c.geometry_key,c.left_reference_id,c.right_reference_id
  limit 1;

  if v_candidate.left_reference_id is null then
    raise exception 'SK4.5g requires one unreviewed exact candidate for migration acceptance';
  end if;

  insert into auth.users (
    instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_actor,
    'authenticated',
    'authenticated',
    'sk45g-ci-'||v_actor::text||'@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  select jsonb_agg(
    jsonb_build_object(
      'id',w.id,
      'weight_kg_m',w.weight_kg_m,
      'weight_method',w.weight_method,
      'is_canonical',w.is_canonical,
      'material_grade_id',w.material_grade_id
    ) order by w.id
  )
  into v_before_canonical
  from public.steel_weight_references w
  where w.is_canonical;

  select jsonb_agg(to_jsonb(w) order by w.id)
  into v_before_published
  from public.steel_weight_references w
  where w.id in (v_candidate.left_reference_id,v_candidate.right_reference_id);

  select count(*) into v_before_verified_count
  from public.steel_weight_references
  where weight_method='verified';

  select * into v_decision
  from public.p1_record_steel_weight_reconciliation_decision(
    v_candidate.left_reference_id,
    v_candidate.right_reference_id,
    0.50,
    'accepted',
    'SK4.5g canonical-readiness migration assertion',
    v_actor
  );

  select * into v_verified
  from public.p1_promote_steel_weight_reconciliation_decision(
    v_decision.id,
    null,
    'SK4.5g temporary verified reference',
    v_actor
  );

  if v_verified.is_canonical then
    raise exception 'SK4.5g fixture unexpectedly became canonical';
  end if;

  select * into v_readiness
  from public.p1_shared_steel_weight_canonical_readiness(
    'ready_for_canonical_review',1000,0
  ) r
  where r.verified_reference_id=v_verified.id;

  if not found then
    raise exception 'SK4.5g temporary verified reference was not surfaced as canonical-review ready';
  end if;

  if not v_readiness.canonical_review_ready
     or v_readiness.canonical_auto_promotion_allowed
     or v_readiness.verification_basis_readiness_status
        not in ('ready_same_grade','ready_weight_only')
     or not v_readiness.verification_basis_current
     or not v_readiness.grade_scope_consistent
     or v_readiness.scope_distinct_verified_weight_count<>1 then
    raise exception 'SK4.5g end-to-end readiness contract regression';
  end if;

  if v_readiness.grade_scope='grade_neutral_corroboration' then
    if v_readiness.material_grade_id is not null
       or v_readiness.scope_canonical_count<>0
       or v_readiness.canonical_action_hint<>'create_scope_canonical' then
      raise exception 'SK4.5g grade-neutral canonical scope regression';
    end if;
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',w.id,
      'weight_kg_m',w.weight_kg_m,
      'weight_method',w.weight_method,
      'is_canonical',w.is_canonical,
      'material_grade_id',w.material_grade_id
    ) order by w.id
  )
  into v_after_canonical
  from public.steel_weight_references w
  where w.is_canonical;

  if v_after_canonical is distinct from v_before_canonical then
    raise exception 'SK4.5g read path mutated canonical references';
  end if;

  select jsonb_agg(to_jsonb(w) order by w.id)
  into v_after_published
  from public.steel_weight_references w
  where w.id in (v_candidate.left_reference_id,v_candidate.right_reference_id);

  if v_after_published is distinct from v_before_published then
    raise exception 'SK4.5g read path mutated published evidence';
  end if;

  if has_function_privilege(
       'anon',
       'public.p1_shared_steel_weight_canonical_readiness(text,integer,integer)',
       'EXECUTE'
     ) then
    raise exception 'SK4.5g anon must not execute canonical readiness';
  end if;

  if not has_function_privilege(
       'authenticated',
       'public.p1_shared_steel_weight_canonical_readiness(text,integer,integer)',
       'EXECUTE'
     ) then
    raise exception 'SK4.5g authenticated canonical-readiness execute missing';
  end if;

  delete from public.steel_weight_references
  where id=v_verified.id;

  delete from public.steel_weight_reconciliation_decisions
  where id=v_decision.id;

  delete from auth.users
  where id=v_actor;

  select count(*) into v_after_verified_count
  from public.steel_weight_references
  where weight_method='verified';

  if v_after_verified_count<>v_before_verified_count then
    raise exception 'SK4.5g migration assertion leaked a verified reference';
  end if;
end
$$;
