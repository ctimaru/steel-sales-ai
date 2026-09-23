-- PA2.30.5 — Controlled Recovery Execution & Candidate Re-entry Audit.
-- Read-only audit gate for source-reingest successors. A candidate may re-enter
-- review only after a consumed re-ingest created a completed successor with a
-- valid thread binding and no successor invalidation.

create or replace function public.p1_offer_recovery_candidate_reentry_audit(
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
        t.source_conversation_id,
        (
          select r0.id
          from public.commercial_offer_reparse_runs r0
          join public.commercial_offer_reparse_run_invalidations i0
            on i0.organization_id=r0.organization_id and i0.run_id=r0.id
          where r0.organization_id=q.organization_id
            and r0.remediation_queue_id=q.id
          order by r0.id desc
          limit 1
        ) invalidated_predecessor_run_id,
        (
          select s0.id
          from public.commercial_offer_source_reingests s0
          where s0.organization_id=q.organization_id
            and s0.remediation_queue_id=q.id
          order by s0.id desc
          limit 1
        ) latest_reingest_id,
        coalesce((
          select jsonb_agg(distinct o.source_filename order by o.source_filename)
            filter(where o.source_filename is not null and o.item_role='offered')
          from public.commercial_observations o
          where o.organization_id=q.organization_id
            and o.thread_id=q.thread_id
        ),'[]'::jsonb) offered_source_filenames
      from public.commercial_offer_remediation_queue q
      join public.commercial_threads t
        on t.organization_id=q.organization_id and t.id=q.thread_id
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
      order by q.id
      limit greatest(1,least(coalesce(p_limit,100),500))
    ),
    enriched as (
      select
        x.*,
        s.status reingest_status,
        s.requested_from_run_id,
        s.source_job_id reingest_source_job_id,
        s.successor_run_id,
        s.selected_source_filename,
        s.source_selection_mode,
        s.requested_at,
        s.completed_at reingest_completed_at,
        r.status successor_status,
        r.source_job_id successor_source_job_id,
        r.source_snapshot successor_source_snapshot,
        r.supersedes_run_id,
        private.offer_reparse_source_binding_state(
          p_organization_id,
          r.id
        ) successor_binding,
        i.id successor_invalidation_id,
        i.reason successor_invalidation_reason,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.id
        ),0) candidate_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.id
            and c.item_role='offered'
        ),0) offered_candidate_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidates c
          where c.organization_id=p_organization_id
            and c.run_id=r.id
            and c.review_status='pending_review'
        ),0) pending_review_count,
        coalesce((
          select count(*)::int
          from public.commercial_offer_reparse_candidate_decisions d
          where d.organization_id=p_organization_id
            and d.run_id=r.id
        ),0) decision_count
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
    classified as (
      select
        e.*,
        case
          when e.remediation_status<>'pending' then 'remediation_closed'
          when e.latest_reingest_id is null
               and jsonb_array_length(e.offered_source_filenames)>1
            then 'ambiguous_selection_required'
          when e.latest_reingest_id is null
            then 'reingest_not_started'
          when e.reingest_status='requested'
            then 'reingest_requested'
          when e.reingest_status='uploading'
            then 'reingest_uploading'
          when e.reingest_status='failed'
            then 'reingest_failed'
          when e.reingest_status='consumed' and e.successor_run_id is null
            then 'successor_missing'
          when e.successor_invalidation_id is not null
            then 'successor_provenance_invalid'
          when e.supersedes_run_id is distinct from e.requested_from_run_id
            then 'successor_chain_mismatch'
          when e.successor_source_job_id is distinct from e.reingest_source_job_id
            then 'successor_source_job_mismatch'
          when coalesce(e.successor_binding->>'binding_status','') not in (
            'valid_direct_thread','valid_source_thread'
          ) then 'successor_binding_invalid'
          when e.successor_status='queued'
            then 'successor_queued'
          when e.successor_status='processing'
            then 'successor_processing'
          when e.successor_status='failed'
            then 'successor_failed'
          when e.successor_status<>'completed'
            then 'successor_not_completed'
          when e.candidate_count=0
            then 'completed_no_candidates'
          when e.pending_review_count>0
            then 'candidate_review_ready'
          when e.decision_count=e.candidate_count
            then 'candidate_review_terminal'
          else 'candidate_review_incomplete'
        end reentry_status
      from enriched e
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'target_threads',(select count(*) from classified),
        'reingest_not_started',(select count(*) from classified where reentry_status='reingest_not_started'),
        'ambiguous_selection_required',(select count(*) from classified where reentry_status='ambiguous_selection_required'),
        'reingest_in_progress',(select count(*) from classified where reentry_status in ('reingest_requested','reingest_uploading')),
        'recovery_failed',(select count(*) from classified where reentry_status in (
          'reingest_failed','successor_missing','successor_provenance_invalid',
          'successor_chain_mismatch','successor_source_job_mismatch',
          'successor_binding_invalid','successor_failed','successor_not_completed'
        )),
        'successor_in_progress',(select count(*) from classified where reentry_status in ('successor_queued','successor_processing')),
        'completed_no_candidates',(select count(*) from classified where reentry_status='completed_no_candidates'),
        'candidate_review_ready',(select count(*) from classified where reentry_status='candidate_review_ready'),
        'candidate_review_terminal',(select count(*) from classified where reentry_status='candidate_review_terminal'),
        'candidate_review_incomplete',(select count(*) from classified where reentry_status='candidate_review_incomplete'),
        'total_successor_candidates',(select coalesce(sum(candidate_count),0) from classified),
        'total_pending_review_candidates',(select coalesce(sum(pending_review_count),0) from classified)
      ),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'remediation_queue_id',c.remediation_queue_id,
          'thread_id',c.thread_id,
          'subject',c.subject,
          'remediation_status',c.remediation_status,
          'invalidated_predecessor_run_id',c.invalidated_predecessor_run_id,
          'reingest_id',c.latest_reingest_id,
          'reingest_status',c.reingest_status,
          'requested_from_run_id',c.requested_from_run_id,
          'selected_source_filename',c.selected_source_filename,
          'source_selection_mode',c.source_selection_mode,
          'offered_source_filenames',c.offered_source_filenames,
          'successor_run_id',c.successor_run_id,
          'successor_status',c.successor_status,
          'successor_source_job_id',c.successor_source_job_id,
          'successor_binding_status',c.successor_binding->>'binding_status',
          'successor_binding',c.successor_binding,
          'successor_invalidation_id',c.successor_invalidation_id,
          'successor_invalidation_reason',c.successor_invalidation_reason,
          'candidate_count',c.candidate_count,
          'offered_candidate_count',c.offered_candidate_count,
          'pending_review_count',c.pending_review_count,
          'decision_count',c.decision_count,
          'reentry_status',c.reentry_status
        ) order by c.remediation_queue_id)
        from classified c
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'reentry_requires_consumed_reingest',true,
        'reentry_requires_completed_successor',true,
        'reentry_requires_valid_thread_binding',true,
        'reentry_requires_successor_chain_match',true,
        'reentry_requires_source_job_match',true,
        'invalidated_successor_review_allowed',false,
        'invalidated_predecessor_candidates_remain_quarantined',true,
        'automatic_candidate_adoption',false,
        'automatic_remediation_closure',false,
        'observation_mutation',false,
        'promotion_mutation',false,
        'control_phase','PA2.30.5'
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_recovery_candidate_reentry_audit(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_recovery_candidate_reentry_audit(uuid,integer)
to authenticated,service_role;
