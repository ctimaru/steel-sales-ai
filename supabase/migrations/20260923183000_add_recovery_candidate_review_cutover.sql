-- PA2.30.11 — Recovery Candidate Review & Decision Cutover.
-- Separates offer-remediation decision scope from other candidate roles.
-- Recovery successor candidates with roles other than 'offered' are preserved
-- for their native workflow and cannot be rejected through the offer-reparse path.

create or replace function public.p1_offer_recovery_candidate_decision_readiness(
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
  adoptable_fields constant text[] := array[
    'product_type','grade','standard','material_number',
    'outer_diameter_mm','width_mm','height_mm','thickness_mm','length_mm',
    'quantity','quantity_unit','price_value','price_unit','currency',
    'discount_percentage','availability_status'
  ];
begin
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    with candidates as (
      select
        c.id candidate_id,
        c.run_id,
        r.remediation_queue_id,
        c.thread_id,
        c.candidate_index,
        c.source_text,
        c.item_role,
        c.candidate_evidence,
        c.review_status,
        d.id decision_id,
        d.decision,
        d.target_observation_id decided_target_observation_id,
        d.selected_fields decided_fields,
        d.decided_at,
        s.id reingest_id,
        s.status reingest_status,
        private.offer_reparse_source_binding_state(
          p_organization_id,r.id
        )->>'binding_status' source_binding_status
      from public.commercial_offer_reparse_candidates c
      join public.commercial_offer_reparse_runs r
        on r.id=c.run_id and r.organization_id=c.organization_id
      join public.commercial_offer_source_reingests s
        on s.organization_id=c.organization_id
       and s.successor_run_id=r.id
      left join public.commercial_offer_reparse_candidate_decisions d
        on d.organization_id=c.organization_id
       and d.candidate_id=c.id
      where c.organization_id=p_organization_id
        and r.supersedes_run_id is not null
        and r.status='completed'
        and s.status='consumed'
        and not exists (
          select 1
          from public.commercial_offer_reparse_run_invalidations i
          where i.organization_id=r.organization_id
            and i.run_id=r.id
        )
      order by c.id
      limit greatest(1,least(coalesce(p_limit,200),500))
    ),
    target_rows as (
      select
        c.candidate_id,
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
          from unnest(adoptable_fields) f
          where c.candidate_evidence ? f
            and c.candidate_evidence->f is not null
            and c.candidate_evidence->f <> 'null'::jsonb
            and (to_jsonb(o)->f is null or to_jsonb(o)->f='null'::jsonb)
        ) fields_available_to_adopt
      from candidates c
      join public.commercial_observations o
        on o.organization_id=p_organization_id
       and o.thread_id=c.thread_id
       and o.item_role='offered'
      where c.item_role='offered'
    ),
    classified as (
      select
        c.*,
        coalesce((select count(*) from target_rows t
          where t.candidate_id=c.candidate_id),0)::int offered_target_count,
        coalesce((select count(*) from target_rows t
          where t.candidate_id=c.candidate_id
            and t.identity_conflict_count=0
            and t.identity_equal_count>0),0)::int anchored_target_count,
        coalesce((select count(*) from target_rows t
          where t.candidate_id=c.candidate_id
            and t.identity_conflict_count=0),0)::int nonconflicting_target_count
      from candidates c
    ),
    decision_scope as (
      select
        c.*,
        case
          when c.decision_id is not null or c.review_status<>'pending_review'
            then 'decision_terminal'
          when c.item_role is distinct from 'offered'
            then 'preserved_out_of_scope_role'
          when c.offered_target_count=0
            then 'offered_no_target'
          when c.anchored_target_count=1
            then 'offered_explicit_decision_ready'
          when c.anchored_target_count>1
            then 'offered_manual_target_selection'
          when c.nonconflicting_target_count=1
            then 'offered_manual_confirmation_required'
          when c.nonconflicting_target_count>1
            then 'offered_manual_target_selection'
          else 'offered_no_compatible_target'
        end decision_readiness
      from classified c
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'candidate_count',(select count(*) from decision_scope),
        'offered_candidate_count',(select count(*) from decision_scope where item_role='offered'),
        'out_of_scope_role_count',(select count(*) from decision_scope where item_role is distinct from 'offered'),
        'decision_terminal',(select count(*) from decision_scope where decision_readiness='decision_terminal'),
        'offered_explicit_decision_ready',(select count(*) from decision_scope where decision_readiness='offered_explicit_decision_ready'),
        'offered_manual_confirmation_required',(select count(*) from decision_scope where decision_readiness='offered_manual_confirmation_required'),
        'offered_manual_target_selection',(select count(*) from decision_scope where decision_readiness='offered_manual_target_selection'),
        'offered_no_target',(select count(*) from decision_scope where decision_readiness='offered_no_target'),
        'offered_no_compatible_target',(select count(*) from decision_scope where decision_readiness='offered_no_compatible_target')
      ),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'candidate_id',c.candidate_id,
          'run_id',c.run_id,
          'remediation_queue_id',c.remediation_queue_id,
          'reingest_id',c.reingest_id,
          'thread_id',c.thread_id,
          'candidate_index',c.candidate_index,
          'source_text',c.source_text,
          'item_role',c.item_role,
          'candidate_evidence',c.candidate_evidence,
          'review_status',c.review_status,
          'decision_readiness',c.decision_readiness,
          'source_binding_status',c.source_binding_status,
          'offered_target_count',c.offered_target_count,
          'anchored_target_count',c.anchored_target_count,
          'nonconflicting_target_count',c.nonconflicting_target_count,
          'decision',case when c.decision_id is null then null else jsonb_build_object(
            'id',c.decision_id,
            'decision',c.decision,
            'target_observation_id',c.decided_target_observation_id,
            'selected_fields',c.decided_fields,
            'decided_at',c.decided_at
          ) end,
          'target_observations',coalesce((
            select jsonb_agg(jsonb_build_object(
              'observation_id',t.observation_id,
              'source_text',t.observation_source_text,
              'identity_equal_count',t.identity_equal_count,
              'identity_conflict_count',t.identity_conflict_count,
              'identity_anchored',(t.identity_conflict_count=0 and t.identity_equal_count>0),
              'compatible',(t.identity_conflict_count=0),
              'fields_available_to_adopt',t.fields_available_to_adopt
            ) order by t.observation_id)
            from target_rows t
            where t.candidate_id=c.candidate_id
          ),'[]'::jsonb)
        ) order by c.candidate_id)
        from decision_scope c
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'recovery_successor_only',true,
        'offer_decision_scope_role','offered',
        'out_of_scope_roles_are_preserved',true,
        'out_of_scope_roles_are_not_rejected',true,
        'explicit_target_selection_required',true,
        'explicit_field_selection_required',true,
        'automatic_candidate_adoption',false,
        'automatic_candidate_rejection',false,
        'automatic_remediation_closure',false,
        'control_phase','PA2.30.11'
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_recovery_candidate_decision_readiness(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_recovery_candidate_decision_readiness(uuid,integer)
to authenticated,service_role;

alter function private.reject_offer_reparse_candidate_impl(uuid,bigint,text)
rename to reject_offer_reparse_candidate_impl_pa229;

revoke all on function private.reject_offer_reparse_candidate_impl_pa229(uuid,bigint,text)
from public,anon,authenticated;
grant execute on function private.reject_offer_reparse_candidate_impl_pa229(uuid,bigint,text)
to service_role;

create or replace function private.reject_offer_reparse_candidate_impl(
  p_organization_id uuid,
  p_candidate_id bigint,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid := (select auth.uid());
  c public.commercial_offer_reparse_candidates%rowtype;
  r public.commercial_offer_reparse_runs%rowtype;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;

  select * into c
  from public.commercial_offer_reparse_candidates
  where organization_id=p_organization_id and id=p_candidate_id;

  if not found then
    return jsonb_build_object('status','blocked','reason','candidate_not_found');
  end if;

  select * into r
  from public.commercial_offer_reparse_runs
  where organization_id=p_organization_id and id=c.run_id;

  if r.supersedes_run_id is not null and c.item_role is distinct from 'offered' then
    return jsonb_build_object(
      'status','blocked',
      'reason','recovery_candidate_out_of_scope_for_offer_decision',
      'candidate_id',c.id,
      'run_id',c.run_id,
      'item_role',c.item_role,
      'review_status',c.review_status,
      'preserved_for_native_workflow',true,
      'control_phase','PA2.30.11'
    );
  end if;

  return private.reject_offer_reparse_candidate_impl_pa229(
    p_organization_id,p_candidate_id,p_note
  );
end;
$$;

revoke all on function private.reject_offer_reparse_candidate_impl(uuid,bigint,text)
from public,anon;
grant execute on function private.reject_offer_reparse_candidate_impl(uuid,bigint,text)
to authenticated,service_role;

create or replace function public.p1_reject_offer_reparse_candidate(
  p_organization_id uuid,
  p_candidate_id bigint,
  p_note text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.reject_offer_reparse_candidate_impl(
    p_organization_id,p_candidate_id,p_note
  );
$$;

revoke all on function public.p1_reject_offer_reparse_candidate(uuid,bigint,text)
from public,anon;
grant execute on function public.p1_reject_offer_reparse_candidate(uuid,bigint,text)
to authenticated,service_role;
