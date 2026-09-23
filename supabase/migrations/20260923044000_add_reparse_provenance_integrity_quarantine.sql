-- PA2.30.2 — Reparse Provenance Integrity Guard & Invalid Result Quarantine.
-- Prevent dataset-wide source fallback from contaminating per-thread reparses.
-- Invalid results are quarantined through an append-only ledger; evidence rows are preserved.

create table if not exists public.commercial_offer_reparse_run_invalidations (
  id bigint generated always as identity primary key,
  organization_id uuid not null
    references public.organizations(id) on delete restrict,
  run_id bigint not null unique
    references public.commercial_offer_reparse_runs(id) on delete restrict,
  remediation_queue_id bigint not null
    references public.commercial_offer_remediation_queue(id) on delete restrict,
  thread_id uuid not null
    references public.commercial_threads(id) on delete restrict,
  source_job_id uuid not null
    references public.worker_jobs(id) on delete restrict,
  reason text not null check (reason in (
    'source_job_not_thread_bound',
    'source_payload_mismatch',
    'manual_provenance_invalid'
  )),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  invalidated_by uuid not null references auth.users(id) on delete restrict,
  note text,
  invalidated_at timestamptz not null default now()
);

create index if not exists commercial_offer_reparse_run_invalidations_org_idx
  on public.commercial_offer_reparse_run_invalidations(organization_id,invalidated_at desc);
create index if not exists commercial_offer_reparse_run_invalidations_remediation_idx
  on public.commercial_offer_reparse_run_invalidations(remediation_queue_id);
create index if not exists commercial_offer_reparse_run_invalidations_thread_idx
  on public.commercial_offer_reparse_run_invalidations(thread_id);
create index if not exists commercial_offer_reparse_run_invalidations_source_job_idx
  on public.commercial_offer_reparse_run_invalidations(source_job_id);
create index if not exists commercial_offer_reparse_run_invalidations_actor_idx
  on public.commercial_offer_reparse_run_invalidations(invalidated_by,invalidated_at desc);

alter table public.commercial_offer_reparse_run_invalidations enable row level security;

revoke all on public.commercial_offer_reparse_run_invalidations
from public,anon,authenticated;
grant select on public.commercial_offer_reparse_run_invalidations
to authenticated,service_role;
grant insert on public.commercial_offer_reparse_run_invalidations
to service_role;
grant usage,select on sequence public.commercial_offer_reparse_run_invalidations_id_seq
to service_role;

drop policy if exists commercial_offer_reparse_run_invalidations_member_select
on public.commercial_offer_reparse_run_invalidations;
create policy commercial_offer_reparse_run_invalidations_member_select
on public.commercial_offer_reparse_run_invalidations
for select to authenticated
using (public.is_organization_member(organization_id,false));

create or replace function private.prevent_offer_reparse_run_invalidation_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception using
    errcode='55000',
    message='commercial_offer_reparse_run_invalidations is append-only';
end;
$$;

revoke all on function private.prevent_offer_reparse_run_invalidation_mutation()
from public,anon,authenticated;

drop trigger if exists commercial_offer_reparse_run_invalidations_immutable
on public.commercial_offer_reparse_run_invalidations;
create trigger commercial_offer_reparse_run_invalidations_immutable
before update or delete on public.commercial_offer_reparse_run_invalidations
for each row execute function private.prevent_offer_reparse_run_invalidation_mutation();

