-- P1.15 / SK4.5i — controlled canonical promotion.
--
-- First controlled write path for steel_weight_references.is_canonical.
--
-- Invariants:
--   * only the latest explicit canonical decision, with decision='accepted',
--     may promote;
--   * the SK4.5h decision snapshot must still match the live SK4.5g readiness
--     context exactly at promotion time;
--   * only a weight_method='verified' target can become canonical;
--   * at most one canonical exists per exact (geometry_id, material_grade_id)
--     scope, with NULL treated as a real grade-neutral scope;
--   * previous canonical rows are preserved and only lose is_canonical=true;
--   * every switch is recorded in an append-only promotion ledger;
--   * direct canonical toggles outside the controlled promotion transaction
--     are rejected.

do $$
begin
  if exists (
    select 1
    from public.steel_weight_references
    where is_canonical
    group by geometry_id,material_grade_id
    having count(*)>1
  ) then
    raise exception
      'SK4.5i cannot enforce canonical uniqueness while duplicate canonical scopes exist';
  end if;
end
$$;

create unique index steel_weight_references_one_canonical_per_scope_uq
  on public.steel_weight_references (geometry_id,material_grade_id)
  nulls not distinct
  where is_canonical;

create table public.steel_weight_canonical_promotions (
  id uuid primary key default gen_random_uuid(),
  canonical_decision_id uuid not null unique
    references public.steel_weight_canonical_decisions(id) on delete restrict,
  verified_reference_id uuid not null
    references public.steel_weight_references(id) on delete restrict,
  geometry_id uuid not null
    references public.steel_geometries(id) on delete restrict,
  material_grade_id uuid
    references public.steel_material_grades(id) on delete restrict,
  promoted_weight_kg_m numeric not null
    check (promoted_weight_kg_m > 0),

  previous_canonical_reference_id uuid
    references public.steel_weight_references(id) on delete restrict,
  previous_canonical_weight_kg_m numeric,
  previous_canonical_weight_method text,

  promotion_action text not null
    check (promotion_action in (
      'create_scope_canonical',
      'confirm_existing_value',
      'replace_existing_canonical'
    )),
  rationale text,
  promoted_by uuid not null
    references auth.users(id) on delete restrict,
  promoted_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  check (
    (
      promotion_action='create_scope_canonical'
      and previous_canonical_reference_id is null
      and previous_canonical_weight_kg_m is null
      and previous_canonical_weight_method is null
    )
    or
    (
      promotion_action in ('confirm_existing_value','replace_existing_canonical')
      and previous_canonical_reference_id is not null
      and previous_canonical_weight_kg_m is not null
      and previous_canonical_weight_method is not null
    )
  ),
  check (previous_canonical_reference_id is distinct from verified_reference_id)
);

create index steel_weight_canonical_promotions_reference_idx
  on public.steel_weight_canonical_promotions (
    verified_reference_id,
    promoted_at desc
  );

create index steel_weight_canonical_promotions_scope_idx
  on public.steel_weight_canonical_promotions (
    geometry_id,
    material_grade_id,
    promoted_at desc
  );

create index steel_weight_canonical_promotions_material_grade_idx
  on public.steel_weight_canonical_promotions (material_grade_id)
  where material_grade_id is not null;

create index steel_weight_canonical_promotions_previous_canonical_idx
  on public.steel_weight_canonical_promotions (previous_canonical_reference_id)
  where previous_canonical_reference_id is not null;

create index steel_weight_canonical_promotions_promoted_by_idx
  on public.steel_weight_canonical_promotions (promoted_by);

alter table public.steel_weight_canonical_promotions enable row level security;

revoke all on table public.steel_weight_canonical_promotions
  from public,anon,authenticated;

grant select on table public.steel_weight_canonical_promotions
  to authenticated;

grant select,insert on table public.steel_weight_canonical_promotions
  to service_role;

create policy steel_weight_canonical_promotions_authenticated_read
  on public.steel_weight_canonical_promotions
  for select
  to authenticated
  using (true);

