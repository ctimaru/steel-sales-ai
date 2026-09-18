-- P1.15 / SK4.5c — reconciliation decision ledger.
--
-- Persists an auditable human/admin decision for a generated reconciliation pair.
-- This ledger deliberately does NOT mutate steel_weight_references, canonical flags,
-- verified_at, or source provenance. Promotion remains a separate future action.

create table public.steel_weight_reconciliation_decisions (
  id uuid primary key default gen_random_uuid(),
  left_reference_id uuid not null references public.steel_weight_references(id) on delete restrict,
  right_reference_id uuid not null references public.steel_weight_references(id) on delete restrict,
  geometry_id uuid not null references public.steel_geometries(id) on delete restrict,
  tolerance_pct numeric not null check (tolerance_pct >= 0),
  observed_reconciliation_status text not null
    check (observed_reconciliation_status in ('exact_match','within_tolerance','mismatch')),
  observed_delta_pct numeric not null check (observed_delta_pct >= 0),
  decision text not null check (decision in ('accepted','rejected','needs_review')),
  rationale text,
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (left_reference_id <> right_reference_id),
  check (left_reference_id < right_reference_id),
  unique (left_reference_id, right_reference_id)
);

create index steel_weight_reconciliation_decisions_geometry_idx
  on public.steel_weight_reconciliation_decisions (geometry_id, decision, decided_at desc);

alter table public.steel_weight_reconciliation_decisions enable row level security;

revoke all on table public.steel_weight_reconciliation_decisions from public, anon, authenticated;
grant select on table public.steel_weight_reconciliation_decisions to authenticated;
grant select, insert, update, delete on table public.steel_weight_reconciliation_decisions to service_role;

create policy steel_weight_reconciliation_decisions_authenticated_read
  on public.steel_weight_reconciliation_decisions
  for select
  to authenticated
  using (true);

create or replace function public.p1_record_steel_weight_reconciliation_decision(
  p_left_reference_id uuid,
  p_right_reference_id uuid,
  p_tolerance_pct numeric,
  p_decision text,
  p_rationale text default null,
  p_decided_by uuid default null
)
returns public.steel_weight_reconciliation_decisions
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_left uuid := least(p_left_reference_id, p_right_reference_id);
  v_right uuid := greatest(p_left_reference_id, p_right_reference_id);
  v_actor uuid := coalesce(p_decided_by, auth.uid());
  v_candidate record;
  v_row public.steel_weight_reconciliation_decisions;
begin
  if p_left_reference_id is null or p_right_reference_id is null or p_left_reference_id = p_right_reference_id then
    raise exception using errcode='22023', message='two distinct reconciliation reference ids are required';
  end if;
  if p_tolerance_pct is null or p_tolerance_pct < 0 then
    raise exception using errcode='22023', message='reconciliation decision tolerance must be non-negative';
  end if;
  if p_decision is null or p_decision not in ('accepted','rejected','needs_review') then
    raise exception using errcode='22023', message='reconciliation decision must be accepted, rejected, or needs_review';
  end if;
  if v_actor is null then
    raise exception using errcode='22023', message='reconciliation decision requires an authenticated actor';
  end if;

  select c.* into v_candidate
  from public.p1_shared_steel_weight_reconciliation_candidates(p_tolerance_pct, null, 1000, 0) c
  where c.left_reference_id = v_left and c.right_reference_id = v_right
  limit 1;

  if v_candidate.left_reference_id is null then
    raise exception using errcode='22023', message='reference pair is not an eligible independent reconciliation candidate';
  end if;

  insert into public.steel_weight_reconciliation_decisions (
    left_reference_id,right_reference_id,geometry_id,tolerance_pct,
    observed_reconciliation_status,observed_delta_pct,decision,rationale,decided_by
  ) values (
    v_left,v_right,v_candidate.geometry_id,p_tolerance_pct,
    v_candidate.reconciliation_status,v_candidate.delta_pct,p_decision,nullif(btrim(p_rationale),''),v_actor
  )
  on conflict (left_reference_id,right_reference_id) do update set
    geometry_id=excluded.geometry_id,
    tolerance_pct=excluded.tolerance_pct,
    observed_reconciliation_status=excluded.observed_reconciliation_status,
    observed_delta_pct=excluded.observed_delta_pct,
    decision=excluded.decision,
    rationale=excluded.rationale,
    decided_by=excluded.decided_by,
    decided_at=now()
  returning * into v_row;

  return v_row;
