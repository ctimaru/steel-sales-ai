-- PA2.30.9 — Recovery Closure Handoff & Quarantine Isolation.
-- A quarantined predecessor remains immutable evidence, but must not block explicit
-- closure when the latest recovery successor has valid source provenance and
-- terminal PA2.29 decisions.

create or replace function private.offer_recovery_closure_handoff_state(
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
  r public.commercial_offer_reparse_runs%rowtype;
  s public.commercial_offer_source_reingests%rowtype;
  binding jsonb;
  predecessor_invalidated boolean := false;
begin
  select * into r
  from public.commercial_offer_reparse_runs
  where organization_id=p_organization_id
    and remediation_queue_id=p_remediation_queue_id
  order by id desc
  limit 1;

  if not found or r.id is null then
    return jsonb_build_object(
      'status','not_recovery_successor',
      'reason','run_missing'
    );
  end if;

  if r.supersedes_run_id is null then
    return jsonb_build_object(
      'status','not_recovery_successor',
      'run_id',r.id
    );
  end if;

  if exists (
    select 1
    from public.commercial_offer_reparse_run_invalidations i
    where i.organization_id=p_organization_id
      and i.run_id=r.id
  ) then
    return jsonb_build_object(
      'status','blocked',
      'reason','latest_run_provenance_invalid',
      'run_id',r.id
    );
  end if;

  select * into s
  from public.commercial_offer_source_reingests
  where organization_id=p_organization_id
    and remediation_queue_id=p_remediation_queue_id
    and successor_run_id=r.id
  order by id desc
  limit 1;

  if not found or s.status<>'consumed' then
    return jsonb_build_object(
      'status','blocked',
      'reason','recovery_reingest_not_consumed',
      'run_id',r.id
    );
  end if;

  if s.thread_id is distinct from r.thread_id
     or s.requested_from_run_id is distinct from r.supersedes_run_id
     or s.source_job_id is distinct from r.source_job_id then
    return jsonb_build_object(
      'status','blocked',
      'reason','recovery_successor_chain_mismatch',
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
      'run_id',r.id,
      'reingest_id',s.id,
      'binding_status',binding->>'binding_status'
    );
  end if;

  select exists (
    select 1
    from public.commercial_offer_reparse_run_invalidations i
    where i.organization_id=p_organization_id
      and i.run_id=r.supersedes_run_id
  ) into predecessor_invalidated;

  return jsonb_build_object(
    'status','eligible',
    'run_id',r.id,
    'predecessor_run_id',r.supersedes_run_id,
    'reingest_id',s.id,
    'binding_status',binding->>'binding_status',
    'predecessor_quarantine_preserved',predecessor_invalidated,
    'automatic_closure',false,
    'control_phase','PA2.30.9'
  );
end;
$$;

revoke all on function private.offer_recovery_closure_handoff_state(uuid,bigint)
from public,anon,authenticated;
grant execute on function private.offer_recovery_closure_handoff_state(uuid,bigint)
to service_role;

alter function private.offer_reparse_remediation_closure_state(uuid,bigint)
rename to offer_reparse_remediation_closure_state_pa2302;

revoke all on function private.offer_reparse_remediation_closure_state_pa2302(uuid,bigint)
from public,anon,authenticated;
grant execute on function private.offer_reparse_remediation_closure_state_pa2302(uuid,bigint)
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
  state jsonb;
begin
  handoff := private.offer_recovery_closure_handoff_state(
    p_organization_id,p_remediation_queue_id
  );

  if handoff->>'status'='eligible' then
    state := private.offer_reparse_remediation_closure_state_pa230(
      p_organization_id,p_remediation_queue_id
    );
    return state || jsonb_build_object(
      'recovery_closure_handoff','PA2.30.9',
      'recovery_run_id',(handoff->>'run_id')::bigint,
      'recovery_predecessor_run_id',(handoff->>'predecessor_run_id')::bigint,
      'recovery_reingest_id',(handoff->>'reingest_id')::bigint,
      'recovery_binding_status',handoff->>'binding_status',
      'predecessor_quarantine_preserved',
        coalesce((handoff->>'predecessor_quarantine_preserved')::boolean,false),
      'automatic_closure',false
    );
  end if;

  if handoff->>'status'='blocked' then
    return jsonb_build_object(
      'remediation_queue_id',p_remediation_queue_id,
      'run_id',nullif(handoff->>'run_id','')::bigint,
      'closure_status',handoff->>'reason',
      'recommended_outcome',null,
      'resolution_reason',null,
      'recovery_closure_handoff','PA2.30.9',
      'requires_explicit_close',false,
      'automatic_closure',false
    );
  end if;

  return private.offer_reparse_remediation_closure_state_pa2302(
    p_organization_id,p_remediation_queue_id
  );
end;
$$;

revoke all on function private.offer_reparse_remediation_closure_state(uuid,bigint)
from public,anon;
grant execute on function private.offer_reparse_remediation_closure_state(uuid,bigint)
to authenticated,service_role;

alter function private.close_offer_reparse_remediation_impl(uuid,bigint,text)
rename to close_offer_reparse_remediation_impl_pa2302;

revoke all on function private.close_offer_reparse_remediation_impl_pa2302(uuid,bigint,text)
from public,anon,authenticated;
grant execute on function private.close_offer_reparse_remediation_impl_pa2302(uuid,bigint,text)
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
  handoff jsonb;
  result jsonb;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;

  handoff := private.offer_recovery_closure_handoff_state(
    p_organization_id,p_remediation_queue_id
  );

  if handoff->>'status'='blocked' then
    return jsonb_build_object(
      'status','blocked',
      'reason',handoff->>'reason',
      'remediation_queue_id',p_remediation_queue_id,
      'recovery_closure_handoff','PA2.30.9'
    );
  end if;

  if handoff->>'status'='eligible' then
    result := private.close_offer_reparse_remediation_impl_pa230(
      p_organization_id,p_remediation_queue_id,p_note
    );
    return result || jsonb_build_object(
      'recovery_closure_handoff','PA2.30.9',
      'recovery_run_id',(handoff->>'run_id')::bigint,
      'recovery_predecessor_run_id',(handoff->>'predecessor_run_id')::bigint,
      'predecessor_quarantine_preserved',
        coalesce((handoff->>'predecessor_quarantine_preserved')::boolean,false),
      'automatic_closure',false
    );
  end if;

  return private.close_offer_reparse_remediation_impl_pa2302(
    p_organization_id,p_remediation_queue_id,p_note
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
