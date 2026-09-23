-- PA2.30.6 — Recovery Outcome Reconciliation.
-- Descriptive-only reconciliation of the original remediation evidence gaps against
-- evidence types present in valid successor candidates. This function never claims
-- that a gap is resolved, because candidate -> observation matching remains explicit.

create or replace function public.p1_offer_recovery_outcome_reconciliation(
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
    with target as (
      select
        q.id remediation_queue_id,
        q.thread_id,
        q.status remediation_status,
        t.subject,
        q.evidence_snapshot,
        coalesce((q.evidence_snapshot->>'price_gap_count')::int,0) price_gap_count,
        coalesce((q.evidence_snapshot->>'currency_gap_count')::int,0) currency_gap_count,
        coalesce((q.evidence_snapshot->>'quantity_gap_count')::int,0) quantity_gap_count,
        (
          select s0.id
          from public.commercial_offer_source_reingests s0
          where s0.organization_id=q.organization_id
            and s0.remediation_queue_id=q.id
          order by s0.id desc
          limit 1
        ) latest_reingest_id
      from public.commercial_offer_remediation_queue q
      join public.commercial_threads t
        on t.organization_id=q.organization_id and t.id=q.thread_id
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
      order by q.id
      limit greatest(1,least(coalesce(p_limit,100),500))
    ),
    recovery as (
      select
        x.*,
        s.status reingest_status,
        s.successor_run_id,
        s.selected_source_filename,
        s.source_selection_mode,
        r.status successor_status,
        i.id successor_invalidation_id,
        private.offer_reparse_source_binding_state(
          p_organization_id,
          r.id
        ) successor_binding
      from target x
      left join public.commercial_offer_source_reingests s
        on s.id=x.latest_reingest_id
       and s.organization_id=p_organization_id
      left join public.commercial_offer_reparse_runs r
        on r.id=s.successor_run_id
       and r.organization_id=p_organization_id
      left join public.commercial_offer_reparse_run_invalidations i
        on i.organization_id=p_organization_id
       and i.run_id=r.id
    ),
    evidence as (
      select
        r.*,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.successor_run_id
        ),0) candidate_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.successor_run_id
            and c.item_role='offered'
        ),0) offered_candidate_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.successor_run_id
            and c.item_role='offered'
            and c.candidate_evidence ? 'price_value'
            and c.candidate_evidence->'price_value' is not null
            and c.candidate_evidence->'price_value'<>'null'::jsonb
        ),0) price_signal_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.successor_run_id
            and c.item_role='offered'
            and c.candidate_evidence ? 'currency'
            and c.candidate_evidence->'currency' is not null
            and c.candidate_evidence->'currency'<>'null'::jsonb
        ),0) currency_signal_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.successor_run_id
            and c.item_role='offered'
            and c.candidate_evidence ? 'quantity'
            and c.candidate_evidence->'quantity' is not null
            and c.candidate_evidence->'quantity'<>'null'::jsonb
        ),0) quantity_signal_count
      from recovery r
    ),
    reconciled as (
      select
        e.*,
        (e.price_gap_count>0) requires_price,
        (e.currency_gap_count>0) requires_currency,
        (e.quantity_gap_count>0) requires_quantity,
        (e.price_gap_count>0 and e.price_signal_count>0) price_signal_recovered,
        (e.currency_gap_count>0 and e.currency_signal_count>0) currency_signal_recovered,
        (e.quantity_gap_count>0 and e.quantity_signal_count>0) quantity_signal_recovered,
        (
          (case when e.price_gap_count>0 then 1 else 0 end) +
          (case when e.currency_gap_count>0 then 1 else 0 end) +
          (case when e.quantity_gap_count>0 then 1 else 0 end)
        ) required_evidence_type_count,
        (
          (case when e.price_gap_count>0 and e.price_signal_count>0 then 1 else 0 end) +
          (case when e.currency_gap_count>0 and e.currency_signal_count>0 then 1 else 0 end) +
          (case when e.quantity_gap_count>0 and e.quantity_signal_count>0 then 1 else 0 end)
        ) recovered_evidence_type_count
      from evidence e
    ),
    classified as (
      select
        r.*,
        case
          when r.remediation_status<>'pending' then 'remediation_closed'
          when r.latest_reingest_id is null then 'recovery_not_started'
          when r.reingest_status in ('requested','uploading') then 'recovery_in_progress'
          when r.reingest_status='failed' then 'recovery_failed'
          when r.successor_run_id is null then 'successor_missing'
          when r.successor_invalidation_id is not null then 'successor_provenance_invalid'
          when coalesce(r.successor_binding->>'binding_status','') not in (
            'valid_direct_thread','valid_source_thread'
          ) then 'successor_binding_invalid'
          when r.successor_status in ('queued','processing') then 'successor_in_progress'
          when r.successor_status='failed' then 'successor_failed'
          when r.successor_status<>'completed' then 'successor_not_completed'
          when r.candidate_count=0 then 'completed_no_candidates'
          when r.offered_candidate_count=0 then 'completed_no_offered_candidates'
          when r.recovered_evidence_type_count=0 then 'no_required_evidence_recovered'
          when r.recovered_evidence_type_count<r.required_evidence_type_count
            then 'partial_required_evidence_recovered'
          when r.required_evidence_type_count>0
            and r.recovered_evidence_type_count=r.required_evidence_type_count
            then 'all_required_evidence_types_present'
          else 'completed_candidates_present'
        end reconciliation_status
      from reconciled r
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'target_threads',(select count(*) from classified),
        'recovery_not_started',(select count(*) from classified where reconciliation_status='recovery_not_started'),
        'recovery_in_progress',(select count(*) from classified where reconciliation_status in ('recovery_in_progress','successor_in_progress')),
        'recovery_failed',(select count(*) from classified where reconciliation_status in (
          'recovery_failed','successor_missing','successor_provenance_invalid',
          'successor_binding_invalid','successor_failed','successor_not_completed'
        )),
        'completed_no_candidates',(select count(*) from classified where reconciliation_status='completed_no_candidates'),
        'completed_no_offered_candidates',(select count(*) from classified where reconciliation_status='completed_no_offered_candidates'),
        'no_required_evidence_recovered',(select count(*) from classified where reconciliation_status='no_required_evidence_recovered'),
        'partial_required_evidence_recovered',(select count(*) from classified where reconciliation_status='partial_required_evidence_recovered'),
        'all_required_evidence_types_present',(select count(*) from classified where reconciliation_status='all_required_evidence_types_present'),
        'total_successor_candidates',(select coalesce(sum(candidate_count),0) from classified),
        'total_offered_successor_candidates',(select coalesce(sum(offered_candidate_count),0) from classified)
      ),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'remediation_queue_id',c.remediation_queue_id,
          'thread_id',c.thread_id,
          'subject',c.subject,
          'remediation_status',c.remediation_status,
          'reingest_id',c.latest_reingest_id,
          'reingest_status',c.reingest_status,
          'selected_source_filename',c.selected_source_filename,
          'source_selection_mode',c.source_selection_mode,
          'successor_run_id',c.successor_run_id,
          'successor_status',c.successor_status,
          'successor_binding_status',c.successor_binding->>'binding_status',
          'successor_invalidation_id',c.successor_invalidation_id,
          'candidate_count',c.candidate_count,
          'offered_candidate_count',c.offered_candidate_count,
          'original_gap_counts',jsonb_build_object(
            'price',c.price_gap_count,
            'currency',c.currency_gap_count,
            'quantity',c.quantity_gap_count
          ),
          'recovered_signal_counts',jsonb_build_object(
            'price',c.price_signal_count,
            'currency',c.currency_signal_count,
            'quantity',c.quantity_signal_count
          ),
          'required_evidence_types',jsonb_build_object(
            'price',c.requires_price,
            'currency',c.requires_currency,
            'quantity',c.requires_quantity
          ),
          'recovered_evidence_types',jsonb_build_object(
            'price',c.price_signal_recovered,
            'currency',c.currency_signal_recovered,
            'quantity',c.quantity_signal_recovered
          ),
          'required_evidence_type_count',c.required_evidence_type_count,
          'recovered_evidence_type_count',c.recovered_evidence_type_count,
          'reconciliation_status',c.reconciliation_status
        ) order by c.remediation_queue_id)
        from classified c
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'evidence_type_presence_is_not_gap_resolution',true,
        'candidate_observation_matching_required_before_resolution',true,
        'offered_candidates_only_for_recovery_signals',true,
        'invalidated_successor_evidence_allowed',false,
        'automatic_candidate_adoption',false,
        'automatic_remediation_closure',false,
        'observation_mutation',false,
        'promotion_mutation',false,
        'control_phase','PA2.30.6'
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_recovery_outcome_reconciliation(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_recovery_outcome_reconciliation(uuid,integer)
to authenticated,service_role;