create or replace function public.steel_weight_canonical_promotion_context(
  p_canonical_decision_id uuid
)
returns table (
  canonical_decision_id uuid,
  verified_reference_id uuid,
  geometry_id uuid,
  material_grade_id uuid,
  verified_weight_kg_m numeric,
  decision text,
  decided_by uuid,
  decided_at timestamptz,
  decision_is_latest boolean,
  decision_snapshot_is_current boolean,
  live_readiness_status text,
  live_canonical_review_ready boolean,
  live_canonical_action_hint text,
  live_verification_basis_readiness_status text,
  live_verification_basis_current boolean,
  live_grade_scope text,
  live_grade_scope_consistent boolean,
  live_scope_canonical_count integer,
  live_current_canonical_reference_id uuid,
  live_current_canonical_weight_kg_m numeric,
  live_current_canonical_weight_method text,
  live_scope_verified_reference_count integer,
  live_scope_distinct_verified_weight_count integer,
  eligible_for_canonical_promotion boolean
)
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $$
begin
  if p_canonical_decision_id is null then
    raise exception using errcode='22023',
      message='canonical promotion requires a canonical decision id';
  end if;

  return query
  select
    d.id,
    d.verified_reference_id,
    d.geometry_id,
    d.material_grade_id,
    d.verified_weight_kg_m,
    d.decision,
    d.decided_by,
    d.decided_at,
    not exists (
      select 1
      from public.steel_weight_canonical_decisions child
      where child.supersedes_decision_id=d.id
    ) as decision_is_latest,
    (
      d.geometry_id=r.geometry_id
      and d.material_grade_id is not distinct from r.material_grade_id
      and d.verified_weight_kg_m=r.weight_kg_m
      and d.verification_decision_id=r.verification_decision_id
      and d.observed_readiness_status=r.readiness_status
      and d.observed_canonical_action_hint=r.canonical_action_hint
      and d.observed_verification_basis_readiness_status
        is not distinct from r.verification_basis_readiness_status
      and d.observed_verification_basis_current=r.verification_basis_current
      and d.observed_grade_scope is not distinct from r.grade_scope
      and d.observed_grade_scope_consistent=r.grade_scope_consistent
      and d.observed_scope_canonical_count=r.scope_canonical_count
      and d.observed_current_canonical_reference_id
        is not distinct from r.current_canonical_reference_id
      and d.observed_current_canonical_weight_kg_m
        is not distinct from r.current_canonical_weight_kg_m
      and d.observed_current_canonical_weight_method
        is not distinct from r.current_canonical_weight_method
      and d.observed_scope_verified_reference_count=r.scope_verified_reference_count
      and d.observed_scope_distinct_verified_weight_count=
        r.scope_distinct_verified_weight_count
    ) as decision_snapshot_is_current,
    r.readiness_status,
    r.canonical_review_ready,
    r.canonical_action_hint,
    r.verification_basis_readiness_status,
    r.verification_basis_current,
    r.grade_scope,
    r.grade_scope_consistent,
    r.scope_canonical_count,
    r.current_canonical_reference_id,
    r.current_canonical_weight_kg_m,
    r.current_canonical_weight_method,
    r.scope_verified_reference_count,
    r.scope_distinct_verified_weight_count,
    (
      d.decision='accepted'
      and not exists (
        select 1
        from public.steel_weight_canonical_decisions child
        where child.supersedes_decision_id=d.id
      )
      and d.geometry_id=r.geometry_id
      and d.material_grade_id is not distinct from r.material_grade_id
      and d.verified_weight_kg_m=r.weight_kg_m
      and d.verification_decision_id=r.verification_decision_id
      and d.observed_readiness_status=r.readiness_status
      and d.observed_canonical_action_hint=r.canonical_action_hint
      and d.observed_verification_basis_readiness_status
        is not distinct from r.verification_basis_readiness_status
      and d.observed_verification_basis_current=r.verification_basis_current
      and d.observed_grade_scope is not distinct from r.grade_scope
      and d.observed_grade_scope_consistent=r.grade_scope_consistent
      and d.observed_scope_canonical_count=r.scope_canonical_count
      and d.observed_current_canonical_reference_id
        is not distinct from r.current_canonical_reference_id
      and d.observed_current_canonical_weight_kg_m
        is not distinct from r.current_canonical_weight_kg_m
      and d.observed_current_canonical_weight_method
        is not distinct from r.current_canonical_weight_method
      and d.observed_scope_verified_reference_count=r.scope_verified_reference_count
      and d.observed_scope_distinct_verified_weight_count=
        r.scope_distinct_verified_weight_count
      and r.readiness_status='ready_for_canonical_review'
      and coalesce(r.canonical_review_ready,false)
      and r.canonical_action_hint in (
        'create_scope_canonical',
        'confirm_existing_value',
        'replace_existing_canonical'
      )
      and not coalesce(r.canonical_auto_promotion_allowed,false)
    ) as eligible_for_canonical_promotion
  from public.steel_weight_canonical_decisions d
  join lateral public.steel_weight_canonical_readiness_context(
    d.verified_reference_id
  ) r on true
  where d.id=p_canonical_decision_id;
