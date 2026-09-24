-- PA2.30.13 — Controlled Recovery Disposition Execution.
-- Explicit batch execution for recovery remediations already classified by PA2.30.12.
-- The caller must provide the exact remediation ids and a non-empty note.
-- Every id is revalidated at execution time; stale/non-eligible items are blocked, never forced.

create table if not exists private.commercial_offer_recovery_disposition_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  requested_by uuid not null,
  requested_remediation_ids bigint[] not null,
  confirmed_count integer not null check (confirmed_count > 0),
  requested_count integer not null check (requested_count > 0),
  dismissed_count integer not null default 0 check (dismissed_count >= 0),
  already_closed_count integer not null default 0 check (already_closed_count >= 0),
  blocked_count integer not null default 0 check (blocked_count >= 0),
  note text not null check (length(btrim(note)) between 1 and 2000),
  result_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (cardinality(requested_remediation_ids) = requested_count),
  check (confirmed_count = requested_count),
  check (dismissed_count + already_closed_count + blocked_count = requested_count)
);

revoke all on table private.commercial_offer_recovery_disposition_batches
from public,anon,authenticated;
grant select,insert on table private.commercial_offer_recovery_disposition_batches
to service_role;

create index if not exists commercial_offer_recovery_disposition_batches_org_created_idx
  on private.commercial_offer_recovery_disposition_batches(organization_id,created_at desc);

create index if not exists commercial_offer_recovery_disposition_batches_actor_idx
  on private.commercial_offer_recovery_disposition_batches(requested_by,created_at desc);

create or replace function private.execute_offer_recovery_disposition_batch_impl(
  p_organization_id uuid,
  p_remediation_queue_ids bigint[],
  p_confirmed_count integer,
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
  requested_count integer;
  distinct_count integer;
  invalid_count integer;
  batch_id uuid := gen_random_uuid();
  remediation_id bigint;
  state jsonb;
  close_result jsonb;
  item_result jsonb;
  results jsonb := '[]'::jsonb;
  dismissed_count integer := 0;
  already_closed_count integer := 0;
  blocked_count integer := 0;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if p_organization_id is null
     or not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;
  if p_remediation_queue_ids is null
     or cardinality(p_remediation_queue_ids)=0
     or cardinality(p_remediation_queue_ids)>100 then
    raise exception 'between 1 and 100 remediation ids are required' using errcode='22023';
  end if;
  if normalized_note is null then
    raise exception 'batch dismissal note is required' using errcode='22023';
  end if;

  requested_count := cardinality(p_remediation_queue_ids);

  select
    count(distinct x)::int,
    count(*) filter(where x is null or x<=0)::int
  into distinct_count,invalid_count
  from unnest(p_remediation_queue_ids) x;

  if invalid_count>0 or distinct_count<>requested_count then
    raise exception 'remediation ids must be positive and unique' using errcode='22023';
  end if;
  if p_confirmed_count is null or p_confirmed_count<>requested_count then
    raise exception 'confirmed count must exactly match requested remediation count'
      using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'offer-recovery-disposition-batch:'||p_organization_id::text,0
  ));

  foreach remediation_id in array p_remediation_queue_ids loop
    state := private.offer_recovery_remediation_disposition_state(
      p_organization_id,remediation_id
    );

    if state->>'disposition_status'='ready_dismiss_no_offered_evidence'
       and state->>'closure_status'='ready_dismiss_no_candidates'
       and coalesce((state->>'requires_explicit_close')::boolean,false)=true
       and coalesce((state->>'offered_candidate_count')::int,0)=0 then

      close_result := private.close_offer_reparse_remediation_impl(
        p_organization_id,
        remediation_id,
        left(
          'PA2.30.13 batch '||batch_id::text||': '||normalized_note,
          2000
        )
      );

      if close_result->>'status'='dismissed' then
        dismissed_count := dismissed_count + 1;
      elsif close_result->>'status'='already_closed' then
        already_closed_count := already_closed_count + 1;
      else
        blocked_count := blocked_count + 1;
      end if;

      item_result := jsonb_build_object(
        'remediation_queue_id',remediation_id,
        'preflight_disposition_status',state->>'disposition_status',
        'preflight_closure_status',state->>'closure_status',
        'status',close_result->>'status',
        'reason',close_result->>'reason',
        'resolution_reason',close_result->>'resolution_reason',
        'closure_event_id',nullif(close_result->>'closure_event_id','')::bigint
      );
    else
      blocked_count := blocked_count + 1;
      item_result := jsonb_build_object(
        'remediation_queue_id',remediation_id,
        'preflight_disposition_status',state->>'disposition_status',
        'preflight_closure_status',state->>'closure_status',
        'status','blocked',
        'reason','not_ready_dismiss_no_offered_evidence',
        'resolution_reason',state->>'resolution_reason',
        'closure_event_id',null
      );
    end if;

    results := results || jsonb_build_array(item_result);
  end loop;

  insert into private.commercial_offer_recovery_disposition_batches(
    id,
    organization_id,
    requested_by,
    requested_remediation_ids,
    confirmed_count,
    requested_count,
    dismissed_count,
    already_closed_count,
    blocked_count,
    note,
    result_snapshot
  ) values (
    batch_id,
    p_organization_id,
    actor_id,
    p_remediation_queue_ids,
    p_confirmed_count,
    requested_count,
    dismissed_count,
    already_closed_count,
    blocked_count,
    normalized_note,
    jsonb_build_object(
      'batch_id',batch_id,
      'items',results,
      'automatic_closure',false,
      'automatic_candidate_rejection',false,
      'control_phase','PA2.30.13'
    )
  );

  return jsonb_build_object(
    'status',case when blocked_count=0 then 'completed' else 'completed_with_blocks' end,
    'batch_id',batch_id,
    'requested_count',requested_count,
    'dismissed_count',dismissed_count,
    'already_closed_count',already_closed_count,
    'blocked_count',blocked_count,
    'items',results,
    'automatic_closure',false,
    'automatic_candidate_rejection',false,
    'control_phase','PA2.30.13'
  );
