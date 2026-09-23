-- PA2.30.7 — Candidate-to-Observation Recovery Matching Readiness.
-- Read-only compatibility analysis. Never auto-selects a target observation.

create or replace function public.p1_offer_recovery_matching_readiness(
  p_organization_id uuid,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=''
as $$
declare
  identity_fields constant text[] := array[
    'product_type','grade','standard','material_number',
    'outer_diameter_mm','width_mm','height_mm','thickness_mm','length_mm'
  ];
  commercial_fields constant text[] := array[
    'quantity','quantity_unit','price_value','price_unit','currency',
    'discount_percentage','availability_status'
  ];
begin
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with recovery_candidates as (
      select
        c.id candidate_id,
        c.run_id,
        c.thread_id,
        c.candidate_index,
        c.source_text,
        c.candidate_evidence,
        c.review_status,
        r.status run_status,
        r.supersedes_run_id,
        s.id reingest_id,
        s.status reingest_status,
        i.id successor_invalidation_id,
        private.offer_reparse_source_binding_state(
          p_organization_id,
          r.id
        ) source_binding
      from public.commercial_offer_reparse_candidates c
      join public.commercial_offer_reparse_runs r
        on r.id=c.run_id and r.organization_id=c.organization_id
      join public.commercial_offer_source_reingests s
        on s.organization_id=c.organization_id
       and s.successor_run_id=r.id
      left join public.commercial_offer_reparse_run_invalidations i
        on i.organization_id=c.organization_id
       and i.run_id=r.id
      where c.organization_id=p_organization_id
        and c.item_role='offered'
        and c.review_status='pending_review'
        and r.supersedes_run_id is not null
        and s.status='consumed'
        and r.status='completed'
        and i.id is null
        and coalesce(
          private.offer_reparse_source_binding_state(
            p_organization_id,
            r.id
          )->>'binding_status',''
        ) in ('valid_direct_thread','valid_source_thread')
      order by c.id
      limit greatest(1,least(coalesce(p_limit,200),500))
    ),
    target_rows as (
      select
        c.candidate_id,
        c.run_id,
        c.thread_id,
        c.candidate_index,
        c.source_text candidate_source_text,
        c.candidate_evidence,
        c.review_status,
        c.reingest_id,
        c.source_binding->>'binding_status' source_binding_status,
        o.id observation_id,
        o.source_text observation_source_text,
        (
          select count(*)::int
          from unnest(identity_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and to_jsonb(o)->f is not null
            and to_jsonb(o)->f <> 'null'::jsonb
            and to_jsonb(o)->f = c.candidate_evidence->f
        ) identity_equal_count,
        (
          select count(*)::int
          from unnest(identity_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and to_jsonb(o)->f is not null
            and to_jsonb(o)->f <> 'null'::jsonb
            and to_jsonb(o)->f is distinct from c.candidate_evidence->f
        ) identity_conflict_count,
        (
          select coalesce(jsonb_agg(f order by f),'[]'::jsonb)
          from unnest(identity_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and to_jsonb(o)->f is not null
            and to_jsonb(o)->f <> 'null'::jsonb
            and to_jsonb(o)->f = c.candidate_evidence->f
        ) identity_equal_fields,
        (
          select coalesce(jsonb_agg(f order by f),'[]'::jsonb)
          from unnest(identity_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and to_jsonb(o)->f is not null
            and to_jsonb(o)->f <> 'null'::jsonb
            and to_jsonb(o)->f is distinct from c.candidate_evidence->f
        ) identity_conflicting_fields,
        (
          select coalesce(jsonb_agg(f order by f),'[]'::jsonb)
          from unnest(commercial_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and (to_jsonb(o)->f is null or to_jsonb(o)->f='null'::jsonb)
        ) recoverable_gap_fields,
        (
          select count(*)::int
          from unnest(commercial_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and (to_jsonb(o)->f is null or to_jsonb(o)->f='null'::jsonb)
        ) recoverable_gap_count
      from recovery_candidates c
      join public.commercial_observations o
        on o.organization_id=p_organization_id
       and o.thread_id=c.thread_id
       and o.item_role='offered'
    ),
    candidate_stats as (
      select
        c.*,
        coalesce((
          select count(*)::int
          from public.commercial_observations o
          where o.organization_id=p_organization_id
            and o.thread_id=c.thread_id
            and o.item_role='offered'
        ),0) offered_target_count,
        coalesce((
          select count(*)::int from target_rows t
          where t.candidate_id=c.candidate_id
            and t.identity_conflict_count=0
            and t.identity_equal_count>0
        ),0) anchored_compatible_target_count,
        coalesce((
          select count(*)::int from target_rows t
          where t.candidate_id=c.candidate_id
            and t.identity_conflict_count=0
        ),0) nonconflicting_target_count,
        coalesce((
          select count(*)::int from target_rows t
          where t.candidate_id=c.candidate_id
            and t.recoverable_gap_count>0
        ),0) gap_fill_target_count
      from recovery_candidates c
    ),
    classified as (
      select
        s.*,
        case
          when s.offered_target_count=0 then 'no_offered_target'
          when s.anchored_compatible_target_count=1 then 'single_anchored_compatible_target'
          when s.anchored_compatible_target_count>1 then 'multiple_anchored_compatible_targets'
          when s.anchored_compatible_target_count=0
               and s.nonconflicting_target_count=1
            then 'single_unanchored_nonconflicting_target'
          when s.anchored_compatible_target_count=0
               and s.nonconflicting_target_count>1
            then 'multiple_unanchored_nonconflicting_targets'
          else 'no_compatible_target'
        end matching_status
      from candidate_stats s
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'candidate_count',(select count(*) from classified),
        'single_anchored_compatible_target',(select count(*) from classified where matching_status='single_anchored_compatible_target'),
        'multiple_anchored_compatible_targets',(select count(*) from classified where matching_status='multiple_anchored_compatible_targets'),
        'single_unanchored_nonconflicting_target',(select count(*) from classified where matching_status='single_unanchored_nonconflicting_target'),
        'multiple_unanchored_nonconflicting_targets',(select count(*) from classified where matching_status='multiple_unanchored_nonconflicting_targets'),
        'no_compatible_target',(select count(*) from classified where matching_status='no_compatible_target'),
        'no_offered_target',(select count(*) from classified where matching_status='no_offered_target')
      ),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'candidate_id',c.candidate_id,
          'run_id',c.run_id,
          'reingest_id',c.reingest_id,
          'thread_id',c.thread_id,
          'candidate_index',c.candidate_index,
          'source_text',c.source_text,
          'candidate_evidence',c.candidate_evidence,
          'review_status',c.review_status,
          'source_binding_status',c.source_binding->>'binding_status',
          'matching_status',c.matching_status,
          'offered_target_count',c.offered_target_count,
          'anchored_compatible_target_count',c.anchored_compatible_target_count,
          'nonconflicting_target_count',c.nonconflicting_target_count,
          'gap_fill_target_count',c.gap_fill_target_count,
          'target_observations',coalesce((
            select jsonb_agg(jsonb_build_object(
              'observation_id',t.observation_id,
              'source_text',t.observation_source_text,
              'identity_equal_count',t.identity_equal_count,
              'identity_conflict_count',t.identity_conflict_count,
              'identity_equal_fields',t.identity_equal_fields,
              'identity_conflicting_fields',t.identity_conflicting_fields,
              'recoverable_gap_fields',t.recoverable_gap_fields,
              'recoverable_gap_count',t.recoverable_gap_count,
              'compatible',
                (t.identity_conflict_count=0),
              'identity_anchored',
                (t.identity_conflict_count=0 and t.identity_equal_count>0)
            ) order by t.observation_id)
            from target_rows t
            where t.candidate_id=c.candidate_id
          ),'[]'::jsonb)
        ) order by c.candidate_id)
        from classified c
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'recovery_successor_only',true,
        'offered_candidates_only',true,
        'offered_observations_only',true,
        'identity_conflict_blocks_compatibility',true,
        'identity_anchor_requires_equal_identity_field',true,
        'single_compatible_target_is_not_automatic_match',true,
        'explicit_target_selection_required',true,
        'explicit_field_selection_required',true,
        'automatic_candidate_match',false,
        'automatic_candidate_adoption',false,
        'automatic_remediation_closure',false,
        'control_phase','PA2.30.7'
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_recovery_matching_readiness(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_recovery_matching_readiness(uuid,integer)
to authenticated,service_role;
