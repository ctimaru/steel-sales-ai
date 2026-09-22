-- PA2.30 — Reparse Remediation Resolution & Decision Closure.
-- Explicitly closes PA2.26 source-reparse remediation only after PA2.28/PA2.29
-- have reached a terminal, auditable state. No automatic closure is introduced.

create table if not exists public.commercial_offer_reparse_remediation_closure_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  remediation_queue_id bigint not null unique
    references public.commercial_offer_remediation_queue(id) on delete restrict,
  run_id bigint not null
    references public.commercial_offer_reparse_runs(id) on delete restrict,
  thread_id uuid not null
    references public.commercial_threads(id) on delete restrict,
  outcome text not null check (outcome in ('resolved','dismissed')),
  resolution_reason text not null check (resolution_reason in (
    'recovered_required_evidence',
    'no_candidates_from_reparse',
    'all_candidates_rejected'
  )),
  candidate_count integer not null check (candidate_count >= 0),
  accepted_count integer not null check (accepted_count >= 0),
  rejected_count integer not null check (rejected_count >= 0),
  decision_count integer not null check (decision_count >= 0),
  residual_gap_snapshot jsonb not null default '{}'::jsonb,
  conflict_snapshot jsonb not null default '[]'::jsonb,
  closure_snapshot jsonb not null default '{}'::jsonb,
  closed_by uuid not null references auth.users(id) on delete restrict,
  note text,
  closed_at timestamptz not null default now(),
  constraint commercial_offer_reparse_remediation_closure_shape_check check (
    (
      outcome='resolved'
      and resolution_reason='recovered_required_evidence'
      and accepted_count > 0
    )
    or (
      outcome='dismissed'
      and resolution_reason in ('no_candidates_from_reparse','all_candidates_rejected')
    )
  )
);

create index if not exists commercial_offer_reparse_remediation_closure_org_idx
  on public.commercial_offer_reparse_remediation_closure_events(organization_id,closed_at desc);
create index if not exists commercial_offer_reparse_remediation_closure_run_idx
  on public.commercial_offer_reparse_remediation_closure_events(run_id);
create index if not exists commercial_offer_reparse_remediation_closure_thread_idx
  on public.commercial_offer_reparse_remediation_closure_events(thread_id);
create index if not exists commercial_offer_reparse_remediation_closure_closed_by_idx
  on public.commercial_offer_reparse_remediation_closure_events(closed_by,closed_at desc);

alter table public.commercial_offer_reparse_remediation_closure_events enable row level security;

revoke all on public.commercial_offer_reparse_remediation_closure_events
from public,anon,authenticated;
grant select on public.commercial_offer_reparse_remediation_closure_events
to authenticated,service_role;
grant insert on public.commercial_offer_reparse_remediation_closure_events
to service_role;
grant usage,select on sequence public.commercial_offer_reparse_remediation_closure_events_id_seq
to service_role;

drop policy if exists commercial_offer_reparse_remediation_closure_member_select
on public.commercial_offer_reparse_remediation_closure_events;
create policy commercial_offer_reparse_remediation_closure_member_select
on public.commercial_offer_reparse_remediation_closure_events
for select to authenticated
using (public.is_organization_member(organization_id,false));

create or replace function private.prevent_offer_reparse_remediation_closure_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception using
    errcode='55000',
    message='commercial_offer_reparse_remediation_closure_events is append-only';
end;
$$;

revoke all on function private.prevent_offer_reparse_remediation_closure_mutation()
from public,anon,authenticated;

drop trigger if exists commercial_offer_reparse_remediation_closure_immutable
on public.commercial_offer_reparse_remediation_closure_events;
create trigger commercial_offer_reparse_remediation_closure_immutable
before update or delete on public.commercial_offer_reparse_remediation_closure_events
for each row execute function private.prevent_offer_reparse_remediation_closure_mutation();

