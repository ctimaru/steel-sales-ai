-- P1.15 / SK4.5f — controlled verified-weight promotion.
--
-- Invariants:
--   * only an accepted reconciliation decision that is still ready_* may create
--     a new weight_method='verified' reference;
--   * published evidence rows are never rewritten by the promotion path;
--   * a verified reference is a new row, linked immutably to one decision;
--   * grade-neutral corroboration produces a grade-neutral verified weight;
--   * within-tolerance values that differ require an explicit choice of one of
--     the two published evidence values (no averaging / synthetic kg/m);
--   * is_canonical remains false. Canonical selection is a later explicit policy.

alter table public.steel_weight_references
  add column verification_decision_id uuid
    references public.steel_weight_reconciliation_decisions(id) on delete restrict,
  add column verified_by uuid
    references auth.users(id) on delete restrict;

create unique index steel_weight_references_verification_decision_uq
  on public.steel_weight_references (verification_decision_id)
  where verification_decision_id is not null;

create or replace function public.steel_weight_promotion_context(
  p_decision_id uuid
)
returns table (
  decision_id uuid,
  decision text,
  geometry_id uuid,
  tolerance_pct numeric,
  observed_reconciliation_status text,
  observed_delta_pct numeric,
  current_reconciliation_status text,
  current_delta_pct numeric,
  candidate_is_current boolean,
  decision_snapshot_is_current boolean,
  left_reference_id uuid,
  right_reference_id uuid,
  left_weight_kg_m numeric,
  right_weight_kg_m numeric,
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
  if p_decision_id is null then
    raise exception using errcode='22023',
      message='verification promotion requires a decision id';
  end if;

  return query
  with base as (
    select
      d.id as decision_id,
      d.decision,
      d.geometry_id,
      d.tolerance_pct,
      d.observed_reconciliation_status,
      d.observed_delta_pct,
      rc.reconciliation_status as current_reconciliation_status,
      rc.delta_pct as current_delta_pct,
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
      d.left_reference_id,
      d.right_reference_id,
      lw.weight_kg_m as left_weight_kg_m,
      rw.weight_kg_m as right_weight_kg_m,
      lw.material_grade_id as left_material_grade_id,
      rw.material_grade_id as right_material_grade_id,
      d.decided_by,
      d.decided_at
    from public.steel_weight_reconciliation_decisions d
    join public.steel_weight_references lw on lw.id=d.left_reference_id
    join public.steel_weight_references rw on rw.id=d.right_reference_id
    left join public.knowledge_sources ls on ls.id=lw.knowledge_source_id
    left join public.knowledge_sources rs on rs.id=rw.knowledge_source_id
    cross join lateral public.steel_weight_reconciliation_class(
      lw.weight_kg_m,rw.weight_kg_m,d.tolerance_pct
    ) rc
    where d.id=p_decision_id
  ),
  evaluated as (
    select
      b.*,
      (
        b.candidate_is_current
        and b.current_reconciliation_status=b.observed_reconciliation_status
        and abs(b.current_delta_pct-b.observed_delta_pct)<=0.000001
      ) as decision_snapshot_is_current
    from base b
  )
  select
    e.decision_id,
    e.decision,
    e.geometry_id,
    e.tolerance_pct,
    e.observed_reconciliation_status,
    e.observed_delta_pct,
    e.current_reconciliation_status,
    e.current_delta_pct,
    e.candidate_is_current,
    e.decision_snapshot_is_current,
    e.left_reference_id,
    e.right_reference_id,
    e.left_weight_kg_m,
    e.right_weight_kg_m,
    e.left_material_grade_id,
    e.right_material_grade_id,
    r.grade_scope,
    r.readiness_status,
    r.verified_weight_ready,
    r.grade_applicability_ready,
    r.canonical_auto_promotion_allowed,
    e.decided_by,
    e.decided_at
  from evaluated e
  cross join lateral public.steel_weight_promotion_readiness_class(
    e.decision,
    e.candidate_is_current,
    e.decision_snapshot_is_current,
    e.current_reconciliation_status,
    e.left_material_grade_id,
    e.right_material_grade_id
  ) r;
end
$$;

comment on function public.steel_weight_promotion_context(uuid) is
  'SK4.5f service-only live revalidation context for one reconciliation decision. Recomputes source independence, reconciliation status and readiness without pagination.';

revoke all on function public.steel_weight_promotion_context(uuid)
  from public,anon,authenticated;
grant execute on function public.steel_weight_promotion_context(uuid)
  to service_role;

create or replace function public.steel_guard_verified_weight_promotion()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_ctx record;
begin
  if tg_op='UPDATE' and old.weight_method='verified' then
    if to_jsonb(new) is distinct from to_jsonb(old) then
      raise exception using errcode='22023',
        message='verified weight references are immutable in SK4.5f; use a later explicit supersession/canonical policy';
    end if;
    return new;
  end if;

  if tg_op='UPDATE'
     and old.weight_method<>'verified'
     and new.weight_method='verified' then
    raise exception using errcode='22023',
      message='published/calculated weight references cannot be converted to verified; create a new verified reference';
  end if;

  if new.weight_method<>'verified' then
    if new.verification_decision_id is not null or new.verified_by is not null then
      raise exception using errcode='22023',
        message='verification decision fields are reserved for verified weight references';
    end if;
    return new;
  end if;

  if new.verification_decision_id is null then
    raise exception using errcode='22023',
      message='verified weight reference requires an accepted ready reconciliation decision';
  end if;

  select * into v_ctx
  from public.steel_weight_promotion_context(new.verification_decision_id);

  if not found then
    raise exception using errcode='22023',
      message='verification decision was not found';
  end if;

  if v_ctx.decision<>'accepted'
     or not coalesce(v_ctx.verified_weight_ready,false)
     or v_ctx.readiness_status not in ('ready_same_grade','ready_weight_only') then
    raise exception using errcode='22023',
      message=format(
        'decision is not eligible for verified-weight promotion: %s',
        coalesce(v_ctx.readiness_status,'not_ready')
      );
  end if;

  if new.geometry_id<>v_ctx.geometry_id then
    raise exception using errcode='22023',
      message='verified reference geometry must match the accepted reconciliation decision';
  end if;

  if new.weight_kg_m<>v_ctx.left_weight_kg_m
     and new.weight_kg_m<>v_ctx.right_weight_kg_m then
    raise exception using errcode='22023',
      message='verified kg/m must equal one of the published evidence weights';
  end if;

  if v_ctx.readiness_status='ready_same_grade' then
    if new.material_grade_id is distinct from v_ctx.left_material_grade_id then
      raise exception using errcode='22023',
        message='same-grade verified reference must preserve the corroborated material grade';
    end if;
  elsif new.material_grade_id is not null then
    raise exception using errcode='22023',
      message='weight-only verification must remain grade-neutral';
  end if;

  if new.is_canonical then
    raise exception using errcode='22023',
      message='SK4.5f verified promotion cannot select canonical weight automatically';
  end if;

  if new.knowledge_source_id is not null or new.source_document_id is not null then
    raise exception using errcode='22023',
      message='derived verified reference must retain provenance through its decision/evidence links, not claim a single source';
  end if;

  if new.formula_version is not null then
    raise exception using errcode='22023',
      message='verified reconciliation reference cannot claim a calculation formula';
  end if;

  new.verified_by := coalesce(new.verified_by,v_ctx.decided_by);
  if new.verified_by is null then
    raise exception using errcode='22023',
      message='verified promotion requires an accountable actor';
  end if;

  new.verified_at := coalesce(new.verified_at,now());
  new.source_locator := coalesce(new.source_locator,'{}'::jsonb) || jsonb_build_object(
    'kind','controlled_weight_reconciliation',
    'decision_id',v_ctx.decision_id,
    'left_reference_id',v_ctx.left_reference_id,
    'right_reference_id',v_ctx.right_reference_id
  );
  new.metadata := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object(
    'promotion_microblock','SK4.5f',
    'promotion_policy_version',1,
    'promotion_decision_id',v_ctx.decision_id,
    'readiness_status',v_ctx.readiness_status,
    'grade_scope',v_ctx.grade_scope,
    'left_reference_id',v_ctx.left_reference_id,
    'right_reference_id',v_ctx.right_reference_id,
    'left_published_weight_kg_m',v_ctx.left_weight_kg_m,
    'right_published_weight_kg_m',v_ctx.right_weight_kg_m,
    'decision_tolerance_pct',v_ctx.tolerance_pct,
    'current_reconciliation_status',v_ctx.current_reconciliation_status,
    'canonical_selected',false
  );

  return new;
end
$$;

revoke all on function public.steel_guard_verified_weight_promotion()
  from public,anon,authenticated;

drop trigger if exists steel_guard_verified_weight_promotion
  on public.steel_weight_references;

create trigger steel_guard_verified_weight_promotion
before insert or update on public.steel_weight_references
for each row execute function public.steel_guard_verified_weight_promotion();

create or replace function public.steel_lock_promoted_weight_decision()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if exists (
    select 1
    from public.steel_weight_references w
    where w.verification_decision_id=old.id
  ) then
    if tg_op='DELETE' or to_jsonb(new) is distinct from to_jsonb(old) then
      raise exception using errcode='22023',
        message='a reconciliation decision linked to a verified reference is immutable';
    end if;
  end if;

  if tg_op='DELETE' then
    return old;
  end if;
  return new;
end
$$;

revoke all on function public.steel_lock_promoted_weight_decision()
  from public,anon,authenticated;

drop trigger if exists steel_lock_promoted_weight_decision
  on public.steel_weight_reconciliation_decisions;

create trigger steel_lock_promoted_weight_decision
before update or delete on public.steel_weight_reconciliation_decisions
for each row execute function public.steel_lock_promoted_weight_decision();

create or replace function public.p1_promote_steel_weight_reconciliation_decision(
  p_decision_id uuid,
  p_verified_weight_kg_m numeric default null,
  p_rationale text default null,
  p_promoted_by uuid default null
)
returns public.steel_weight_references
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_ctx record;
  v_existing public.steel_weight_references;
  v_row public.steel_weight_references;
  v_weight numeric;
  v_grade uuid;
  v_actor uuid;
begin
  if p_decision_id is null then
    raise exception using errcode='22023',
      message='verified-weight promotion requires a decision id';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_decision_id::text));

  select * into v_ctx
  from public.steel_weight_promotion_context(p_decision_id);

  if not found then
    raise exception using errcode='22023',
      message='reconciliation decision was not found';
  end if;

  if v_ctx.decision<>'accepted'
     or not coalesce(v_ctx.verified_weight_ready,false)
     or v_ctx.readiness_status not in ('ready_same_grade','ready_weight_only') then
    raise exception using errcode='22023',
      message=format(
        'decision is not eligible for verified-weight promotion: %s',
        coalesce(v_ctx.readiness_status,'not_ready')
      );
  end if;

  select * into v_existing
  from public.steel_weight_references
  where verification_decision_id=p_decision_id
  limit 1;

  if found then
    if p_verified_weight_kg_m is not null
       and p_verified_weight_kg_m<>v_existing.weight_kg_m then
      raise exception using errcode='22023',
        message='decision was already promoted with a different verified kg/m';
    end if;
    return v_existing;
  end if;

  if p_verified_weight_kg_m is null then
    if v_ctx.left_weight_kg_m=v_ctx.right_weight_kg_m then
      v_weight := v_ctx.left_weight_kg_m;
    else
      raise exception using errcode='22023',
        message='within-tolerance evidence has different kg/m values; explicitly choose one published evidence weight';
    end if;
  else
    v_weight := p_verified_weight_kg_m;
  end if;

  if v_weight<>v_ctx.left_weight_kg_m
     and v_weight<>v_ctx.right_weight_kg_m then
    raise exception using errcode='22023',
      message='verified kg/m must equal one of the two published evidence values';
  end if;

  v_grade := case
    when v_ctx.readiness_status='ready_same_grade'
      then v_ctx.left_material_grade_id
    else null
  end;

  v_actor := coalesce(p_promoted_by,auth.uid(),v_ctx.decided_by);
  if v_actor is null then
    raise exception using errcode='22023',
      message='verified-weight promotion requires an accountable actor';
  end if;

  insert into public.steel_weight_references (
    geometry_id,
    material_grade_id,
    weight_kg_m,
    weight_method,
    density_kg_m3,
    formula_version,
    is_canonical,
    knowledge_source_id,
    source_document_id,
    source_locator,
    metadata,
    verified_at,
    verification_decision_id,
    verified_by
  ) values (
    v_ctx.geometry_id,
    v_grade,
    v_weight,
    'verified',
    null,
    null,
    false,
    null,
    null,
    jsonb_build_object(
      'kind','controlled_weight_reconciliation',
      'decision_id',v_ctx.decision_id
    ),
    jsonb_strip_nulls(jsonb_build_object(
      'promotion_microblock','SK4.5f',
      'promotion_policy_version',1,
      'promotion_decision_id',v_ctx.decision_id,
      'promotion_rationale',nullif(btrim(p_rationale),''),
      'readiness_status',v_ctx.readiness_status,
      'grade_scope',v_ctx.grade_scope,
      'left_reference_id',v_ctx.left_reference_id,
      'right_reference_id',v_ctx.right_reference_id,
      'canonical_selected',false
    )),
    now(),
    v_ctx.decision_id,
    v_actor
  )
  returning * into v_row;

  return v_row;