end
$$;

comment on table public.steel_weight_reconciliation_decisions is
  'Audit ledger for explicit reconciliation decisions. Decisions never promote or mutate canonical weight references.';
comment on function public.p1_record_steel_weight_reconciliation_decision(uuid,uuid,numeric,text,text,uuid) is
  'Service-controlled decision writer for an eligible reconciliation candidate; no canonical/verified promotion side effects.';

revoke all on function public.p1_record_steel_weight_reconciliation_decision(uuid,uuid,numeric,text,text,uuid) from public, anon, authenticated;
grant execute on function public.p1_record_steel_weight_reconciliation_decision(uuid,uuid,numeric,text,text,uuid) to service_role;

do $$
declare
  v_candidate record;
  v_actor uuid;
  v_before_canonical integer;
  v_before_verified integer;
  v_after_canonical integer;
  v_after_verified integer;
  v_decision public.steel_weight_reconciliation_decisions;
begin
  select * into v_candidate
  from public.p1_shared_steel_weight_reconciliation_candidates(0.50,'exact_match',1000,0)
  where geometry_key='round|od=168.3|t=7.11'
  limit 1;
  if v_candidate.left_reference_id is null then
    raise exception 'SK4.5c baseline candidate missing';
  end if;

  -- Fresh CI rebuilds intentionally have no auth users. Create a transaction-local
  -- synthetic actor only for this migration assertion, then remove it below.
  insert into auth.users (
    instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,
    raw_app_meta_data,raw_user_meta_data,created_at,updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000'::uuid,
    '45c50000-0000-4000-8000-000000000001'::uuid,
    'authenticated','authenticated','sk45c-ci@example.invalid','',now(),
    '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb,now(),now()
  ) on conflict (id) do nothing;
  v_actor := '45c50000-0000-4000-8000-000000000001'::uuid;

  select count(*) filter(where is_canonical), count(*) filter(where weight_method='verified')
  into v_before_canonical,v_before_verified
  from public.steel_weight_references
  where id in (v_candidate.left_reference_id,v_candidate.right_reference_id);

  select * into v_decision
  from public.p1_record_steel_weight_reconciliation_decision(
    v_candidate.left_reference_id,v_candidate.right_reference_id,0.50,
    'needs_review','SK4.5c migration acceptance baseline',v_actor
  );

  if v_decision.decision <> 'needs_review'
     or v_decision.observed_reconciliation_status <> 'exact_match'
     or v_decision.observed_delta_pct <> 0 then
    raise exception 'SK4.5c decision snapshot regression';
  end if;

  select count(*) filter(where is_canonical), count(*) filter(where weight_method='verified')
  into v_after_canonical,v_after_verified
  from public.steel_weight_references
  where id in (v_candidate.left_reference_id,v_candidate.right_reference_id);

  if v_before_canonical <> v_after_canonical or v_before_verified <> v_after_verified then
    raise exception 'SK4.5c decision writer must not promote or mutate canonical/verified weights';
  end if;

  if has_table_privilege('anon','public.steel_weight_reconciliation_decisions','SELECT')
     or has_table_privilege('authenticated','public.steel_weight_reconciliation_decisions','INSERT') then
    raise exception 'SK4.5c ledger privilege regression';
  end if;
  if not has_table_privilege('authenticated','public.steel_weight_reconciliation_decisions','SELECT') then
    raise exception 'SK4.5c authenticated read privilege missing';
  end if;
  if has_function_privilege('anon','public.p1_record_steel_weight_reconciliation_decision(uuid,uuid,numeric,text,text,uuid)','EXECUTE')
     or has_function_privilege('authenticated','public.p1_record_steel_weight_reconciliation_decision(uuid,uuid,numeric,text,text,uuid)','EXECUTE') then
    raise exception 'SK4.5c decision writer must be service-role only';
  end if;

  delete from public.steel_weight_reconciliation_decisions where id=v_decision.id;
  delete from auth.users where id=v_actor and email='sk45c-ci@example.invalid';
end
$;
