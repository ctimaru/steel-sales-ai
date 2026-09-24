-- PA2.30.12 — Recovery Remediation Disposition Cutover.
-- Recovery closure decisions are scoped to offered candidates only.
-- Non-offered recovery candidates remain preserved for their native workflows and
-- never block offer-remediation disposition.

create or replace function private.offer_recovery_remediation_disposition_state(
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
  handoff jsonb;
  q public.commercial_offer_remediation_queue%rowtype;
  r public.commercial_offer_reparse_runs%rowtype;
  thread_subject text;
  offered_candidate_count integer := 0;
  out_of_scope_candidate_count integer := 0;
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
  disposition_status text;
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
     or p_remediation_queue_id<=0 then
    raise exception 'valid organization and remediation queue id required'
      using errcode='22023';
  end if;

  handoff := private.offer_recovery_closure_handoff_state(
    p_organization_id,p_remediation_queue_id
  );

  if handoff->>'status'<>'eligible' then
    return jsonb_build_object(
      'remediation_queue_id',p_remediation_queue_id,
      'disposition_status','recovery_not_ready',
      'closure_status',coalesce(handoff->>'reason',handoff->>'status'),
      'recovery_handoff_status',handoff->>'status',
      'recovery_handoff_reason',handoff->>'reason',
      'requires_explicit_close',false,
      'automatic_closure',false,
      'control_phase','PA2.30.12'
    );
  end if;

  select * into q
  from public.commercial_offer_remediation_queue
  where id=p_remediation_queue_id
    and organization_id=p_organization_id
    and category='source_reparse_required'
    and recommended_action='source_email_reparse';

  if not found then
    return jsonb_build_object(
      'remediation_queue_id',p_remediation_queue_id,
      'disposition_status','recovery_not_ready',
      'closure_status','remediation_not_found',
      'requires_explicit_close',false,
      'automatic_closure',false,
      'control_phase','PA2.30.12'
    );
  end if;

  select * into r
  from public.commercial_offer_reparse_runs
  where organization_id=p_organization_id
    and id=(handoff->>'run_id')::bigint;

  select subject into thread_subject
  from public.commercial_threads
  where organization_id=p_organization_id and id=q.thread_id;

  select
    count(*) filter(where c.item_role='offered')::int,
    count(*) filter(where c.item_role is distinct from 'offered')::int,
    count(*) filter(where c.item_role='offered' and c.review_status='pending_review')::int,
    count(*) filter(where c.item_role='offered' and c.review_status='accepted')::int,
    count(*) filter(where c.item_role='offered' and c.review_status='rejected')::int
  into
    offered_candidate_count,
    out_of_scope_candidate_count,
    pending_count,
    accepted_count,
    rejected_count
  from public.commercial_offer_reparse_candidates c
  where c.organization_id=p_organization_id
    and c.run_id=r.id;

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
    join public.commercial_offer_reparse_candidates c
      on c.organization_id=d.organization_id
     and c.id=d.candidate_id
     and c.run_id=d.run_id
     and c.item_role='offered'
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

  if q.status<>'pending' then
    closure_status := 'already_closed';
    disposition_status := 'already_closed';
  elsif offered_candidate_count=0 then
    closure_status := 'ready_dismiss_no_candidates';
    disposition_status := 'ready_dismiss_no_offered_evidence';
    recommended_outcome := 'dismissed';
    resolution_reason := 'recovery_completed_no_offered_candidates';
  elsif pending_count>0 then
    closure_status := 'candidates_pending';
    disposition_status := 'offer_decision_required';
  elsif decision_count<>offered_candidate_count
        or accepted_count+rejected_count<>offered_candidate_count then
    closure_status := 'decisions_incomplete';
    disposition_status := 'offer_decisions_incomplete';
  elsif conflict_count>0 then
    closure_status := 'conflict_review_required';
    disposition_status := 'conflict_review_required';
  elsif accepted_count>0
        and quantity_gap_count=0
        and price_gap_count=0
        and currency_gap_count=0 then
    closure_status := 'ready_resolve';
    disposition_status := 'ready_resolve';
    recommended_outcome := 'resolved';
    resolution_reason := 'recovered_required_evidence';
  elsif accepted_count=0 and rejected_count=offered_candidate_count then
    closure_status := 'ready_dismiss_no_recovery';
    disposition_status := 'ready_dismiss_no_recovery';
    recommended_outcome := 'dismissed';
    resolution_reason := 'all_offered_candidates_rejected';
  elsif quantity_gap_count>0
        or price_gap_count>0
        or currency_gap_count>0 then
    closure_status := 'residual_evidence_gap';
    disposition_status := 'residual_evidence_gap';
  else
    closure_status := 'blocked';
    disposition_status := 'blocked';
  end if;

  return jsonb_build_object(
    'remediation_queue_id',q.id,
    'thread_id',q.thread_id,
    'subject',thread_subject,
    'remediation_status',q.status,
    'run_id',r.id,
    'run_status',r.status,
    'candidate_count',offered_candidate_count,
    'offered_candidate_count',offered_candidate_count,
    'out_of_scope_candidate_count',out_of_scope_candidate_count,
    'pending_candidate_count',pending_count,
    'accepted_count',accepted_count,
    'rejected_count',rejected_count,
    'decision_count',decision_count,
    'decision_scope_role','offered',
    'out_of_scope_candidates_preserved',true,
    'residual_gaps',jsonb_build_object(
      'quantity',quantity_gap_count,
      'price',price_gap_count,
      'currency',currency_gap_count
    ),
    'unresolved_conflict_count',conflict_count,
    'unresolved_conflicts',conflict_snapshot,
    'disposition_status',disposition_status,
    'closure_status',closure_status,
    'recommended_outcome',recommended_outcome,
    'resolution_reason',resolution_reason,
    'recovery_run_id',r.id,
    'recovery_predecessor_run_id',(handoff->>'predecessor_run_id')::bigint,
    'recovery_reingest_id',(handoff->>'reingest_id')::bigint,
    'recovery_binding_status',handoff->>'binding_status',
    'predecessor_quarantine_preserved',
      coalesce((handoff->>'predecessor_quarantine_preserved')::boolean,false),
    'requires_explicit_close',closure_status in (
      'ready_resolve','ready_dismiss_no_candidates','ready_dismiss_no_recovery'
    ),
    'automatic_closure',false,
    'control_phase','PA2.30.12'
  );
end;
$$;

revoke all on function private.offer_recovery_remediation_disposition_state(uuid,bigint)
from public,anon,authenticated;
grant execute on function private.offer_recovery_remediation_disposition_state(uuid,bigint)
to service_role;

create or replace function public.p1_offer_recovery_remediation_disposition_readiness(
  p_organization_id uuid,
  p_limit integer default 200
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
      select private.offer_recovery_remediation_disposition_state(
        p_organization_id,q.id
      ) state
      from public.commercial_offer_remediation_queue q
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
      order by q.id
      limit greatest(1,least(coalesce(p_limit,200),500))
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'remediation_count',(select count(*) from states),
        'recovery_not_ready',(select count(*) from states where state->>'disposition_status'='recovery_not_ready'),
        'ready_dismiss_no_offered_evidence',(select count(*) from states where state->>'disposition_status'='ready_dismiss_no_offered_evidence'),
        'offer_decision_required',(select count(*) from states where state->>'disposition_status'='offer_decision_required'),
        'offer_decisions_incomplete',(select count(*) from states where state->>'disposition_status'='offer_decisions_incomplete'),
        'ready_resolve',(select count(*) from states where state->>'disposition_status'='ready_resolve'),
        'ready_dismiss_no_recovery',(select count(*) from states where state->>'disposition_status'='ready_dismiss_no_recovery'),
        'residual_evidence_gap',(select count(*) from states where state->>'disposition_status'='residual_evidence_gap'),
        'conflict_review_required',(select count(*) from states where state->>'disposition_status'='conflict_review_required'),
        'already_closed',(select count(*) from states where state->>'disposition_status'='already_closed'),
        'total_offered_candidates',coalesce((select sum((state->>'offered_candidate_count')::int) from states),0),
        'total_preserved_out_of_scope_candidates',coalesce((select sum((state->>'out_of_scope_candidate_count')::int) from states),0)
      ),
      'items',coalesce((
        select jsonb_agg(state order by (state->>'remediation_queue_id')::bigint)
        from states
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'recovery_successor_required',true,
        'decision_scope_role','offered',
        'out_of_scope_candidates_preserved',true,
        'out_of_scope_candidates_do_not_block_offer_disposition',true,
        'no_offered_candidate_recovery_requires_explicit_dismissal',true,
        'dismissal_note_required',true,
        'automatic_candidate_rejection',false,
        'automatic_remediation_closure',false,
        'control_phase','PA2.30.12'
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_recovery_remediation_disposition_readiness(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_recovery_remediation_disposition_readiness(uuid,integer)
to authenticated,service_role;

alter function private.offer_reparse_remediation_closure_state(uuid,bigint)
rename to offer_reparse_remediation_closure_state_pa2309;

revoke all on function private.offer_reparse_remediation_closure_state_pa2309(uuid,bigint)
from public,anon,authenticated;
grant execute on function private.offer_reparse_remediation_closure_state_pa2309(uuid,bigint)
to service_role;

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
  handoff jsonb;
  disposition jsonb;
begin
  handoff := private.offer_recovery_closure_handoff_state(
    p_organization_id,p_remediation_queue_id
  );

  if handoff->>'status'='eligible' then
    disposition := private.offer_recovery_remediation_disposition_state(
      p_organization_id,p_remediation_queue_id
    );
    return disposition || jsonb_build_object(
      'recovery_closure_handoff','PA2.30.9',
      'recovery_disposition_cutover','PA2.30.12',
      'automatic_closure',false
    );
  end if;

  return private.offer_reparse_remediation_closure_state_pa2309(
    p_organization_id,p_remediation_queue_id
  );
end;
$$;

revoke all on function private.offer_reparse_remediation_closure_state(uuid,bigint)
from public,anon;
grant execute on function private.offer_reparse_remediation_closure_state(uuid,bigint)
to authenticated,service_role;