end
$$;

comment on function public.steel_weight_canonical_promotion_context(uuid) is
  'SK4.5i service-only live revalidation of one explicit canonical decision against its full SK4.5h snapshot and current SK4.5g readiness.';

revoke all on function public.steel_weight_canonical_promotion_context(uuid)
  from public,anon,authenticated;

grant execute on function public.steel_weight_canonical_promotion_context(uuid)
  to service_role;

create or replace function public.steel_guard_weight_canonical_mutation()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_promotion_id_text text;
  v_promotion_id uuid;
  v_promotion record;
begin
  if old.is_canonical is not distinct from new.is_canonical then
    return new;
  end if;

  v_promotion_id_text :=
    nullif(current_setting('app.steel_canonical_promotion_id',true),'');

  if v_promotion_id_text is null then
    raise exception using errcode='22023',
      message='canonical weight flags may only change through the controlled canonical promotion writer';
  end if;

  begin
    v_promotion_id := v_promotion_id_text::uuid;
  exception
    when invalid_text_representation then
      raise exception using errcode='22023',
        message='invalid controlled canonical promotion context';
  end;

  select
    p.*,
    d.decision as canonical_decision
  into v_promotion
  from public.steel_weight_canonical_promotions p
  join public.steel_weight_canonical_decisions d
    on d.id=p.canonical_decision_id
  where p.id=v_promotion_id;

  if not found or v_promotion.canonical_decision<>'accepted' then
    raise exception using errcode='22023',
      message='canonical mutation is not backed by an accepted promotion event';
  end if;

  if new.geometry_id<>v_promotion.geometry_id
     or new.material_grade_id is distinct from v_promotion.material_grade_id then
    raise exception using errcode='22023',
      message='canonical mutation escaped the promotion geometry/grade scope';
  end if;

  if not old.is_canonical and new.is_canonical then
    if old.id<>v_promotion.verified_reference_id
       or old.weight_method<>'verified' then
      raise exception using errcode='22023',
        message='only the promotion target verified reference may become canonical';
    end if;
  elsif old.is_canonical and not new.is_canonical then
    if v_promotion.previous_canonical_reference_id is null
       or old.id<>v_promotion.previous_canonical_reference_id then
      raise exception using errcode='22023',
        message='only the snapshotted previous canonical may be demoted';
    end if;
  else
    raise exception using errcode='22023',
      message='unsupported canonical flag transition';
  end if;

  return new;
end
$$;

revoke all on function public.steel_guard_weight_canonical_mutation()
  from public,anon,authenticated;

drop trigger if exists steel_guard_weight_canonical_mutation
  on public.steel_weight_references;

create trigger steel_guard_weight_canonical_mutation
before update of is_canonical on public.steel_weight_references
for each row execute function public.steel_guard_weight_canonical_mutation();

-- Preserve SK4.5f verified immutability while allowing only the is_canonical bit
-- to change. The dedicated canonical trigger above authorizes that bit change.
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
    if (to_jsonb(new)-'is_canonical')
       is distinct from
       (to_jsonb(old)-'is_canonical') then
      raise exception using errcode='22023',
        message='verified weight references are immutable except for controlled canonical selection';
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
      message='new verified references must start non-canonical and use controlled canonical promotion later';
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

create or replace function public.p1_promote_steel_weight_canonical_decision(
  p_canonical_decision_id uuid,
  p_rationale text default null,
  p_promoted_by uuid default null
)
returns public.steel_weight_canonical_promotions
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_ctx record;
  v_existing public.steel_weight_canonical_promotions;
  v_event public.steel_weight_canonical_promotions;
  v_actor uuid;
  v_scope_lock text;
  v_final_canonical_count integer;
  v_target_is_canonical boolean;