create or replace function private.offer_reparse_source_binding_state(
  p_organization_id uuid,
  p_run_id bigint
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  r public.commercial_offer_reparse_runs%rowtype;
  t public.commercial_threads%rowtype;
  w public.worker_jobs%rowtype;
  binding_status text;
begin
  select * into r
  from public.commercial_offer_reparse_runs
  where id=p_run_id and organization_id=p_organization_id;

  if not found then
    return jsonb_build_object('binding_status','run_not_found','run_id',p_run_id);
  end if;

  select * into t
  from public.commercial_threads
  where id=r.thread_id and organization_id=p_organization_id;

  select * into w
  from public.worker_jobs
  where id=r.source_job_id and organization_id=p_organization_id;

  if w.id is null then
    binding_status := 'source_job_missing';
  elsif w.thread_id=r.thread_id then
    binding_status := 'valid_direct_thread';
  elsif w.source_thread_id is not null
        and t.source_conversation_id is not null
        and w.source_thread_id=t.source_conversation_id::text then
    binding_status := 'valid_source_thread';
  else
    binding_status := 'invalid_unbound_source_job';
  end if;

  return jsonb_build_object(
    'binding_status',binding_status,
    'run_id',r.id,
    'thread_id',r.thread_id,
    'source_job_id',r.source_job_id,
    'thread_source_conversation_id',t.source_conversation_id,
    'job_thread_id',w.thread_id,
    'job_source_thread_id',w.source_thread_id,
    'job_filename',w.filename,
    'job_dataset_id',w.dataset_id,
    'run_source_storage_path',r.source_storage_path
  );
end;
$$;

revoke all on function private.offer_reparse_source_binding_state(uuid,bigint)
from public,anon;
grant execute on function private.offer_reparse_source_binding_state(uuid,bigint)
to authenticated,service_role;

create or replace function public.p1_offer_reparse_provenance_audit(
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
    with audited as (
      select
        r.id run_id,
        r.thread_id,
        r.remediation_queue_id,
        r.status run_status,
        r.source_job_id,
        private.offer_reparse_source_binding_state(p_organization_id,r.id) binding,
        i.id invalidation_id,
        i.reason invalidation_reason,
        i.invalidated_at
      from public.commercial_offer_reparse_runs r
      left join public.commercial_offer_reparse_run_invalidations i
        on i.organization_id=r.organization_id and i.run_id=r.id
      where r.organization_id=p_organization_id
      order by r.id
      limit greatest(1,least(coalesce(p_limit,100),500))
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'run_count',(select count(*) from audited),
        'valid_direct_thread',(select count(*) from audited where binding->>'binding_status'='valid_direct_thread'),
        'valid_source_thread',(select count(*) from audited where binding->>'binding_status'='valid_source_thread'),
        'invalid_unbound_source_job',(select count(*) from audited where binding->>'binding_status'='invalid_unbound_source_job'),
        'source_job_missing',(select count(*) from audited where binding->>'binding_status'='source_job_missing'),
        'quarantined',(select count(*) from audited where invalidation_id is not null)
      ),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'run_id',run_id,
          'thread_id',thread_id,
          'remediation_queue_id',remediation_queue_id,
          'run_status',run_status,
          'source_job_id',source_job_id,
          'binding_status',binding->>'binding_status',
          'binding',binding,
          'invalidation_id',invalidation_id,
          'invalidation_reason',invalidation_reason,
          'invalidated_at',invalidated_at
        ) order by run_id)
        from audited
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'dataset_only_source_binding_allowed',false,
        'thread_binding_required',true,
        'quarantine_preserves_candidate_evidence',true,
        'quarantined_candidate_review_allowed',false,
        'automatic_remediation_resolution',false
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_reparse_provenance_audit(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_reparse_provenance_audit(uuid,integer)
to authenticated,service_role;

create or replace function private.invalidate_offer_reparse_run_impl(
  p_organization_id uuid,
  p_run_id bigint,
  p_reason text default 'source_job_not_thread_bound',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid := (select auth.uid());
  r public.commercial_offer_reparse_runs%rowtype;
  existing public.commercial_offer_reparse_run_invalidations%rowtype;
  binding jsonb;
  new_id bigint;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;
  if p_run_id is null or p_run_id<=0 then
    raise exception 'valid run id required' using errcode='22023';
  end if;
  if p_reason not in (
    'source_job_not_thread_bound',
    'source_payload_mismatch',
    'manual_provenance_invalid'
  ) then
    raise exception 'unsupported invalidation reason' using errcode='22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'offer-reparse-invalidate:'||p_organization_id::text||':'||p_run_id::text,0));

  select * into r
  from public.commercial_offer_reparse_runs
  where id=p_run_id and organization_id=p_organization_id
  for update;

  if not found then
    return jsonb_build_object('status','blocked','reason','run_not_found');
  end if;

  select * into existing
  from public.commercial_offer_reparse_run_invalidations
  where organization_id=p_organization_id and run_id=r.id;

  if found then
    return jsonb_build_object(
      'status','already_quarantined',
      'run_id',r.id,
      'invalidation_id',existing.id,
      'reason',existing.reason
    );
  end if;

  if exists (
    select 1 from public.commercial_offer_reparse_candidate_decisions d
    where d.organization_id=p_organization_id and d.run_id=r.id
  ) then
    return jsonb_build_object(
      'status','blocked',
      'reason','candidate_decisions_already_exist',
      'run_id',r.id
    );
  end if;

  binding := private.offer_reparse_source_binding_state(p_organization_id,r.id);

  if p_reason='source_job_not_thread_bound'
     and binding->>'binding_status' in ('valid_direct_thread','valid_source_thread') then
    return jsonb_build_object(
      'status','blocked',
      'reason','source_binding_is_valid',
      'run_id',r.id,
      'binding',binding
    );
  end if;

  insert into public.commercial_offer_reparse_run_invalidations(
    organization_id,run_id,remediation_queue_id,thread_id,source_job_id,
    reason,evidence_snapshot,invalidated_by,note
  ) values (
    p_organization_id,r.id,r.remediation_queue_id,r.thread_id,r.source_job_id,
    p_reason,
    jsonb_build_object(
      'binding',binding,
      'run_status',r.status,
      'source_snapshot',r.source_snapshot,
      'candidate_count',(
        select count(*) from public.commercial_offer_reparse_candidates c
        where c.organization_id=p_organization_id and c.run_id=r.id
      )
    ),
    actor_id,
    left(nullif(btrim(coalesce(p_note,'')),''),2000)
  )
  returning id into new_id;

  return jsonb_build_object(
    'status','quarantined',
    'run_id',r.id,
    'invalidation_id',new_id,
    'reason',p_reason,
    'binding_status',binding->>'binding_status',
    'candidate_evidence_preserved',true,
    'candidate_review_allowed',false,
    'automatic_remediation_resolution',false,
    'control_phase','PA2.30.2'
  );
end;
$$;

revoke all on function private.invalidate_offer_reparse_run_impl(uuid,bigint,text,text)
from public,anon;
grant execute on function private.invalidate_offer_reparse_run_impl(uuid,bigint,text,text)
to authenticated,service_role;

create or replace function public.p1_invalidate_offer_reparse_run(
  p_organization_id uuid,
  p_run_id bigint,
  p_reason text default 'source_job_not_thread_bound',
  p_note text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.invalidate_offer_reparse_run_impl(
    p_organization_id,p_run_id,p_reason,p_note
  );
$$;

revoke all on function public.p1_invalidate_offer_reparse_run(uuid,bigint,text,text)
from public,anon;
grant execute on function public.p1_invalidate_offer_reparse_run(uuid,bigint,text,text)
to authenticated,service_role;

-- Preserve PA2.27 implementation for audit, but remove browser access to the bypassable legacy entrypoint.
alter function private.request_offer_source_reparse_impl(uuid,uuid)
rename to request_offer_source_reparse_impl_pa227;

revoke all on function private.request_offer_source_reparse_impl_pa227(uuid,uuid)
from public,anon,authenticated;
grant execute on function private.request_offer_source_reparse_impl_pa227(uuid,uuid)
to service_role;

create or replace function private.request_offer_source_reparse_impl(
  p_organization_id uuid,
  p_thread_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid := (select auth.uid());
  t public.commercial_threads%rowtype;
  strict_job_id uuid;
  existing_run_id bigint;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode='28000';
  end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;

  select * into t
  from public.commercial_threads
  where organization_id=p_organization_id and id=p_thread_id;

  if not found then
    return jsonb_build_object('status','blocked','reason','thread_not_found');
  end if;

  select r.id into existing_run_id
  from public.commercial_offer_reparse_runs r
  join public.commercial_offer_reparse_run_invalidations i
    on i.organization_id=r.organization_id and i.run_id=r.id
  where r.organization_id=p_organization_id
    and r.thread_id=p_thread_id
  order by r.id desc
  limit 1;

  if existing_run_id is not null then
    return jsonb_build_object(
      'status','blocked',
      'reason','previous_run_provenance_invalid',
      'run_id',existing_run_id,
      'reingest_required',true
    );
  end if;

  select w.id into strict_job_id
  from public.worker_jobs w
  where w.organization_id=p_organization_id
    and w.storage_path is not null
    and (
      w.thread_id=p_thread_id
      or (
        w.source_thread_id is not null
        and t.source_conversation_id is not null
        and w.source_thread_id=t.source_conversation_id::text
      )
    )
  order by
    case when w.thread_id=p_thread_id then 1 else 2 end,
    w.completed_at desc nulls last,
    w.created_at desc
  limit 1;

  if strict_job_id is null then
    return jsonb_build_object(
      'status','blocked',
      'reason','original_source_job_not_thread_bound',
      'thread_id',p_thread_id,
      'reingest_required',true
    );
  end if;

  return private.request_offer_source_reparse_impl_pa227(
    p_organization_id,p_thread_id
  );
end;
$$;

revoke all on function private.request_offer_source_reparse_impl(uuid,uuid)
from public,anon;
grant execute on function private.request_offer_source_reparse_impl(uuid,uuid)
to authenticated,service_role;

create or replace function public.p1_request_offer_source_reparse(
  p_organization_id uuid,
  p_thread_id uuid
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.request_offer_source_reparse_impl(p_organization_id,p_thread_id);
$$;

revoke all on function public.p1_request_offer_source_reparse(uuid,uuid)
from public,anon;
grant execute on function public.p1_request_offer_source_reparse(uuid,uuid)
to authenticated,service_role;

create or replace function public.p1_offer_source_reparse_readiness(
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
        t.subject,
        t.source_conversation_id,
        r.id existing_run_id,
        r.status run_status,
        i.id invalidation_id,
        (
          select w.id
          from public.worker_jobs w
          where w.organization_id=q.organization_id
            and w.storage_path is not null
            and (
              w.thread_id=q.thread_id
              or (
                w.source_thread_id is not null
                and t.source_conversation_id is not null
                and w.source_thread_id=t.source_conversation_id::text
              )
            )
          order by
            case when w.thread_id=q.thread_id then 1 else 2 end,
            w.completed_at desc nulls last,
            w.created_at desc
          limit 1
        ) strict_source_job_id
      from public.commercial_offer_remediation_queue q
      join public.commercial_threads t
        on t.organization_id=q.organization_id and t.id=q.thread_id
      left join public.commercial_offer_reparse_runs r
        on r.organization_id=q.organization_id and r.remediation_queue_id=q.id
      left join public.commercial_offer_reparse_run_invalidations i
        on i.organization_id=q.organization_id and i.run_id=r.id
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
        and q.status='pending'
    ),
    enriched as (
      select
        x.*,
        w.filename source_filename,
        w.storage_path,
        w.status source_job_status,
        case
          when x.invalidation_id is not null then 'source_provenance_invalid'
          when x.existing_run_id is not null then 'already_requested'
          when x.strict_source_job_id is null then 'missing_thread_bound_source'
          when w.status is distinct from 'completed' then 'source_job_not_completed'
          else 'ready'
        end readiness_status
      from target x
      left join public.worker_jobs w on w.id=x.strict_source_job_id
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'target_threads',(select count(*) from enriched),
        'ready',(select count(*) from enriched where readiness_status='ready'),
        'already_requested',(select count(*) from enriched where readiness_status='already_requested'),
        'source_provenance_invalid',(select count(*) from enriched where readiness_status='source_provenance_invalid'),
        'missing_thread_bound_source',(select count(*) from enriched where readiness_status='missing_thread_bound_source'),
        'source_job_not_completed',(select count(*) from enriched where readiness_status='source_job_not_completed')
      ),
      'threads',coalesce((
        select jsonb_agg(jsonb_build_object(
          'remediation_queue_id',e.remediation_queue_id,
          'thread_id',e.thread_id,
          'subject',e.subject,
          'source_job_id',e.strict_source_job_id,
          'source_filename',e.source_filename,
          'source_job_status',e.source_job_status,
          'readiness_status',e.readiness_status,
          'run_id',e.existing_run_id,
          'run_status',e.run_status,
          'reingest_required',(e.readiness_status in ('source_provenance_invalid','missing_thread_bound_source'))
        ) order by e.thread_id)
        from (
          select * from enriched
          limit greatest(1,least(coalesce(p_limit,100),500))
        ) e
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'source_binding_requires_thread_identity',true,
        'dataset_only_source_binding_allowed',false,
        'candidate_only',true,
        'observation_mutation',false,
        'automatic_promotion',false,
        'automatic_remediation_resolution',false,
        'reingest_required_when_source_missing',true
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_source_reparse_readiness(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_source_reparse_readiness(uuid,integer)
to authenticated,service_role;

-- Quarantine guard for candidate review.
alter function public.p1_offer_reparse_candidate_review(uuid,integer)
rename to p1_offer_reparse_candidate_review_pa229;

revoke all on function public.p1_offer_reparse_candidate_review_pa229(uuid,integer)
from public,anon,authenticated;
grant execute on function public.p1_offer_reparse_candidate_review_pa229(uuid,integer)
to service_role;

create or replace function private.offer_reparse_candidate_review_guarded_impl(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  base jsonb;
  filtered_items jsonb;
begin
  if (select auth.uid()) is null
     or not public.is_organization_member(p_organization_id,false) then
    raise exception 'organization access denied' using errcode='42501';
  end if;

  base := public.p1_offer_reparse_candidate_review_pa229(
    p_organization_id,
    greatest(1,least(coalesce(p_limit,100),500))
  );

  select coalesce(jsonb_agg(item order by (item->>'candidate_id')::bigint),'[]'::jsonb)
  into filtered_items
  from jsonb_array_elements(coalesce(base->'items','[]'::jsonb)) item
  where not exists (
    select 1
    from public.commercial_offer_reparse_run_invalidations i
    where i.organization_id=p_organization_id
      and i.run_id=(item->>'run_id')::bigint
  );

  return jsonb_build_object(
    'summary',jsonb_build_object(
      'candidate_count',jsonb_array_length(filtered_items),
      'pending_review',(
        select count(*) from jsonb_array_elements(filtered_items) x
        where x->>'review_status'='pending_review'
      ),
      'accepted',(
        select count(*) from jsonb_array_elements(filtered_items) x
        where x->>'review_status'='accepted'
      ),
      'rejected',(
        select count(*) from jsonb_array_elements(filtered_items) x
        where x->>'review_status'='rejected'
      ),
      'quarantined',(
        select count(*)
        from public.commercial_offer_reparse_candidates c
        join public.commercial_offer_reparse_run_invalidations i
          on i.organization_id=c.organization_id and i.run_id=c.run_id
        where c.organization_id=p_organization_id
      )
    ),
    'items',filtered_items,
    'policy',coalesce(base->'policy','{}'::jsonb) || jsonb_build_object(
      'quarantined_candidate_review_allowed',false,
      'source_provenance_guard','PA2.30.2'
    )
  );
end;
$$;

revoke all on function private.offer_reparse_candidate_review_guarded_impl(uuid,integer)
from public,anon;
grant execute on function private.offer_reparse_candidate_review_guarded_impl(uuid,integer)
to authenticated,service_role;

create or replace function public.p1_offer_reparse_candidate_review(
  p_organization_id uuid,
  p_limit integer default 100
)
returns jsonb
language sql
stable
security invoker
set search_path=''
as $$
  select private.offer_reparse_candidate_review_guarded_impl(
    p_organization_id,p_limit
  );
$$;

revoke all on function public.p1_offer_reparse_candidate_review(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_reparse_candidate_review(uuid,integer)
to authenticated,service_role;

-- Guard PA2.29 adoption.
alter function private.adopt_offer_reparse_candidate_impl(uuid,bigint,bigint,text[],text)
rename to adopt_offer_reparse_candidate_impl_pa229;

revoke all on function private.adopt_offer_reparse_candidate_impl_pa229(uuid,bigint,bigint,text[],text)
from public,anon,authenticated;
grant execute on function private.adopt_offer_reparse_candidate_impl_pa229(uuid,bigint,bigint,text[],text)
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
begin
  if exists (
    select 1
    from public.commercial_offer_reparse_candidates c
    join public.commercial_offer_reparse_run_invalidations i
      on i.organization_id=c.organization_id and i.run_id=c.run_id
    where c.organization_id=p_organization_id and c.id=p_candidate_id
  ) then
    return jsonb_build_object(
      'status','blocked',
      'reason','run_provenance_invalid',
      'candidate_id',p_candidate_id
    );
  end if;

  return private.adopt_offer_reparse_candidate_impl_pa229(
    p_organization_id,p_candidate_id,p_target_observation_id,p_selected_fields,p_note
  );
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

-- Guard PA2.29 rejection. Quarantine is not a commercial rejection decision.
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
begin
  if exists (
    select 1
    from public.commercial_offer_reparse_candidates c
    join public.commercial_offer_reparse_run_invalidations i
      on i.organization_id=c.organization_id and i.run_id=c.run_id
    where c.organization_id=p_organization_id and c.id=p_candidate_id
  ) then
    return jsonb_build_object(
      'status','blocked',
      'reason','run_provenance_invalid',
      'candidate_id',p_candidate_id
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

-- Closure guard: an invalid source run can never resolve/dismiss a remediation.
alter function private.offer_reparse_remediation_closure_state(uuid,bigint)
rename to offer_reparse_remediation_closure_state_pa230;

revoke all on function private.offer_reparse_remediation_closure_state_pa230(uuid,bigint)
from public,anon,authenticated;
grant execute on function private.offer_reparse_remediation_closure_state_pa230(uuid,bigint)
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
  invalid_run record;
begin
  select r.id run_id,r.thread_id,i.reason,i.invalidated_at
  into invalid_run
  from public.commercial_offer_reparse_runs r
  join public.commercial_offer_reparse_run_invalidations i
    on i.organization_id=r.organization_id and i.run_id=r.id
  where r.organization_id=p_organization_id
    and r.remediation_queue_id=p_remediation_queue_id
  order by r.id desc
  limit 1;

  if found then
    return jsonb_build_object(
      'remediation_queue_id',p_remediation_queue_id,
      'thread_id',invalid_run.thread_id,
      'run_id',invalid_run.run_id,
      'closure_status','run_provenance_invalid',
      'resolution_reason',null,
      'recommended_outcome',null,
      'invalidation_reason',invalid_run.reason,
      'invalidated_at',invalid_run.invalidated_at,
      'reingest_required',true,
      'requires_explicit_close',false,
      'automatic_closure',false
    );
  end if;

  return private.offer_reparse_remediation_closure_state_pa230(
    p_organization_id,p_remediation_queue_id
  );
end;
$$;

revoke all on function private.offer_reparse_remediation_closure_state(uuid,bigint)
from public,anon;
grant execute on function private.offer_reparse_remediation_closure_state(uuid,bigint)
to authenticated,service_role;

alter function private.close_offer_reparse_remediation_impl(uuid,bigint,text)
rename to close_offer_reparse_remediation_impl_pa230;

revoke all on function private.close_offer_reparse_remediation_impl_pa230(uuid,bigint,text)
from public,anon,authenticated;
grant execute on function private.close_offer_reparse_remediation_impl_pa230(uuid,bigint,text)
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
begin
  if exists (
    select 1
    from public.commercial_offer_reparse_runs r
    join public.commercial_offer_reparse_run_invalidations i
      on i.organization_id=r.organization_id and i.run_id=r.id
    where r.organization_id=p_organization_id
      and r.remediation_queue_id=p_remediation_queue_id
  ) then
    return jsonb_build_object(
      'status','blocked',
      'reason','run_provenance_invalid',
      'remediation_queue_id',p_remediation_queue_id,
      'reingest_required',true
    );
  end if;

  return private.close_offer_reparse_remediation_impl_pa230(
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

create or replace function public.p1_offer_reparse_remediation_closure_readiness(
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
      select private.offer_reparse_remediation_closure_state(
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
        'ready_resolve',(select count(*) from states where state->>'closure_status'='ready_resolve'),
        'ready_dismiss',(select count(*) from states where state->>'closure_status' in (
          'ready_dismiss_no_candidates','ready_dismiss_no_recovery'
        )),
        'waiting_on_run',(select count(*) from states where state->>'closure_status' in (
          'run_queued','run_processing'
        )),
        'run_failed',(select count(*) from states where state->>'closure_status'='run_failed'),
        'run_provenance_invalid',(select count(*) from states where state->>'closure_status'='run_provenance_invalid'),
        'candidate_decisions_pending',(select count(*) from states where state->>'closure_status' in (
          'candidates_pending','decisions_incomplete'
        )),
        'conflict_review_required',(select count(*) from states where state->>'closure_status'='conflict_review_required'),
        'residual_evidence_gap',(select count(*) from states where state->>'closure_status'='residual_evidence_gap'),
        'already_closed',(select count(*) from states where state->>'closure_status'='already_closed')
      ),
      'items',coalesce((
        select jsonb_agg(state order by (state->>'remediation_queue_id')::bigint)
        from states
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'explicit_close_required',true,
        'automatic_closure',false,
        'invalid_source_run_closure_allowed',false,
        'reingest_required_after_provenance_invalidation',true,
        'observation_mutation',false,
        'promotion_mutation',false
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_reparse_remediation_closure_readiness(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_reparse_remediation_closure_readiness(uuid,integer)
to authenticated,service_role;