create or replace function private.offer_reparse_remediation_closure_state(
  p_organization_id uuid,
  p_remediation_queue_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  q public.commercial_offer_remediation_queue%rowtype;
  r public.commercial_offer_reparse_runs%rowtype;
  thread_subject text;
  candidate_count integer := 0;
  pending_count integer := 0;
  accepted_count integer := 0;
  rejected_count integer := 0;
  decision_count integer := 0;
  quantity_gap_count integer := 0;
  price_gap_count integer := 0;
  currency_gap_count integer := 0;
  conflict_snapshot jsonb := '[]'::jsonb;
  conflict_count integer := 0;
  closure_status text;
  recommended_outcome text;
  resolution_reason text;
  allowed_fields constant text[] := array[
    'product_type','grade','standard','material_number',
    'outer_diameter_mm','width_mm','height_mm','thickness_mm','length_mm',
    'quantity','quantity_unit','price_value','price_unit','currency',
    'discount_percentage','availability_status'
  ];
begin
  if p_organization_id is null
     or p_remediation_queue_id is null
     or p_remediation_queue_id <= 0 then
    raise exception 'valid organization and remediation queue id required'
      using errcode='22023';
  end if;

  if (select auth.uid()) is not null
     and not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  select * into q
  from public.commercial_offer_remediation_queue
  where id=p_remediation_queue_id
    and organization_id=p_organization_id
    and category='source_reparse_required'
    and recommended_action='source_email_reparse';

  if not found then
    return jsonb_build_object(
      'closure_status','remediation_not_found',
      'remediation_queue_id',p_remediation_queue_id
    );
  end if;

  select subject into thread_subject
  from public.commercial_threads
  where organization_id=p_organization_id and id=q.thread_id;

  select * into r
  from public.commercial_offer_reparse_runs
  where organization_id=p_organization_id
    and remediation_queue_id=q.id
  order by id desc
  limit 1;

  if r.id is not null then
    select
      count(*)::int,
      count(*) filter(where c.review_status='pending_review')::int,
      count(*) filter(where c.review_status='accepted')::int,
      count(*) filter(where c.review_status='rejected')::int
    into candidate_count,pending_count,accepted_count,rejected_count
    from public.commercial_offer_reparse_candidates c
    where c.organization_id=p_organization_id
      and c.run_id=r.id;

    select count(*)::int
    into decision_count
    from public.commercial_offer_reparse_candidate_decisions d
    where d.organization_id=p_organization_id
      and d.run_id=r.id;

    select
      count(*) filter(where o.quantity is null or o.quantity_unit is null)::int,
      count(*) filter(where o.price_value is null or o.price_unit is null)::int,
      count(*) filter(where o.currency is null)::int
    into quantity_gap_count,price_gap_count,currency_gap_count
    from public.commercial_observations o
    where o.organization_id=p_organization_id
      and o.thread_id=q.thread_id
      and o.item_role='offered';

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'decision_id',x.decision_id,
        'candidate_id',x.candidate_id,
        'target_observation_id',x.target_observation_id,
        'field',x.field_name,
        'current_value',x.current_value,
        'candidate_value',x.candidate_value
      )
      order by x.decision_id,x.field_name
    ),'[]'::jsonb)
    into conflict_snapshot
    from (
      select
        d.id decision_id,
        d.candidate_id,
        d.target_observation_id,
        f field_name,
        to_jsonb(o)->f current_value,
        d.candidate_snapshot->f candidate_value
      from public.commercial_offer_reparse_candidate_decisions d
      join public.commercial_observations o
        on o.organization_id=d.organization_id
       and o.id=d.target_observation_id
       and o.thread_id=d.thread_id
      cross join lateral unnest(allowed_fields) f
      where d.organization_id=p_organization_id
        and d.run_id=r.id
        and d.decision='adopted'
        and not (f=any(d.selected_fields))
        and d.candidate_snapshot ? f
        and d.candidate_snapshot->f is not null
        and d.candidate_snapshot->f <> 'null'::jsonb
        and to_jsonb(o)->f is not null
        and to_jsonb(o)->f <> 'null'::jsonb
        and to_jsonb(o)->f is distinct from d.candidate_snapshot->f
    ) x;

    conflict_count := jsonb_array_length(conflict_snapshot);
  end if;

  if q.status <> 'pending' then
    closure_status := 'already_closed';
  elsif r.id is null then
    closure_status := 'run_missing';
  elsif r.status <> 'completed' then
    closure_status := 'run_'||r.status;
  elsif candidate_count=0 then
    closure_status := 'ready_dismiss_no_candidates';
    recommended_outcome := 'dismissed';
    resolution_reason := 'no_candidates_from_reparse';
  elsif pending_count>0 then
    closure_status := 'candidates_pending';
  elsif decision_count<>candidate_count
        or accepted_count+rejected_count<>candidate_count then
    closure_status := 'decisions_incomplete';
  elsif conflict_count>0 then
    closure_status := 'conflict_review_required';
  elsif accepted_count>0
        and quantity_gap_count=0
        and price_gap_count=0
        and currency_gap_count=0 then
    closure_status := 'ready_resolve';
    recommended_outcome := 'resolved';
    resolution_reason := 'recovered_required_evidence';
  elsif accepted_count=0 and rejected_count=candidate_count then
    closure_status := 'ready_dismiss_no_recovery';
    recommended_outcome := 'dismissed';
    resolution_reason := 'all_candidates_rejected';
  elsif quantity_gap_count>0
        or price_gap_count>0
        or currency_gap_count>0 then
    closure_status := 'residual_evidence_gap';
  else
    closure_status := 'blocked';
  end if;

  return jsonb_build_object(
    'remediation_queue_id',q.id,
    'thread_id',q.thread_id,
    'subject',thread_subject,
    'remediation_status',q.status,
    'run_id',r.id,
    'run_status',r.status,
    'candidate_count',candidate_count,
    'pending_candidate_count',pending_count,
    'accepted_count',accepted_count,
    'rejected_count',rejected_count,
    'decision_count',decision_count,
    'residual_gaps',jsonb_build_object(
      'quantity',quantity_gap_count,
      'price',price_gap_count,
      'currency',currency_gap_count
    ),
    'unresolved_conflict_count',conflict_count,
    'unresolved_conflicts',conflict_snapshot,
    'closure_status',closure_status,
    'recommended_outcome',recommended_outcome,
    'resolution_reason',resolution_reason,
    'requires_explicit_close',true,
    'automatic_closure',false
  );
