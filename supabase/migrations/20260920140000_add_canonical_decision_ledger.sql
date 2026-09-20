-- P1.15 / SK4.5h — explicit canonical decision ledger.
--
-- Append-only audit layer between canonical readiness (SK4.5g) and any future
-- canonical promotion writer.
--
-- Invariants:
--   * decisions target an existing weight_method='verified' reference;
--   * accepted is allowed only when live SK4.5g readiness is
--     ready_for_canonical_review at decision time;
--   * every decision snapshots the current canonical scope and readiness basis;
--   * decision history is append-only from the application perspective and
--     linked through supersedes_decision_id;
--   * recording a decision never mutates steel_weight_references.is_canonical.

create table public.steel_weight_canonical_decisions (
  id uuid primary key default gen_random_uuid(),
  verified_reference_id uuid not null
    references public.steel_weight_references(id) on delete restrict,
  geometry_id uuid not null
    references public.steel_geometries(id) on delete restrict,
  material_grade_id uuid
    references public.steel_material_grades(id) on delete restrict,
  verified_weight_kg_m numeric not null
    check (verified_weight_kg_m > 0),
  verification_decision_id uuid not null
    references public.steel_weight_reconciliation_decisions(id) on delete restrict,

  decision text not null
    check (decision in ('accepted','rejected','needs_review')),
  rationale text,

  observed_readiness_status text not null
    check (observed_readiness_status in (
      'ready_for_canonical_review',
      'already_canonical',
      'invalid_verified_reference',
      'stale_evidence',
      'grade_scope_conflict',
      'canonical_scope_conflict',
      'multiple_verified_values',
      'canonical_already_verified'
    )),
  observed_canonical_action_hint text not null
    check (observed_canonical_action_hint in (
      'none',
      'create_scope_canonical',
      'confirm_existing_value',
      'replace_existing_canonical'
    )),
  observed_verification_basis_readiness_status text,
  observed_verification_basis_current boolean not null,
  observed_grade_scope text,
  observed_grade_scope_consistent boolean not null,

  observed_scope_canonical_count integer not null
    check (observed_scope_canonical_count >= 0),
  observed_current_canonical_reference_id uuid
    references public.steel_weight_references(id) on delete restrict,
  observed_current_canonical_weight_kg_m numeric,
  observed_current_canonical_weight_method text,
  observed_scope_verified_reference_count integer not null
    check (observed_scope_verified_reference_count >= 1),
  observed_scope_distinct_verified_weight_count integer not null
    check (observed_scope_distinct_verified_weight_count >= 1),

  supersedes_decision_id uuid
    references public.steel_weight_canonical_decisions(id) on delete restrict,

  decided_by uuid not null
    references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  check (
    (observed_scope_canonical_count = 0
      and observed_current_canonical_reference_id is null
      and observed_current_canonical_weight_kg_m is null
      and observed_current_canonical_weight_method is null)
    or
    (observed_scope_canonical_count > 0
      and observed_current_canonical_reference_id is not null
      and observed_current_canonical_weight_kg_m is not null
      and observed_current_canonical_weight_method is not null)
  ),
  check (
    decision <> 'accepted'
    or observed_readiness_status = 'ready_for_canonical_review'
  )
);

create index steel_weight_canonical_decisions_reference_idx
  on public.steel_weight_canonical_decisions (
    verified_reference_id,
    decided_at desc
  );

create index steel_weight_canonical_decisions_scope_idx
  on public.steel_weight_canonical_decisions (
    geometry_id,
    material_grade_id,
    decision,
    decided_at desc
  );

create index steel_weight_canonical_decisions_decided_by_idx
  on public.steel_weight_canonical_decisions (decided_by);

create index steel_weight_canonical_decisions_material_grade_idx
  on public.steel_weight_canonical_decisions (material_grade_id)
  where material_grade_id is not null;

create index steel_weight_canonical_decisions_verification_decision_idx
  on public.steel_weight_canonical_decisions (verification_decision_id);

create index steel_weight_canonical_decisions_current_canonical_idx
  on public.steel_weight_canonical_decisions (observed_current_canonical_reference_id)
  where observed_current_canonical_reference_id is not null;

