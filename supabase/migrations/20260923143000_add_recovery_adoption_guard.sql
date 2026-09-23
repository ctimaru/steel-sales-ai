-- PA2.30.8 — Recovery Adoption Guard & Provenance Enforcement.
-- Mutation-boundary protection for PA2.29 adoption of recovery successor candidates.

alter function private.adopt_offer_reparse_candidate_impl(uuid,bigint,bigint,text[],text)
rename to adopt_offer_reparse_candidate_impl_pa2302;

revoke all on function private.adopt_offer_reparse_candidate_impl_pa2302(uuid,bigint,bigint,text[],text)
from public,anon,authenticated;
grant execute on function private.adopt_offer_reparse_candidate_impl_pa2302(uuid,bigint,bigint,text[],text)
to service_role;

create or replace function private.offer_recovery_candidate_adoption_guard_state(
  p_organization_id uuid,
  p_candidate_id bigint,
  p_target_observation_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  c public.commercial_offer_reparse_candidates%rowtype;
  r public.commercial_offer_reparse_runs%rowtype;
  s public.commercial_offer_source_reingests%rowtype;
  o public.commercial_observations%rowtype;
  binding jsonb;
  identity_fields constant text[] := array[
    'product_type','grade','standard','material_number',
    'outer_diameter_mm','width_mm','height_mm','thickness_mm','length_mm'
  ];
  conflict_fields jsonb;
  equal_fields jsonb;
begin
  select * into c
  from public.commercial_offer_reparse_candidates
  where organization_id=p_organization_id and id=p_candidate_id;

  if not found then
    return jsonb_build_object('status','blocked','reason','candidate_not_found');
  end if;

  select * into r
  from public.commercial_offer_reparse_runs
  where organization_id=p_organization_id and id=c.run_id;

  if not found then
    return jsonb_build_object('status','blocked','reason','reparse_run_not_found');
  end if;

  if r.supersedes_run_id is null then
    return jsonb_build_object(
      'status','not_recovery_successor',
      'candidate_id',c.id,
      'run_id',r.id
    );
  end if;

  if exists (
    select 1
    from public.commercial_offer_reparse_run_invalidations i
    where i.organization_id=p_organization_id and i.run_id=r.id
  ) then
    return jsonb_build_object(
      'status','blocked',
      'reason','run_provenance_invalid',
      'candidate_id',c.id,
      'run_id',r.id
    );
  end if;

  select * into s
  from public.commercial_offer_source_reingests
  where organization_id=p_organization_id
    and successor_run_id=r.id
  order by id desc
  limit 1;

  if not found or s.status<>'consumed' then
    return jsonb_build_object(
      'status','blocked',
      'reason','recovery_reingest_not_consumed',
      'candidate_id',c.id,
      'run_id',r.id
    );
  end if;

  if s.thread_id is distinct from c.thread_id
     or s.requested_from_run_id is distinct from r.supersedes_run_id
     or s.source_job_id is distinct from r.source_job_id then
    return jsonb_build_object(
      'status','blocked',
      'reason','recovery_successor_chain_mismatch',
      'candidate_id',c.id,
      'run_id',r.id,
      'reingest_id',s.id
    );
  end if;

  binding := private.offer_reparse_source_binding_state(p_organization_id,r.id);
  if coalesce(binding->>'binding_status','') not in (
    'valid_direct_thread','valid_source_thread'
  ) then
    return jsonb_build_object(
      'status','blocked',
      'reason','recovery_successor_binding_invalid',
      'candidate_id',c.id,
      'run_id',r.id,
      'reingest_id',s.id,
      'binding_status',binding->>'binding_status'
    );
  end if;

  select * into o
  from public.commercial_observations
  where organization_id=p_organization_id
    and id=p_target_observation_id
    and thread_id=c.thread_id
    and item_role='offered';

  if not found then
    return jsonb_build_object(
      'status','blocked',
      'reason','target_observation_provenance_mismatch',
      'candidate_id',c.id,
      'run_id',r.id
    );
  end if;

  select
    coalesce(jsonb_agg(f order by f)
      filter (
        where c.candidate_evidence ? f
          and c.candidate_evidence->f is not null
          and c.candidate_evidence->f<>'null'::jsonb
          and to_jsonb(o)->f is not null
          and to_jsonb(o)->f<>'null'::jsonb
          and to_jsonb(o)->f is distinct from c.candidate_evidence->f
      ),'[]'::jsonb),
    coalesce(jsonb_agg(f order by f)
      filter (
        where c.candidate_evidence ? f
          and c.candidate_evidence->f is not null
          and c.candidate_evidence->f<>'null'::jsonb
          and to_jsonb(o)->f is not null
          and to_jsonb(o)->f<>'null'::jsonb
          and to_jsonb(o)->f = c.candidate_evidence->f
      ),'[]'::jsonb)
  into conflict_fields,equal_fields
  from unnest(identity_fields) f;

  if jsonb_array_length(conflict_fields)>0 then
    return jsonb_build_object(
      'status','blocked',
      'reason','recovery_target_identity_conflict',
      'candidate_id',c.id,
      'run_id',r.id,
      'reingest_id',s.id,
      'target_observation_id',o.id,
      'identity_conflicting_fields',conflict_fields,
      'identity_equal_fields',equal_fields
    );
  end if;

  return jsonb_build_object(
    'status','eligible',
    'candidate_id',c.id,
    'run_id',r.id,
    'reingest_id',s.id,
    'target_observation_id',o.id,
    'binding_status',binding->>'binding_status',
    'identity_equal_fields',equal_fields,
    'identity_anchored',(jsonb_array_length(equal_fields)>0),
    'explicit_target_selection_required',true,
    'automatic_candidate_match',false,
    'control_phase','PA2.30.8'
  );
end;
$$;

revoke all on function private.offer_recovery_candidate_adoption_guard_state(uuid,bigint,bigint)
from public,anon,authenticated;
grant execute on function private.offer_recovery_candidate_adoption_guard_state(uuid,bigint,bigint)
to service_role;

create or replace function private.adopt_offer_reparse_candidate_impl(
  p_organization_id uuid,
  p_candidate_id bigint,
  p_target_observation_id bigint,
  p_selected_fields text[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid := (select auth.uid());
  guard jsonb;
  result jsonb;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;

  guard := private.offer_recovery_candidate_adoption_guard_state(
    p_organization_id,p_candidate_id,p_target_observation_id
  );

  if guard->>'status'='blocked' then
    return guard;
  end if;

  result := private.adopt_offer_reparse_candidate_impl_pa2302(
    p_organization_id,p_candidate_id,p_target_observation_id,p_selected_fields,p_note
  );

  if guard->>'status'='eligible' then
    return result || jsonb_build_object(
      'recovery_adoption_guard','PA2.30.8',
      'recovery_reingest_id',(guard->>'reingest_id')::bigint,
      'recovery_binding_status',guard->>'binding_status',
      'recovery_identity_anchored',(guard->>'identity_anchored')::boolean,
      'automatic_candidate_match',false
    );
  end if;

  return result;
end;
$$;

revoke all on function private.adopt_offer_reparse_candidate_impl(uuid,bigint,bigint,text[],text)
from public,anon;
grant execute on function private.adopt_offer_reparse_candidate_impl(uuid,bigint,bigint,text[],text)
to authenticated,service_role;

create or replace function public.p1_adopt_offer_reparse_candidate(
  p_organization_id uuid,
  p_candidate_id bigint,
  p_target_observation_id bigint,
  p_selected_fields text[],
  p_note text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.adopt_offer_reparse_candidate_impl(
    p_organization_id,p_candidate_id,p_target_observation_id,p_selected_fields,p_note
  );
$$;

revoke all on function public.p1_adopt_offer_reparse_candidate(uuid,bigint,bigint,text[],text)
from public,anon;
grant execute on function public.p1_adopt_offer_reparse_candidate(uuid,bigint,bigint,text[],text)
to authenticated,service_role;
