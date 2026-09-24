-- PA2.30.14 — Controlled Residual Offer Candidate Resolution.
-- A recovery Offer candidate can be resolved only when exactly one offered observation
-- is anchored by source provenance + candidate source-text containment.
-- The target is never inferred from geometry alone and execution remains explicit.

create or replace function private.offer_recovery_residual_candidate_resolution_state(
  p_organization_id uuid,
  p_candidate_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor_id uuid := (select auth.uid());
  c public.commercial_offer_reparse_candidates%rowtype;
  r public.commercial_offer_reparse_runs%rowtype;
  q public.commercial_offer_remediation_queue%rowtype;
  normalized_candidate_text text;
  candidate_basename text;
  target_count integer := 0;
  target_id bigint;
  target_source_text text;
  target_basename text;
  adoptable_fields jsonb := '[]'::jsonb;
  guard jsonb;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if p_organization_id is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  select * into c
  from public.commercial_offer_reparse_candidates
  where organization_id=p_organization_id and id=p_candidate_id;

  if not found then
    return jsonb_build_object(
      'status','blocked','reason','candidate_not_found',
      'candidate_id',p_candidate_id,'control_phase','PA2.30.14'
    );
  end if;

  select * into r
  from public.commercial_offer_reparse_runs
  where organization_id=p_organization_id and id=c.run_id;

  select * into q
  from public.commercial_offer_remediation_queue
  where organization_id=p_organization_id and id=r.remediation_queue_id;

  if c.item_role is distinct from 'offered' then
    return jsonb_build_object(
      'status','blocked','reason','candidate_not_offered',
      'candidate_id',c.id,'run_id',c.run_id,'control_phase','PA2.30.14'
    );
  end if;

  if c.review_status<>'pending_review' then
    return jsonb_build_object(
      'status','terminal','reason','candidate_already_decided',
      'candidate_id',c.id,'run_id',c.run_id,
      'review_status',c.review_status,'control_phase','PA2.30.14'
    );
  end if;

  if r.supersedes_run_id is null then
    return jsonb_build_object(
      'status','blocked','reason','not_recovery_successor',
      'candidate_id',c.id,'run_id',c.run_id,'control_phase','PA2.30.14'
    );
  end if;

  if q.id is null or q.status<>'pending' then
    return jsonb_build_object(
      'status','blocked','reason','remediation_not_pending',
      'candidate_id',c.id,'run_id',c.run_id,
      'remediation_queue_id',r.remediation_queue_id,
      'control_phase','PA2.30.14'
    );
  end if;

  if private.offer_recovery_remediation_disposition_state(
       p_organization_id,q.id
     )->>'disposition_status' <> 'offer_decision_required' then
    return jsonb_build_object(
      'status','blocked','reason','remediation_not_waiting_for_offer_decision',
      'candidate_id',c.id,'run_id',c.run_id,
      'remediation_queue_id',q.id,'control_phase','PA2.30.14'
    );
  end if;

  normalized_candidate_text := lower(
    regexp_replace(btrim(coalesce(c.source_text,'')),'\s+',' ','g')
  );
  candidate_basename := lower(
    regexp_replace(
      coalesce(c.candidate_evidence->>'source_filename',''),
      '^.*/',''
    )
  );

  if length(normalized_candidate_text)<20 or candidate_basename='' then
    return jsonb_build_object(
      'status','blocked','reason','insufficient_source_provenance',
      'candidate_id',c.id,'run_id',c.run_id,'control_phase','PA2.30.14'
    );
  end if;

  with targets as (
    select
      o.id,
      o.source_text,
      lower(regexp_replace(coalesce(o.source_filename,''),'^.*/','')) basename,
      private.offer_recovery_candidate_adoption_guard_state(
        p_organization_id,c.id,o.id
      ) adoption_guard,
      (
        select coalesce(jsonb_agg(f order by f),'[]'::jsonb)
        from unnest(array[
          'product_type','grade','standard','material_number',
          'outer_diameter_mm','width_mm','height_mm','thickness_mm','length_mm',
          'quantity','quantity_unit','price_value','price_unit','currency',
          'discount_percentage','availability_status'
        ]::text[]) f
        where c.candidate_evidence ? f
          and c.candidate_evidence->f is not null
          and c.candidate_evidence->f<>'null'::jsonb
          and (to_jsonb(o)->f is null or to_jsonb(o)->f='null'::jsonb)
      ) fields_available
    from public.commercial_observations o
    where o.organization_id=p_organization_id
      and o.thread_id=c.thread_id
      and o.item_role='offered'
      and lower(regexp_replace(coalesce(o.source_filename,''),'^.*/',''))=candidate_basename
      and position(
        normalized_candidate_text
        in lower(regexp_replace(coalesce(o.source_text,''),'\s+',' ','g'))
      )>0
  ),
  eligible as (
    select *
    from targets
    where adoption_guard->>'status'='eligible'
  )
  select
    count(*)::int,
    min(id),
    min(source_text),
    min(basename),
    coalesce(min(fields_available::text)::jsonb,'[]'::jsonb)
  into
    target_count,target_id,target_source_text,target_basename,adoptable_fields
  from eligible;

  if target_count=0 then
    return jsonb_build_object(
      'status','blocked','reason','no_source_provenance_target',
      'candidate_id',c.id,'run_id',c.run_id,
      'remediation_queue_id',q.id,
      'source_filename_basename',candidate_basename,
      'control_phase','PA2.30.14'
    );
  end if;

  if target_count>1 then
    return jsonb_build_object(
      'status','blocked','reason','multiple_source_provenance_targets',
      'candidate_id',c.id,'run_id',c.run_id,
      'remediation_queue_id',q.id,
      'source_target_count',target_count,
      'control_phase','PA2.30.14'
    );
  end if;

  guard := private.offer_recovery_candidate_adoption_guard_state(
    p_organization_id,c.id,target_id
  );

  return jsonb_build_object(
    'status','source_provenance_target_ready',
    'candidate_id',c.id,
    'run_id',c.run_id,
    'remediation_queue_id',q.id,
    'thread_id',c.thread_id,
    'candidate_source_text',c.source_text,
    'candidate_source_filename',c.candidate_evidence->>'source_filename',
    'target_observation_id',target_id,
    'target_source_text',target_source_text,
    'target_source_filename_basename',target_basename,
    'source_text_containment_anchor',true,
    'source_filename_anchor',true,
    'adoption_guard_status',guard->>'status',
    'adoption_guard_identity_anchored',
      coalesce((guard->>'identity_anchored')::boolean,false),
    'adoptable_fields',adoptable_fields,
    'explicit_target_confirmation_required',true,
    'explicit_field_confirmation_required',true,
    'automatic_candidate_adoption',false,
    'automatic_remediation_closure',false,
    'control_phase','PA2.30.14'
  );
end;
$$;

revoke all on function private.offer_recovery_residual_candidate_resolution_state(uuid,bigint)
from public,anon;
grant execute on function private.offer_recovery_residual_candidate_resolution_state(uuid,bigint)
to authenticated,service_role;

create or replace function public.p1_offer_recovery_residual_candidate_resolution_readiness(
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
    with candidate_ids as (
      select c.id
      from public.commercial_offer_reparse_candidates c
      join public.commercial_offer_reparse_runs r
        on r.id=c.run_id and r.organization_id=c.organization_id
      join public.commercial_offer_remediation_queue q
        on q.id=r.remediation_queue_id and q.organization_id=r.organization_id
      where c.organization_id=p_organization_id
        and r.supersedes_run_id is not null
        and c.item_role='offered'
        and c.review_status='pending_review'
        and q.status='pending'
      order by c.id
      limit greatest(1,least(coalesce(p_limit,100),500))
    ),
    states as (
      select private.offer_recovery_residual_candidate_resolution_state(
        p_organization_id,id
      ) state
      from candidate_ids
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'candidate_count',(select count(*) from states),
        'source_provenance_target_ready',(
          select count(*) from states
          where state->>'status'='source_provenance_target_ready'
        ),
        'blocked',(select count(*) from states where state->>'status'='blocked'),
        'terminal',(select count(*) from states where state->>'status'='terminal')
      ),
      'items',coalesce((
        select jsonb_agg(state order by (state->>'candidate_id')::bigint)
        from states
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'same_thread_required',true,
        'same_source_filename_required',true,
        'candidate_text_containment_required',true,
        'unique_source_target_required',true,
        'pa2308_adoption_guard_required',true,
        'explicit_target_confirmation_required',true,
        'explicit_field_confirmation_required',true,
        'automatic_candidate_adoption',false,
        'automatic_remediation_closure',false,
        'control_phase','PA2.30.14'
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_recovery_residual_candidate_resolution_readiness(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_recovery_residual_candidate_resolution_readiness(uuid,integer)
to authenticated,service_role;

create or replace function private.resolve_offer_recovery_residual_candidate_impl(
  p_organization_id uuid,
  p_candidate_id bigint,
  p_target_observation_id bigint,
  p_selected_fields text[],
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_note text := left(nullif(btrim(coalesce(p_note,'')),''),2000);
  state jsonb;
  expected_target bigint;
  available_fields text[];
  selected_distinct_count integer;
  result jsonb;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if p_organization_id is null
     or not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;
  if normalized_note is null then
    raise exception 'resolution note is required' using errcode='22023';
  end if;
  if p_selected_fields is null or cardinality(p_selected_fields)=0 then
    raise exception 'selected fields are required' using errcode='22023';
  end if;

  select count(distinct x)::int
  into selected_distinct_count
  from unnest(p_selected_fields) x
  where x is not null and btrim(x)<>'';

  if selected_distinct_count<>cardinality(p_selected_fields) then
    raise exception 'selected fields must be non-empty and unique' using errcode='22023';
  end if;

  state := private.offer_recovery_residual_candidate_resolution_state(
    p_organization_id,p_candidate_id
  );

  if state->>'status'<>'source_provenance_target_ready' then
    return state || jsonb_build_object(
      'status','blocked',
      'reason',coalesce(state->>'reason','residual_candidate_not_ready')
    );
  end if;

  expected_target := (state->>'target_observation_id')::bigint;
  if p_target_observation_id is distinct from expected_target then
    return state || jsonb_build_object(
      'status','blocked',
      'reason','explicit_target_does_not_match_source_provenance_anchor',
      'provided_target_observation_id',p_target_observation_id
    );
  end if;

  select coalesce(array_agg(v order by v),array[]::text[])
  into available_fields
  from jsonb_array_elements_text(state->'adoptable_fields') v;

  if exists (
    select 1
    from unnest(p_selected_fields) f
    where not (f=any(available_fields))
  ) then
    return state || jsonb_build_object(
      'status','blocked',
      'reason','selected_field_not_adoptable'
    );
  end if;

  if not (
    'quantity'=any(p_selected_fields)
    and 'quantity_unit'=any(p_selected_fields)
    and 'length_mm'=any(p_selected_fields)
  ) then
    return state || jsonb_build_object(
      'status','blocked',
      'reason','required_recovered_fields_not_confirmed',
      'required_fields',jsonb_build_array('length_mm','quantity','quantity_unit')
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'offer-recovery-residual-candidate:'||p_organization_id::text||':'||p_candidate_id::text,
      0
    )
  );

  -- Re-evaluate after lock so target provenance and candidate state cannot go stale.
  state := private.offer_recovery_residual_candidate_resolution_state(
    p_organization_id,p_candidate_id
  );
  if state->>'status'<>'source_provenance_target_ready'
     or (state->>'target_observation_id')::bigint is distinct from p_target_observation_id then
    return state || jsonb_build_object(
      'status','blocked',
      'reason','residual_candidate_state_changed'
    );
  end if;

  result := private.adopt_offer_reparse_candidate_impl(
    p_organization_id,
    p_candidate_id,
    p_target_observation_id,
    p_selected_fields,
    'PA2.30.14 source-provenance resolution: '||normalized_note
  );

  if result->>'status' not in ('adopted','already_decided') then
    return result || jsonb_build_object(
      'residual_resolution_control','PA2.30.14'
    );
  end if;

  return result || jsonb_build_object(
    'residual_resolution_control','PA2.30.14',
    'source_provenance_target_confirmed',true,
    'explicit_target_observation_id',p_target_observation_id,
    'explicit_selected_fields',to_jsonb(p_selected_fields),
    'automatic_candidate_adoption',false,
    'automatic_remediation_closure',false
  );
end;
$$;

revoke all on function private.resolve_offer_recovery_residual_candidate_impl(uuid,bigint,bigint,text[],text)
from public,anon;
grant execute on function private.resolve_offer_recovery_residual_candidate_impl(uuid,bigint,bigint,text[],text)
to authenticated,service_role;

create or replace function public.p1_resolve_offer_recovery_residual_candidate(
  p_organization_id uuid,
  p_candidate_id bigint,
  p_target_observation_id bigint,
  p_selected_fields text[],
  p_note text
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.resolve_offer_recovery_residual_candidate_impl(
    p_organization_id,
    p_candidate_id,
    p_target_observation_id,
    p_selected_fields,
    p_note
  );
$$;

revoke all on function public.p1_resolve_offer_recovery_residual_candidate(uuid,bigint,bigint,text[],text)
from public,anon;
grant execute on function public.p1_resolve_offer_recovery_residual_candidate(uuid,bigint,bigint,text[],text)
to authenticated,service_role;
