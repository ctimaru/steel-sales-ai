-- PA2.30.15 — Residual Evidence Gap Reconciliation & Remediation Finalization Readiness.
-- Reconciles per-observation completeness gaps with source-level evidence after a valid
-- recovery/adoption cycle. Price/currency are not required when the recovered source
-- contains no explicit price marker. Finalization remains explicit and audited.

alter table public.commercial_offer_reparse_remediation_closure_events
  drop constraint if exists commercial_offer_reparse_remediation_cl_resolution_reason_check;

alter table public.commercial_offer_reparse_remediation_closure_events
  add constraint commercial_offer_reparse_remediation_cl_resolution_reason_check
  check (resolution_reason in (
    'recovered_required_evidence',
    'no_candidates_from_reparse',
    'all_candidates_rejected',
    'recovery_completed_no_offered_candidates',
    'all_offered_candidates_rejected',
    'source_evidence_reconciled_no_price_present'
  ));

alter table public.commercial_offer_reparse_remediation_closure_events
  drop constraint if exists commercial_offer_reparse_remediation_closure_shape_check;

alter table public.commercial_offer_reparse_remediation_closure_events
  add constraint commercial_offer_reparse_remediation_closure_shape_check
  check (
    (
      outcome='resolved'
      and resolution_reason in (
        'recovered_required_evidence',
        'source_evidence_reconciled_no_price_present'
      )
      and accepted_count>0
    )
    or (
      outcome='dismissed'
      and resolution_reason in (
        'no_candidates_from_reparse',
        'all_candidates_rejected',
        'recovery_completed_no_offered_candidates',
        'all_offered_candidates_rejected'
      )
    )
  );

alter function private.offer_reparse_remediation_closure_state(uuid,bigint)
rename to offer_reparse_remediation_closure_state_pa23015_base;

revoke all on function private.offer_reparse_remediation_closure_state_pa23015_base(uuid,bigint)
from public,anon,authenticated;
grant execute on function private.offer_reparse_remediation_closure_state_pa23015_base(uuid,bigint)
to service_role;