end
$$;

comment on column public.steel_weight_references.verification_decision_id is
  'SK4.5f immutable link from a derived verified weight to the accepted reconciliation decision that authorized it.';
comment on column public.steel_weight_references.verified_by is
  'SK4.5f accountable actor for the controlled verified-weight promotion.';
comment on function public.p1_promote_steel_weight_reconciliation_decision(uuid,numeric,text,uuid) is
  'Service-only controlled promotion. Creates a new non-canonical verified weight only from accepted + live ready_* reconciliation evidence; published inputs are never updated.';

revoke all on function public.p1_promote_steel_weight_reconciliation_decision(uuid,numeric,text,uuid)
  from public,anon,authenticated;
grant execute on function public.p1_promote_steel_weight_reconciliation_decision(uuid,numeric,text,uuid)
  to service_role;

-- Migration acceptance assertions. Use one currently unreviewed exact candidate,
-- then clean up every temporary artifact. Existing production decisions are never
-- overwritten by this test.
do $$
declare
  v_candidate record;
  v_ctx record;
  v_decision public.steel_weight_reconciliation_decisions;
  v_verified public.steel_weight_references;
  v_actor uuid := gen_random_uuid();
  v_before_refs jsonb;
  v_after_refs jsonb;
  v_before_verified_count integer;
  v_after_verified_count integer;
  v_rejected boolean := false;
  v_canonical_rejected boolean := false;
  v_conversion_rejected boolean := false;
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
    raise exception 'SK4.5f requires at least one unreviewed exact candidate for migration acceptance';
  end if;

  insert into auth.users (
    instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_actor,
    'authenticated',
    'authenticated',
    'sk45f-ci-'||v_actor::text||'@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  select jsonb_agg(to_jsonb(w) order by w.id)
  into v_before_refs
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
    'needs_review',
    'SK4.5f negative-gate migration assertion',
    v_actor
  );

  begin
    perform public.p1_promote_steel_weight_reconciliation_decision(
      v_decision.id,null,'must be blocked before acceptance',v_actor
    );
  exception
    when sqlstate '22023' then
      v_rejected := true;
  end;

  if not v_rejected then
    raise exception 'SK4.5f non-accepted decision unexpectedly promoted';
  end if;

  select * into v_decision
  from public.p1_record_steel_weight_reconciliation_decision(
    v_candidate.left_reference_id,
    v_candidate.right_reference_id,
    0.50,
    'accepted',
    'SK4.5f accepted migration assertion',
    v_actor
  );

  select * into v_ctx
  from public.steel_weight_promotion_context(v_decision.id);

  if v_ctx.readiness_status not in ('ready_same_grade','ready_weight_only')
     or not v_ctx.verified_weight_ready
     or v_ctx.canonical_auto_promotion_allowed then
    raise exception 'SK4.5f accepted decision did not resolve to safe ready_* state: %',
      v_ctx.readiness_status;
  end if;

  select * into v_verified
  from public.p1_promote_steel_weight_reconciliation_decision(
    v_decision.id,null,'SK4.5f migration acceptance',v_actor
  );

  if v_verified.weight_method<>'verified'
     or v_verified.is_canonical
     or v_verified.verification_decision_id<>v_decision.id
     or v_verified.verified_by<>v_actor
     or v_verified.verified_at is null
     or v_verified.knowledge_source_id is not null
     or v_verified.source_document_id is not null then
    raise exception 'SK4.5f verified reference contract regression';
  end if;

  if v_verified.weight_kg_m<>v_candidate.left_weight_kg_m
     and v_verified.weight_kg_m<>v_candidate.right_weight_kg_m then
    raise exception 'SK4.5f promoted kg/m is not one of the published evidence values';
  end if;

  if v_ctx.readiness_status='ready_weight_only'
     and v_verified.material_grade_id is not null then
    raise exception 'SK4.5f grade-neutral corroboration leaked grade applicability';
  end if;

  if v_ctx.readiness_status='ready_same_grade'
     and v_verified.material_grade_id is distinct from v_ctx.left_material_grade_id then
    raise exception 'SK4.5f same-grade promotion lost material grade';
  end if;

  select count(*) into v_after_verified_count
  from public.steel_weight_references
  where weight_method='verified';

  if v_after_verified_count<>v_before_verified_count+1 then
    raise exception 'SK4.5f expected exactly one new verified reference during assertion';
  end if;

  begin
    insert into public.steel_weight_references (
      geometry_id,material_grade_id,weight_kg_m,weight_method,is_canonical,
      source_locator,metadata,verified_at,verification_decision_id,verified_by
    ) values (
      v_ctx.geometry_id,
      case when v_ctx.readiness_status='ready_same_grade'
        then v_ctx.left_material_grade_id else null end,
      v_verified.weight_kg_m,
      'verified',
      true,
      '{}'::jsonb,
      '{}'::jsonb,
      now(),
      v_decision.id,
      v_actor
    );
  exception
    when sqlstate '22023' then
      v_canonical_rejected := true;
  end;

  if not v_canonical_rejected then
    raise exception 'SK4.5f canonical auto-selection guard regression';
  end if;

  begin
    update public.steel_weight_references
    set
      weight_method='verified',
      verification_decision_id=v_decision.id,
      verified_by=v_actor,
      is_canonical=false
    where id=v_candidate.left_reference_id;
  exception
    when sqlstate '22023' then
      v_conversion_rejected := true;
  end;

  if not v_conversion_rejected then
    raise exception 'SK4.5f published-to-verified in-place conversion guard regression';
  end if;

  select jsonb_agg(to_jsonb(w) order by w.id)
  into v_after_refs
  from public.steel_weight_references w
  where w.id in (v_candidate.left_reference_id,v_candidate.right_reference_id);

  if v_after_refs is distinct from v_before_refs then
    raise exception 'SK4.5f promotion mutated original published evidence rows';
  end if;

  if has_function_privilege(
       'anon',
       'public.p1_promote_steel_weight_reconciliation_decision(uuid,numeric,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.p1_promote_steel_weight_reconciliation_decision(uuid,numeric,text,uuid)',
       'EXECUTE'
     ) then
    raise exception 'SK4.5f promotion RPC must remain service-role only';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.p1_promote_steel_weight_reconciliation_decision(uuid,numeric,text,uuid)',
       'EXECUTE'
     ) then
    raise exception 'SK4.5f service-role promotion execute privilege missing';
  end if;

  delete from public.steel_weight_references
  where id=v_verified.id;

  delete from public.steel_weight_reconciliation_decisions
  where id=v_decision.id;

  delete from auth.users where id=v_actor;

  select count(*) into v_after_verified_count
  from public.steel_weight_references
  where weight_method='verified';

  if v_after_verified_count<>v_before_verified_count then
    raise exception 'SK4.5f migration assertion leaked a verified reference';
  end if;
end
$$;