end;
$$;

revoke all on function private.offer_reparse_remediation_closure_state(uuid,bigint)
from public,anon;
grant execute on function private.offer_reparse_remediation_closure_state(uuid,bigint)
to authenticated,service_role;

create or replace function public.p1_offer_reparse_remediation_closure_readiness(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
begin
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with states as (
      select private.offer_reparse_remediation_closure_state(
        p_organization_id,q.id
      ) state
      from public.commercial_offer_remediation_queue q
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
      order by q.id
      limit greatest(1,least(coalesce(p_limit,100),500))
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'remediation_count',(select count(*) from states),
        'ready_resolve',(select count(*) from states where state->>'closure_status'='ready_resolve'),
        'ready_dismiss',(select count(*) from states where state->>'closure_status' in (
          'ready_dismiss_no_candidates','ready_dismiss_no_recovery'
        )),
        'waiting_on_run',(select count(*) from states where state->>'closure_status' in (
          'run_queued','run_processing'
        )),
        'run_failed',(select count(*) from states where state->>'closure_status'='run_failed'),
        'candidate_decisions_pending',(select count(*) from states where state->>'closure_status' in (
          'candidates_pending','decisions_incomplete'
        )),
        'conflict_review_required',(select count(*) from states where state->>'closure_status'='conflict_review_required'),
        'residual_evidence_gap',(select count(*) from states where state->>'closure_status'='residual_evidence_gap'),
        'already_closed',(select count(*) from states where state->>'closure_status'='already_closed')
      ),
      'items',coalesce((
        select jsonb_agg(state order by (state->>'remediation_queue_id')::bigint)
        from states
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'explicit_close_required',true,
        'automatic_closure',false,
        'all_candidates_terminal_required',true,
        'resolved_requires_recovered_required_evidence',true,
        'dismissal_requires_explicit_note',true,
        'non_null_conflicts_block_resolution',true,
        'failed_run_does_not_close_remediation',true,
        'observation_mutation',false,
        'promotion_mutation',false
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_reparse_remediation_closure_readiness(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_reparse_remediation_closure_readiness(uuid,integer)
to authenticated,service_role;

create or replace function private.close_offer_reparse_remediation_impl(
  p_organization_id uuid,
  p_remediation_queue_id bigint,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid := (select auth.uid());
  q public.commercial_offer_remediation_queue%rowtype;
  existing public.commercial_offer_reparse_remediation_closure_events%rowtype;
  state jsonb;
  closure_status text;
  outcome text;
  reason text;
  event_id bigint;
  note_value text := left(nullif(btrim(coalesce(p_note,'')),''),2000);
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;
  if p_remediation_queue_id is null or p_remediation_queue_id<=0 then
    raise exception 'valid remediation queue id required' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'offer-reparse-close:'||p_organization_id::text||':'||p_remediation_queue_id::text,0));

  select * into q
  from public.commercial_offer_remediation_queue
  where id=p_remediation_queue_id
    and organization_id=p_organization_id
    and category='source_reparse_required'
    and recommended_action='source_email_reparse'
  for update;

  if not found then
    return jsonb_build_object('status','blocked','reason','remediation_not_found');
  end if;

  select * into existing
  from public.commercial_offer_reparse_remediation_closure_events
  where organization_id=p_organization_id
    and remediation_queue_id=q.id;

  if found then
    return jsonb_build_object(
      'status','already_closed',
      'closure_event_id',existing.id,
      'outcome',existing.outcome,
      'resolution_reason',existing.resolution_reason,
      'remediation_queue_id',q.id
    );
  end if;

  state := private.offer_reparse_remediation_closure_state(
    p_organization_id,q.id
  );
  closure_status := state->>'closure_status';
  outcome := state->>'recommended_outcome';
  reason := state->>'resolution_reason';

  if closure_status not in (
    'ready_resolve',
    'ready_dismiss_no_candidates',
    'ready_dismiss_no_recovery'
  ) then
    return jsonb_build_object(
      'status','blocked',
      'reason',closure_status,
      'remediation_queue_id',q.id,
      'closure_state',state
    );
  end if;

  if outcome='dismissed' and note_value is null then
    return jsonb_build_object(
      'status','blocked',
      'reason','dismissal_note_required',
      'remediation_queue_id',q.id,
      'closure_state',state
    );
  end if;

  insert into public.commercial_offer_reparse_remediation_closure_events(
    organization_id,remediation_queue_id,run_id,thread_id,
    outcome,resolution_reason,candidate_count,accepted_count,rejected_count,
    decision_count,residual_gap_snapshot,conflict_snapshot,closure_snapshot,
    closed_by,note
  ) values (
    p_organization_id,
    q.id,
    (state->>'run_id')::bigint,
    q.thread_id,
    outcome,
    reason,
    coalesce((state->>'candidate_count')::int,0),
    coalesce((state->>'accepted_count')::int,0),
    coalesce((state->>'rejected_count')::int,0),
    coalesce((state->>'decision_count')::int,0),
    coalesce(state->'residual_gaps','{}'::jsonb),
    coalesce(state->'unresolved_conflicts','[]'::jsonb),
    state,
    actor_id,
    note_value
  )
  returning id into event_id;

  update public.commercial_offer_remediation_queue
  set
    status=outcome,
    resolved_by=actor_id,
    resolved_at=now(),
    resolution_notes=case
      when note_value is not null then note_value
      else 'PA2.30 controlled closure: recovered required source evidence.'
    end
  where id=q.id;

  return jsonb_build_object(
    'status',outcome,
    'resolution_reason',reason,
    'closure_event_id',event_id,
    'remediation_queue_id',q.id,
    'thread_id',q.thread_id,
    'observation_mutation',false,
    'promotion_mutation',false,
    'automatic_closure',false,
    'control_phase','PA2.30'
  );
end;
$$;

revoke all on function private.close_offer_reparse_remediation_impl(uuid,bigint,text)
from public,anon;
grant execute on function private.close_offer_reparse_remediation_impl(uuid,bigint,text)
to authenticated,service_role;

create or replace function public.p1_close_offer_reparse_remediation(
  p_organization_id uuid,
  p_remediation_queue_id bigint,
  p_note text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.close_offer_reparse_remediation_impl(
    p_organization_id,p_remediation_queue_id,p_note
  );
$$;

revoke all on function public.p1_close_offer_reparse_remediation(uuid,bigint,text)
from public,anon;
grant execute on function public.p1_close_offer_reparse_remediation(uuid,bigint,text)
to authenticated,service_role;