create unique index steel_weight_canonical_decisions_supersedes_uq
  on public.steel_weight_canonical_decisions (supersedes_decision_id)
  where supersedes_decision_id is not null;

alter table public.steel_weight_canonical_decisions enable row level security;

revoke all on table public.steel_weight_canonical_decisions
  from public,anon,authenticated;

grant select on table public.steel_weight_canonical_decisions
  to authenticated;

grant select,insert on table public.steel_weight_canonical_decisions
  to service_role;

create policy steel_weight_canonical_decisions_authenticated_read
  on public.steel_weight_canonical_decisions
  for select
  to authenticated
  using (true);

create or replace function public.steel_weight_canonical_readiness_context(
  p_verified_reference_id uuid
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
  if p_verified_reference_id is null then
    raise exception using errcode='22023',
      message='canonical decision requires a verified reference id';
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
    where w.id=p_verified_reference_id
      and w.weight_method='verified'
  ),
  decision_context as (
    select
      v.verified_reference_id,
      d.id as decision_id,
      d.decision,
      d.tolerance_pct,
      d.observed_reconciliation_status,
      d.observed_delta_pct,
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
        (min(x.id::text) filter (where x.is_canonical))::uuid
          as current_canonical_reference_id,
        min(x.weight_kg_m) filter (where x.is_canonical)
          as current_canonical_weight_kg_m,
        min(x.weight_method) filter (where x.is_canonical)
          as current_canonical_weight_method,
        coalesce(
          bool_or(x.weight_method='verified') filter (where x.is_canonical),
          false
        ) as scope_canonical_is_verified,
        count(*) filter (where x.weight_method='verified')::integer
          as scope_verified_reference_count,
        count(distinct x.weight_kg_m)
          filter (where x.weight_method='verified')::integer
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
  from classified c;
end
$$;

comment on function public.steel_weight_canonical_readiness_context(uuid) is
  'SK4.5h service-only live canonical-readiness context for one verified reference. No pagination and no canonical mutation.';

revoke all on function public.steel_weight_canonical_readiness_context(uuid)
  from public,anon,authenticated;

grant execute on function public.steel_weight_canonical_readiness_context(uuid)
  to service_role;

create or replace function public.p1_record_steel_weight_canonical_decision(
  p_verified_reference_id uuid,
  p_decision text,
  p_rationale text default null,
  p_decided_by uuid default null
)
returns public.steel_weight_canonical_decisions
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_actor uuid := coalesce(p_decided_by,auth.uid());
  v_ctx record;
  v_previous public.steel_weight_canonical_decisions;
  v_row public.steel_weight_canonical_decisions;
begin
  if p_verified_reference_id is null then
    raise exception using errcode='22023',
      message='canonical decision requires a verified reference id';
  end if;

  if p_decision is null
     or p_decision not in ('accepted','rejected','needs_review') then
    raise exception using errcode='22023',
      message='canonical decision must be accepted, rejected, or needs_review';
  end if;

  if v_actor is null then
    raise exception using errcode='22023',
      message='canonical decision requires an accountable actor';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_verified_reference_id::text));

  select * into v_ctx
  from public.steel_weight_canonical_readiness_context(
    p_verified_reference_id
  );

  if not found then
    raise exception using errcode='22023',
      message='target reference is not an eligible verified weight reference';
  end if;

  if p_decision='accepted'
     and (
       not coalesce(v_ctx.canonical_review_ready,false)
       or v_ctx.readiness_status<>'ready_for_canonical_review'
     ) then
    raise exception using errcode='22023',
      message=format(
        'canonical acceptance requires live ready_for_canonical_review status; current status is %s',
        coalesce(v_ctx.readiness_status,'unknown')
      );
  end if;

  if coalesce(v_ctx.canonical_auto_promotion_allowed,false) then
    raise exception using errcode='22023',
      message='canonical decision ledger cannot consume an auto-promotion state';
  end if;

  select d.* into v_previous
  from public.steel_weight_canonical_decisions d
  where d.verified_reference_id=p_verified_reference_id
  order by d.decided_at desc,d.created_at desc,d.id desc
  limit 1;

  insert into public.steel_weight_canonical_decisions (
    verified_reference_id,
    geometry_id,
    material_grade_id,
    verified_weight_kg_m,
    verification_decision_id,
    decision,
    rationale,
    observed_readiness_status,
    observed_canonical_action_hint,
    observed_verification_basis_readiness_status,
    observed_verification_basis_current,
    observed_grade_scope,
    observed_grade_scope_consistent,
    observed_scope_canonical_count,
    observed_current_canonical_reference_id,
    observed_current_canonical_weight_kg_m,
    observed_current_canonical_weight_method,
    observed_scope_verified_reference_count,
    observed_scope_distinct_verified_weight_count,
    supersedes_decision_id,
    decided_by,
    metadata
  ) values (
    v_ctx.verified_reference_id,
    v_ctx.geometry_id,
    v_ctx.material_grade_id,
    v_ctx.weight_kg_m,
    v_ctx.verification_decision_id,
    p_decision,
    nullif(btrim(p_rationale),''),
    v_ctx.readiness_status,
    v_ctx.canonical_action_hint,
    v_ctx.verification_basis_readiness_status,
    v_ctx.verification_basis_current,
    v_ctx.grade_scope,
    v_ctx.grade_scope_consistent,
    v_ctx.scope_canonical_count,
    v_ctx.current_canonical_reference_id,
    v_ctx.current_canonical_weight_kg_m,
    v_ctx.current_canonical_weight_method,
    v_ctx.scope_verified_reference_count,
    v_ctx.scope_distinct_verified_weight_count,
    v_previous.id,
    v_actor,
    jsonb_build_object(
      'microblock','SK4.5h',
      'canonical_decision_policy_version',1,
      'canonical_auto_promotion_allowed',false
    )
  )
  returning * into v_row;

  return v_row;