create or replace function private.offer_recovery_residual_gap_reconciliation_state(
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
  actor_id uuid := (select auth.uid());
  base_state jsonb;
  q public.commercial_offer_remediation_queue%rowtype;
  r public.commercial_offer_reparse_runs%rowtype;
  offered_candidate_count integer := 0;
  pending_offered_count integer := 0;
  accepted_offered_count integer := 0;
  rejected_offered_count integer := 0;
  decision_count integer := 0;
  quantity_evidence_count integer := 0;
  price_evidence_count integer := 0;
  currency_evidence_count integer := 0;
  source_price_marker_count integer := 0;
  source_quantity_marker_count integer := 0;
  source_price_marker_samples jsonb := '[]'::jsonb;
  source_quantity_marker_samples jsonb := '[]'::jsonb;
  effective_quantity_status text;
  effective_price_status text;
  effective_currency_status text;
  finalization_status text;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if p_organization_id is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  select * into q
  from public.commercial_offer_remediation_queue
  where organization_id=p_organization_id
    and id=p_remediation_queue_id
    and category='source_reparse_required'
    and recommended_action='source_email_reparse';

  if not found then
    return jsonb_build_object(
      'status','blocked',
      'reason','remediation_not_found',
      'remediation_queue_id',p_remediation_queue_id,
      'control_phase','PA2.30.15'
    );
  end if;

  base_state := private.offer_reparse_remediation_closure_state_pa23015_base(
    p_organization_id,p_remediation_queue_id
  );

  if q.status<>'pending' then
    return jsonb_build_object(
      'status','already_closed',
      'reason','remediation_not_pending',
      'remediation_queue_id',q.id,
      'base_closure_status',base_state->>'closure_status',
      'control_phase','PA2.30.15'
    );
  end if;

  if base_state->>'recovery_closure_handoff' is distinct from 'PA2.30.9'
     or base_state->>'run_status' is distinct from 'completed' then
    return jsonb_build_object(
      'status','blocked',
      'reason','valid_completed_recovery_required',
      'remediation_queue_id',q.id,
      'base_closure_status',base_state->>'closure_status',
      'control_phase','PA2.30.15'
    );
  end if;

  select *
  into r
  from public.commercial_offer_reparse_runs
  where organization_id=p_organization_id
    and id=(base_state->>'run_id')::bigint;

  select
    count(*)::int,
    count(*) filter(where c.review_status='pending_review')::int,
    count(*) filter(where c.review_status='accepted')::int,
    count(*) filter(where c.review_status='rejected')::int
  into
    offered_candidate_count,
    pending_offered_count,
    accepted_offered_count,
    rejected_offered_count
  from public.commercial_offer_reparse_candidates c
  where c.organization_id=p_organization_id
    and c.run_id=r.id
    and c.item_role='offered';

  select count(*)::int
  into decision_count
  from public.commercial_offer_reparse_candidate_decisions d
  join public.commercial_offer_reparse_candidates c
    on c.organization_id=d.organization_id
   and c.id=d.candidate_id
   and c.run_id=d.run_id
  where d.organization_id=p_organization_id
    and d.run_id=r.id
    and c.item_role='offered';

  select
    count(*) filter(
      where o.quantity is not null and o.quantity_unit is not null
    )::int,
    count(*) filter(
      where o.price_value is not null and o.price_unit is not null
    )::int,
    count(*) filter(
      where o.currency is not null
    )::int
  into
    quantity_evidence_count,
    price_evidence_count,
    currency_evidence_count
  from public.commercial_observations o
  where o.organization_id=p_organization_id
    and o.thread_id=q.thread_id
    and o.item_role='offered';

  with source_fragments as (
    select
      o.id::text source_id,
      coalesce(o.source_text,'') || ' ' || coalesce(o.source_clause,'') source_text
    from public.commercial_observations o
    where o.organization_id=p_organization_id
      and o.thread_id=q.thread_id
      and o.item_role='offered'
    union all
    select
      'candidate:'||c.id::text,
      coalesce(c.source_text,'')
    from public.commercial_offer_reparse_candidates c
    where c.organization_id=p_organization_id
      and c.run_id=r.id
      and c.item_role='offered'
  ),
  classified as (
    select
      source_id,
      source_text,
      (
        source_text ~* '(€|\beur\b|\beuro\b|\bprezzo\b|\bprice\b|\bquotazione\b)'
        or source_text ~* '[0-9]+([\.,][0-9]+)?[[:space:]]*/[[:space:]]*(mt|m|t|ton|kg)\b'
      ) price_marker,
      (
        source_text ~* '(\bton\.?\b|\btons?\b|\bbarre?\b|\bverghe?\b|\bpacch[io]\b|\bmt\.?\b|\bmetri\b)'
      ) quantity_marker
    from source_fragments
    where nullif(btrim(source_text),'') is not null
  )
  select
    count(*) filter(where price_marker)::int,
    count(*) filter(where quantity_marker)::int,
    coalesce(jsonb_agg(
      jsonb_build_object('source_id',source_id,'source_text',source_text)
      order by source_id
    ) filter(where price_marker),'[]'::jsonb),
    coalesce(jsonb_agg(
      jsonb_build_object('source_id',source_id,'source_text',source_text)
      order by source_id
    ) filter(where quantity_marker),'[]'::jsonb)
  into
    source_price_marker_count,
    source_quantity_marker_count,
    source_price_marker_samples,
    source_quantity_marker_samples
  from classified;

  effective_quantity_status := case
    when quantity_evidence_count>0 then 'satisfied'
    when source_quantity_marker_count>0 then 'required_missing'
    else 'absent_from_source'
  end;

  effective_price_status := case
    when price_evidence_count>0 then 'satisfied'
    when source_price_marker_count>0 then 'required_missing'
    else 'not_applicable_absent_from_source'
  end;

  effective_currency_status := case
    when currency_evidence_count>0 then 'satisfied'
    when source_price_marker_count>0 then 'required_missing'
    else 'not_applicable_absent_from_source'
  end;

  if offered_candidate_count=0 then
    finalization_status := 'blocked_no_offered_candidate';
  elsif pending_offered_count>0 then
    finalization_status := 'blocked_candidate_decision_pending';
  elsif accepted_offered_count=0 then
    finalization_status := 'blocked_no_accepted_offered_candidate';
  elsif decision_count<>offered_candidate_count then
    finalization_status := 'blocked_decision_ledger_incomplete';
  elsif coalesce((base_state->>'unresolved_conflict_count')::int,0)>0 then
    finalization_status := 'blocked_conflict_review_required';
  elsif effective_quantity_status<>'satisfied' then
    finalization_status := 'blocked_quantity_evidence_missing';
  elsif effective_price_status='required_missing'
        or effective_currency_status='required_missing' then
    finalization_status := 'blocked_explicit_price_evidence_missing';
  elsif effective_price_status='not_applicable_absent_from_source'
        and effective_currency_status='not_applicable_absent_from_source' then
    finalization_status := 'ready_finalize_no_price_present';
  else
    finalization_status := 'ready_finalize_recovered_evidence';
  end if;

  return jsonb_build_object(
    'status',finalization_status,
    'remediation_queue_id',q.id,
    'thread_id',q.thread_id,
    'run_id',r.id,
    'offered_candidate_count',offered_candidate_count,
    'pending_offered_candidate_count',pending_offered_count,
    'accepted_offered_candidate_count',accepted_offered_count,
    'rejected_offered_candidate_count',rejected_offered_count,
    'decision_count',decision_count,
    'thread_evidence',jsonb_build_object(
      'quantity_evidence_count',quantity_evidence_count,
      'price_evidence_count',price_evidence_count,
      'currency_evidence_count',currency_evidence_count,
      'source_quantity_marker_count',source_quantity_marker_count,
      'source_price_marker_count',source_price_marker_count,
      'quantity_status',effective_quantity_status,
      'price_status',effective_price_status,
      'currency_status',effective_currency_status,
      'price_marker_samples',source_price_marker_samples,
      'quantity_marker_samples',source_quantity_marker_samples
    ),
    'raw_observation_gap_snapshot',base_state->'residual_gaps',
    'source_exhaustion_confirmed',true,
    'per_observation_completeness_not_required_for_finalization',true,
    'explicit_finalization_required',true,
    'finalization_note_required',true,
    'automatic_observation_fill',false,
    'automatic_remediation_closure',false,
    'control_phase','PA2.30.15'
  );
end;
$$;

revoke all on function private.offer_recovery_residual_gap_reconciliation_state(uuid,bigint)
from public,anon;
grant execute on function private.offer_recovery_residual_gap_reconciliation_state(uuid,bigint)
to authenticated,service_role;

create or replace function public.p1_offer_recovery_residual_gap_reconciliation_readiness(
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
      select private.offer_recovery_residual_gap_reconciliation_state(
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
        'ready_finalize_no_price_present',(
          select count(*) from states
          where state->>'status'='ready_finalize_no_price_present'
        ),
        'ready_finalize_recovered_evidence',(
          select count(*) from states
          where state->>'status'='ready_finalize_recovered_evidence'
        ),
        'blocked',(
          select count(*) from states
          where state->>'status' like 'blocked_%'
        ),
        'already_closed',(
          select count(*) from states
          where state->>'status'='already_closed'
        )
      ),
      'items',coalesce((
        select jsonb_agg(state order by (state->>'remediation_queue_id')::bigint)
        from states
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'thread_level_evidence_reconciliation',true,
        'per_observation_completeness_not_required',true,
        'price_required_only_when_source_marker_present',true,
        'currency_required_only_when_price_source_marker_present',true,
        'quantity_required_when_source_quantity_evidence_present',true,
        'accepted_offer_candidate_required',true,
        'explicit_finalization_required',true,
        'finalization_note_required',true,
        'automatic_observation_fill',false,
        'automatic_remediation_closure',false,
        'control_phase','PA2.30.15'
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_recovery_residual_gap_reconciliation_readiness(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_recovery_residual_gap_reconciliation_readiness(uuid,integer)
to authenticated,service_role;

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
  base_state jsonb;
  reconciliation jsonb;
begin
  base_state := private.offer_reparse_remediation_closure_state_pa23015_base(
    p_organization_id,p_remediation_queue_id
  );

  if base_state->>'closure_status'<>'residual_evidence_gap'
     or base_state->>'remediation_status'<>'pending' then
    return base_state;
  end if;

  reconciliation := private.offer_recovery_residual_gap_reconciliation_state(
    p_organization_id,p_remediation_queue_id
  );

  if reconciliation->>'status'='ready_finalize_no_price_present' then
    return base_state || jsonb_build_object(
      'closure_status','ready_resolve',
      'disposition_status','ready_resolve',
      'recommended_outcome','resolved',
      'resolution_reason','source_evidence_reconciled_no_price_present',
      'requires_explicit_close',true,
      'automatic_closure',false,
      'residual_gap_reconciliation',reconciliation,
      'reconciliation_control_phase','PA2.30.15'
    );
  end if;

  return base_state || jsonb_build_object(
    'residual_gap_reconciliation',reconciliation,
    'reconciliation_control_phase','PA2.30.15'
  );
end;
$$;

revoke all on function private.offer_reparse_remediation_closure_state(uuid,bigint)
from public,anon;
grant execute on function private.offer_reparse_remediation_closure_state(uuid,bigint)
to authenticated,service_role;

alter function private.close_offer_reparse_remediation_impl(uuid,bigint,text)
rename to close_offer_reparse_remediation_impl_pa23015_base;

revoke all on function private.close_offer_reparse_remediation_impl_pa23015_base(uuid,bigint,text)
from public,anon,authenticated;
grant execute on function private.close_offer_reparse_remediation_impl_pa23015_base(uuid,bigint,text)
to service_role;

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
  state jsonb;
  note_value text := left(nullif(btrim(coalesce(p_note,'')),''),2000);
  q public.commercial_offer_remediation_queue%rowtype;
  existing public.commercial_offer_reparse_remediation_closure_events%rowtype;
  event_id bigint;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;

  state := private.offer_reparse_remediation_closure_state(
    p_organization_id,p_remediation_queue_id
  );

  if state->>'resolution_reason'<>'source_evidence_reconciled_no_price_present' then
    return private.close_offer_reparse_remediation_impl_pa23015_base(
      p_organization_id,p_remediation_queue_id,p_note
    );
  end if;

  if note_value is null then
    return jsonb_build_object(
      'status','blocked',
      'reason','reconciliation_note_required',
      'remediation_queue_id',p_remediation_queue_id,
      'closure_state',state
    );
  end if;

  if state->>'closure_status'<>'ready_resolve'
     or state->>'recommended_outcome'<>'resolved' then
    return jsonb_build_object(
      'status','blocked',
      'reason',coalesce(state->>'closure_status','not_ready'),
      'remediation_queue_id',p_remediation_queue_id,
      'closure_state',state
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'offer-reparse-close:'||p_organization_id::text||':'||p_remediation_queue_id::text,0
  ));

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

  -- Re-evaluate after locking to prevent stale finalization.
  state := private.offer_reparse_remediation_closure_state(
    p_organization_id,p_remediation_queue_id
  );

  if state->>'closure_status'<>'ready_resolve'
     or state->>'recommended_outcome'<>'resolved'
     or state->>'resolution_reason'<>'source_evidence_reconciled_no_price_present' then
    return jsonb_build_object(
      'status','blocked',
      'reason','reconciliation_state_changed',
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
    'resolved',
    'source_evidence_reconciled_no_price_present',
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
    status='resolved',
    resolved_by=actor_id,
    resolved_at=now(),
    resolution_notes=note_value
  where id=q.id;

  return jsonb_build_object(
    'status','resolved',
    'resolution_reason','source_evidence_reconciled_no_price_present',
    'closure_event_id',event_id,
    'remediation_queue_id',q.id,
    'thread_id',q.thread_id,
    'residual_gap_reconciliation',state->'residual_gap_reconciliation',
    'observation_mutation',false,
    'promotion_mutation',false,
    'automatic_closure',false,
    'control_phase','PA2.30.15'
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