end;
$$;

revoke all on function private.execute_offer_recovery_disposition_batch_impl(uuid,bigint[],integer,text)
from public,anon;
grant execute on function private.execute_offer_recovery_disposition_batch_impl(uuid,bigint[],integer,text)
to authenticated,service_role;

create or replace function public.p1_execute_offer_recovery_disposition_batch(
  p_organization_id uuid,
  p_remediation_queue_ids bigint[],
  p_confirmed_count integer,
  p_note text
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.execute_offer_recovery_disposition_batch_impl(
    p_organization_id,
    p_remediation_queue_ids,
    p_confirmed_count,
    p_note
  );
$$;

revoke all on function public.p1_execute_offer_recovery_disposition_batch(uuid,bigint[],integer,text)
from public,anon;
grant execute on function public.p1_execute_offer_recovery_disposition_batch(uuid,bigint[],integer,text)
to authenticated,service_role;

create or replace function private.offer_recovery_disposition_batch_history(
  p_organization_id uuid,
  p_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if p_organization_id is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  return (
    select jsonb_build_object(
      'items',
      coalesce(jsonb_agg(
        jsonb_build_object(
          'batch_id',b.id,
          'requested_by',b.requested_by,
          'requested_remediation_ids',b.requested_remediation_ids,
          'confirmed_count',b.confirmed_count,
          'requested_count',b.requested_count,
          'dismissed_count',b.dismissed_count,
          'already_closed_count',b.already_closed_count,
          'blocked_count',b.blocked_count,
          'note',b.note,
          'result_snapshot',b.result_snapshot,
          'created_at',b.created_at
        )
        order by b.created_at desc
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'explicit_id_selection_required',true,
        'explicit_confirmation_count_required',true,
        'note_required',true,
        'state_revalidated_per_item',true,
        'automatic_discovery_execution',false,
        'control_phase','PA2.30.13'
      )
    )
    from (
      select *
      from private.commercial_offer_recovery_disposition_batches
      where organization_id=p_organization_id
      order by created_at desc
      limit greatest(1,least(coalesce(p_limit,20),100))
    ) b
  );
end;
$$;

revoke all on function private.offer_recovery_disposition_batch_history(uuid,integer)
from public,anon;
grant execute on function private.offer_recovery_disposition_batch_history(uuid,integer)
to authenticated,service_role;

create or replace function public.p1_offer_recovery_disposition_batch_history(
  p_organization_id uuid,
  p_limit integer default 20
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
  select private.offer_recovery_disposition_batch_history(
    p_organization_id,p_limit
  );
$$;

revoke all on function public.p1_offer_recovery_disposition_batch_history(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_recovery_disposition_batch_history(uuid,integer)
to authenticated,service_role;