end
$$;

comment on table public.steel_weight_canonical_decisions is
  'SK4.5h append-only application ledger for explicit canonical decisions on verified weights. It snapshots readiness and never mutates canonical flags.';

comment on function public.p1_record_steel_weight_canonical_decision(
  uuid,text,text,uuid
) is
  'Service-only append-only canonical decision writer. accepted requires live ready_for_canonical_review; no is_canonical side effects.';

revoke all on function public.p1_record_steel_weight_canonical_decision(
  uuid,text,text,uuid
) from public,anon,authenticated;

grant execute on function public.p1_record_steel_weight_canonical_decision(
  uuid,text,text,uuid
) to service_role;

-- Migration acceptance:
-- create a temporary verified reference through SK4.5f, record a needs_review
-- decision followed by accepted, assert append-only supersession and prove that
-- canonical/published/verified reference state is unchanged by the ledger.
do $$
declare
  v_candidate record;
  v_reconciliation public.steel_weight_reconciliation_decisions;
  v_verified public.steel_weight_references;
  v_review public.steel_weight_canonical_decisions;
  v_accepted public.steel_weight_canonical_decisions;
  v_actor uuid := gen_random_uuid();
  v_before_scope jsonb;
  v_after_scope jsonb;
  v_before_published jsonb;
  v_after_published jsonb;
  v_authenticated_insert boolean;
  v_anon_select boolean;
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
    raise exception 'SK4.5h requires one unreviewed exact candidate for migration acceptance';
  end if;

  insert into auth.users (
    instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_actor,
    'authenticated',
    'authenticated',
    'sk45h-ci-'||v_actor::text||'@example.invalid',
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
    'SK4.5h reconciliation fixture',
    v_actor
  );

  select * into v_verified
  from public.p1_promote_steel_weight_reconciliation_decision(
    v_reconciliation.id,
    null,
    'SK4.5h verified fixture',
    v_actor
  );

  select jsonb_agg(
    jsonb_build_object(
      'id',w.id,
      'weight_kg_m',w.weight_kg_m,
      'weight_method',w.weight_method,
      'is_canonical',w.is_canonical,
      'material_grade_id',w.material_grade_id,
      'verification_decision_id',w.verification_decision_id
    ) order by w.id
  )
  into v_before_scope
  from public.steel_weight_references w
  where w.geometry_id=v_verified.geometry_id
    and w.material_grade_id is not distinct from v_verified.material_grade_id;

  select jsonb_agg(to_jsonb(w) order by w.id)
  into v_before_published
  from public.steel_weight_references w
  where w.id in (
    v_candidate.left_reference_id,
    v_candidate.right_reference_id
  );

  select * into v_review
  from public.p1_record_steel_weight_canonical_decision(
    v_verified.id,
    'needs_review',
    'SK4.5h append-only first decision',
    v_actor
  );

  if v_review.decision<>'needs_review'
     or v_review.observed_readiness_status<>'ready_for_canonical_review'
     or v_review.supersedes_decision_id is not null then
    raise exception 'SK4.5h initial canonical decision regression';
  end if;

  select * into v_accepted
  from public.p1_record_steel_weight_canonical_decision(
    v_verified.id,
    'accepted',
    'SK4.5h explicit canonical acceptance fixture',
    v_actor
  );

  if v_accepted.decision<>'accepted'
     or v_accepted.observed_readiness_status<>'ready_for_canonical_review'
     or v_accepted.supersedes_decision_id<>v_review.id
     or coalesce(
       (v_accepted.metadata->>'canonical_auto_promotion_allowed')::boolean,
       true
     ) then
    raise exception 'SK4.5h accepted canonical decision regression';
  end if;

  if (
    select count(*)
    from public.steel_weight_canonical_decisions d
    where d.verified_reference_id=v_verified.id
  )<>2 then
    raise exception 'SK4.5h decision history was overwritten instead of appended';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'id',w.id,
      'weight_kg_m',w.weight_kg_m,
      'weight_method',w.weight_method,
      'is_canonical',w.is_canonical,
      'material_grade_id',w.material_grade_id,
      'verification_decision_id',w.verification_decision_id
    ) order by w.id
  )
  into v_after_scope
  from public.steel_weight_references w
  where w.geometry_id=v_verified.geometry_id
    and w.material_grade_id is not distinct from v_verified.material_grade_id;

  if v_after_scope is distinct from v_before_scope then
    raise exception 'SK4.5h decision ledger mutated canonical scope';
  end if;

  if (
    select is_canonical
    from public.steel_weight_references
    where id=v_verified.id
  ) then
    raise exception 'SK4.5h accepted ledger decision must not set is_canonical';
  end if;

  select jsonb_agg(to_jsonb(w) order by w.id)
  into v_after_published
  from public.steel_weight_references w
  where w.id in (
    v_candidate.left_reference_id,
    v_candidate.right_reference_id
  );

  if v_after_published is distinct from v_before_published then
    raise exception 'SK4.5h decision ledger mutated published evidence';
  end if;

  v_authenticated_insert :=
    has_table_privilege(
      'authenticated',
      'public.steel_weight_canonical_decisions',
      'INSERT'
    );
  v_anon_select :=
    has_table_privilege(
      'anon',
      'public.steel_weight_canonical_decisions',
      'SELECT'
    );

  if v_authenticated_insert or v_anon_select then
    raise exception 'SK4.5h ledger privilege regression';
  end if;

  if not has_table_privilege(
       'authenticated',
       'public.steel_weight_canonical_decisions',
       'SELECT'
     ) then
    raise exception 'SK4.5h authenticated ledger read privilege missing';
  end if;

  if has_function_privilege(
       'anon',
       'public.p1_record_steel_weight_canonical_decision(uuid,text,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.p1_record_steel_weight_canonical_decision(uuid,text,text,uuid)',
       'EXECUTE'
     ) then
    raise exception 'SK4.5h decision writer must remain service-role only';
  end if;

  delete from public.steel_weight_canonical_decisions
  where id=v_accepted.id;

  delete from public.steel_weight_canonical_decisions
  where id=v_review.id;

  delete from public.steel_weight_references
  where id=v_verified.id;

  delete from public.steel_weight_reconciliation_decisions
  where id=v_reconciliation.id;

  delete from auth.users
  where id=v_actor;
end
$$;