begin
  if p_canonical_decision_id is null then
    raise exception using errcode='22023',
      message='canonical promotion requires a canonical decision id';
  end if;

  select * into v_existing
  from public.steel_weight_canonical_promotions
  where canonical_decision_id=p_canonical_decision_id
  limit 1;

  if found then
    return v_existing;
  end if;

  select * into v_ctx
  from public.steel_weight_canonical_promotion_context(
    p_canonical_decision_id
  );

  if not found then
    raise exception using errcode='22023',
      message='canonical decision was not found or its verified target is unavailable';
  end if;

  v_scope_lock :=
    'steel-canonical|'
    ||v_ctx.geometry_id::text
    ||'|'
    ||coalesce(v_ctx.material_grade_id::text,'grade-neutral');

  perform pg_advisory_xact_lock(hashtext(v_scope_lock));

  -- Re-read after acquiring the scope lock so the promotion is based on the
  -- exact state that will be mutated.
  select * into v_ctx
  from public.steel_weight_canonical_promotion_context(
    p_canonical_decision_id
  );

  if not found then
    raise exception using errcode='22023',
      message='canonical decision became unavailable during promotion';
  end if;

  if v_ctx.decision<>'accepted'
     or not v_ctx.decision_is_latest
     or not v_ctx.decision_snapshot_is_current
     or not coalesce(v_ctx.eligible_for_canonical_promotion,false) then
    raise exception using errcode='22023',
      message=format(
        'canonical decision is not eligible for promotion: decision=%s latest=%s snapshot_current=%s readiness=%s',
        coalesce(v_ctx.decision,'missing'),
        coalesce(v_ctx.decision_is_latest,false),
        coalesce(v_ctx.decision_snapshot_is_current,false),
        coalesce(v_ctx.live_readiness_status,'missing')
      );
  end if;

  if v_ctx.live_canonical_action_hint not in (
    'create_scope_canonical',
    'confirm_existing_value',
    'replace_existing_canonical'
  ) then
    raise exception using errcode='22023',
      message='canonical promotion requires an explicit actionable live readiness state';
  end if;

  -- Lock all rows in the exact canonical scope before switching flags.
  perform 1
  from public.steel_weight_references w
  where w.geometry_id=v_ctx.geometry_id
    and w.material_grade_id is not distinct from v_ctx.material_grade_id
  for update;

  -- Revalidate once more after row locks.
  select * into v_ctx
  from public.steel_weight_canonical_promotion_context(
    p_canonical_decision_id
  );

  if not coalesce(v_ctx.eligible_for_canonical_promotion,false) then
    raise exception using errcode='22023',
      message='canonical decision became stale while acquiring row locks';
  end if;

  v_actor := coalesce(p_promoted_by,auth.uid(),v_ctx.decided_by);
  if v_actor is null then
    raise exception using errcode='22023',
      message='canonical promotion requires an accountable actor';
  end if;

  insert into public.steel_weight_canonical_promotions (
    canonical_decision_id,
    verified_reference_id,
    geometry_id,
    material_grade_id,
    promoted_weight_kg_m,
    previous_canonical_reference_id,
    previous_canonical_weight_kg_m,
    previous_canonical_weight_method,
    promotion_action,
    rationale,
    promoted_by,
    metadata
  ) values (
    v_ctx.canonical_decision_id,
    v_ctx.verified_reference_id,
    v_ctx.geometry_id,
    v_ctx.material_grade_id,
    v_ctx.verified_weight_kg_m,
    v_ctx.live_current_canonical_reference_id,
    v_ctx.live_current_canonical_weight_kg_m,
    v_ctx.live_current_canonical_weight_method,
    v_ctx.live_canonical_action_hint,
    nullif(btrim(p_rationale),''),
    v_actor,
    jsonb_build_object(
      'microblock','SK4.5i',
      'canonical_promotion_policy_version',1,
      'decision_snapshot_revalidated',true,
      'decision_is_latest',true,
      'verification_basis_readiness_status',
        v_ctx.live_verification_basis_readiness_status,
      'grade_scope',v_ctx.live_grade_scope
    )
  )
  returning * into v_event;

  perform set_config(
    'app.steel_canonical_promotion_id',
    v_event.id::text,
    true
  );

  if v_ctx.live_current_canonical_reference_id is not null then
    update public.steel_weight_references
    set is_canonical=false
    where id=v_ctx.live_current_canonical_reference_id
      and is_canonical=true;

    if not found then
      raise exception using errcode='22023',
        message='snapshotted previous canonical changed before controlled demotion';
    end if;
  end if;

  update public.steel_weight_references
  set is_canonical=true
  where id=v_ctx.verified_reference_id
    and weight_method='verified'
    and is_canonical=false;

  if not found then
    raise exception using errcode='22023',
      message='verified canonical target changed before controlled promotion';
  end if;

  select
    count(*) filter (where w.is_canonical),
    bool_or(
      w.id=v_ctx.verified_reference_id
      and w.is_canonical
    )
  into v_final_canonical_count,v_target_is_canonical
  from public.steel_weight_references w
  where w.geometry_id=v_ctx.geometry_id
    and w.material_grade_id is not distinct from v_ctx.material_grade_id;

  if v_final_canonical_count<>1
     or not coalesce(v_target_is_canonical,false) then
    raise exception using errcode='22023',
      message='controlled canonical promotion failed final scope invariant';
  end if;

  perform set_config('app.steel_canonical_promotion_id','',true);

  return v_event;
end
$$;

comment on table public.steel_weight_canonical_promotions is
  'SK4.5i append-only audit of controlled canonical switches. Stores the accepted decision, target verified reference and previous canonical snapshot.';

comment on function public.p1_promote_steel_weight_canonical_decision(
  uuid,text,uuid
) is
  'Service-only SK4.5i writer. Revalidates the latest accepted canonical decision and exact live snapshot before atomically switching one canonical per geometry+grade scope.';

revoke all on function public.p1_promote_steel_weight_canonical_decision(
  uuid,text,uuid
) from public,anon,authenticated;

grant execute on function public.p1_promote_steel_weight_canonical_decision(
  uuid,text,uuid
) to service_role;

-- Migration acceptance.
-- Use a grade-neutral verification candidate with no real canonical in that
-- grade-neutral scope, add a temporary calculated canonical, prove direct flag
-- changes are blocked, then perform a controlled confirm-existing-value switch.
-- Every fixture is removed at the end, leaving production/seed state unchanged.
do $$
declare
  v_candidate record;
  v_reconciliation public.steel_weight_reconciliation_decisions;
  v_verified public.steel_weight_references;
  v_fixture_canonical public.steel_weight_references;
  v_canonical_decision public.steel_weight_canonical_decisions;
  v_promotion public.steel_weight_canonical_promotions;
  v_promotion_again public.steel_weight_canonical_promotions;
  v_actor uuid := gen_random_uuid();
  v_before_canonical_ids jsonb;
  v_after_canonical_ids jsonb;
  v_direct_toggle_rejected boolean := false;
  v_duplicate_canonical_rejected boolean := false;
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
    and (
      (c.left_material_grade_id is null and c.right_material_grade_id is not null)
      or
      (c.left_material_grade_id is not null and c.right_material_grade_id is null)
    )
    and not exists (
      select 1
      from public.steel_weight_references existing_canonical
      where existing_canonical.geometry_id=c.geometry_id
        and existing_canonical.material_grade_id is null
        and existing_canonical.is_canonical
    )
  order by c.geometry_key,c.left_reference_id,c.right_reference_id
  limit 1;

  if v_candidate.left_reference_id is null then
    raise exception
      'SK4.5i requires one unreviewed grade-neutral exact candidate with an empty grade-neutral canonical scope';
  end if;

  insert into auth.users (
    instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_actor,
    'authenticated',
    'authenticated',
    'sk45i-ci-'||v_actor::text||'@example.invalid',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  select jsonb_agg(w.id order by w.id)
  into v_before_canonical_ids
  from public.steel_weight_references w
  where w.is_canonical;

  select * into v_reconciliation
  from public.p1_record_steel_weight_reconciliation_decision(
    v_candidate.left_reference_id,
    v_candidate.right_reference_id,
    0.50,
    'accepted',
    'SK4.5i reconciliation fixture',
    v_actor
  );

  select * into v_verified
  from public.p1_promote_steel_weight_reconciliation_decision(
    v_reconciliation.id,
    null,
    'SK4.5i verified fixture',
    v_actor
  );

  if v_verified.material_grade_id is not null
     or v_verified.is_canonical then
    raise exception
      'SK4.5i fixture must be a grade-neutral non-canonical verified reference';
  end if;

  insert into public.steel_weight_references (
    geometry_id,
    material_grade_id,
    weight_kg_m,
    weight_method,
    formula_version,
    is_canonical,
    metadata
  ) values (
    v_verified.geometry_id,
    null,
    v_verified.weight_kg_m,
    'calculated',
    'SK4.5i-fixture-'||v_actor::text,
    true,
    jsonb_build_object('migration_fixture','SK4.5i')
  )
  returning * into v_fixture_canonical;

  select * into v_canonical_decision
  from public.p1_record_steel_weight_canonical_decision(
    v_verified.id,
    'accepted',
    'SK4.5i controlled canonical fixture',
    v_actor
  );

  if v_canonical_decision.observed_readiness_status
       <>'ready_for_canonical_review'
     or v_canonical_decision.observed_canonical_action_hint
       <>'confirm_existing_value'
     or v_canonical_decision.observed_current_canonical_reference_id
       <>v_fixture_canonical.id then
    raise exception
      'SK4.5i canonical decision did not snapshot the expected current canonical';
  end if;

  begin
    update public.steel_weight_references
    set is_canonical=true
    where id=v_verified.id;
  exception
    when sqlstate '22023' then
      v_direct_toggle_rejected := true;
  end;

  if not v_direct_toggle_rejected then
    raise exception
      'SK4.5i direct verified canonical toggle unexpectedly succeeded';
  end if;

  select * into v_promotion
  from public.p1_promote_steel_weight_canonical_decision(
    v_canonical_decision.id,
    'SK4.5i migration acceptance promotion',
    v_actor
  );

  if v_promotion.canonical_decision_id<>v_canonical_decision.id
     or v_promotion.verified_reference_id<>v_verified.id
     or v_promotion.previous_canonical_reference_id<>v_fixture_canonical.id
     or v_promotion.promotion_action<>'confirm_existing_value'
     or v_promotion.promoted_by<>v_actor then
    raise exception
      'SK4.5i promotion event contract regression';
  end if;

  if not (
    select is_canonical
    from public.steel_weight_references
    where id=v_verified.id
  ) then
    raise exception
      'SK4.5i target verified reference was not promoted to canonical';
  end if;

  if (
    select is_canonical
    from public.steel_weight_references
    where id=v_fixture_canonical.id
  ) then
    raise exception
      'SK4.5i previous canonical was not demoted';
  end if;

  if (
    select count(*)
    from public.steel_weight_references w
    where w.geometry_id=v_verified.geometry_id
      and w.material_grade_id is null
      and w.is_canonical
  )<>1 then
    raise exception
      'SK4.5i exact scope must contain one and only one canonical after promotion';
  end if;

  select * into v_promotion_again
  from public.p1_promote_steel_weight_canonical_decision(
    v_canonical_decision.id,
    'idempotency retry',
    v_actor
  );

  if v_promotion_again.id<>v_promotion.id then
    raise exception
      'SK4.5i repeated promotion of the same decision must be idempotent';
  end if;

  begin
    insert into public.steel_weight_references (
      geometry_id,
      material_grade_id,
      weight_kg_m,
      weight_method,
      formula_version,
      is_canonical,
      metadata
    ) values (
      v_verified.geometry_id,
      null,
      v_verified.weight_kg_m,
      'calculated',
      'SK4.5i-duplicate-'||v_actor::text,
      true,
      jsonb_build_object('migration_fixture','SK4.5i-duplicate')
    );
  exception
    when unique_violation then
      v_duplicate_canonical_rejected := true;
  end;

  if not v_duplicate_canonical_rejected then
    raise exception
      'SK4.5i one-canonical-per-scope unique invariant regression';
  end if;

  if has_function_privilege(
       'anon',
       'public.p1_promote_steel_weight_canonical_decision(uuid,text,uuid)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.p1_promote_steel_weight_canonical_decision(uuid,text,uuid)',
       'EXECUTE'
     ) then
    raise exception
      'SK4.5i canonical promotion writer must remain service-role only';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.p1_promote_steel_weight_canonical_decision(uuid,text,uuid)',
       'EXECUTE'
     ) then
    raise exception
      'SK4.5i service-role canonical promotion execute privilege missing';
  end if;

  delete from public.steel_weight_canonical_promotions
  where id=v_promotion.id;

  delete from public.steel_weight_canonical_decisions
  where id=v_canonical_decision.id;

  delete from public.steel_weight_references
  where id=v_fixture_canonical.id;

  delete from public.steel_weight_references
  where id=v_verified.id;

  delete from public.steel_weight_reconciliation_decisions
  where id=v_reconciliation.id;

  delete from auth.users
  where id=v_actor;

  select jsonb_agg(w.id order by w.id)
  into v_after_canonical_ids
  from public.steel_weight_references w
  where w.is_canonical;

  if v_after_canonical_ids is distinct from v_before_canonical_ids then
    raise exception
      'SK4.5i migration assertion did not restore the original canonical set';
  end if;
end
$$;
