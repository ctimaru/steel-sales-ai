-- PA2.30.3 — Source Re-ingest & Provenance Recovery.
-- Recovered source is stored source-only, bound to one quarantined remediation,
-- and creates a successor candidate-only reparse run. No observation promotion.

alter table public.commercial_offer_reparse_runs
  add column if not exists supersedes_run_id bigint
    references public.commercial_offer_reparse_runs(id) on delete restrict;

alter table public.commercial_offer_reparse_runs
  drop constraint if exists commercial_offer_reparse_runs_organization_id_remediation_q_key;

create unique index if not exists commercial_offer_reparse_runs_supersedes_uq
  on public.commercial_offer_reparse_runs(supersedes_run_id)
  where supersedes_run_id is not null;

create table if not exists public.commercial_offer_source_reingests (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  remediation_queue_id bigint not null references public.commercial_offer_remediation_queue(id) on delete restrict,
  thread_id uuid not null references public.commercial_threads(id) on delete restrict,
  requested_from_run_id bigint not null references public.commercial_offer_reparse_runs(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  status text not null default 'requested'
    check (status in ('requested','uploading','consumed','failed')),
  source_job_id uuid references public.worker_jobs(id) on delete restrict,
  successor_run_id bigint references public.commercial_offer_reparse_runs(id) on delete restrict,
  filename text,
  storage_path text,
  content_checksum text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  note text,
  unique(successor_run_id)
);

create index if not exists commercial_offer_source_reingests_org_idx
  on public.commercial_offer_source_reingests(organization_id,requested_at desc);
create index if not exists commercial_offer_source_reingests_remediation_idx
  on public.commercial_offer_source_reingests(remediation_queue_id,requested_at desc);
create index if not exists commercial_offer_source_reingests_thread_idx
  on public.commercial_offer_source_reingests(thread_id,requested_at desc);
create index if not exists commercial_offer_source_reingests_requested_by_idx
  on public.commercial_offer_source_reingests(requested_by,requested_at desc);
create index if not exists commercial_offer_source_reingests_source_job_idx
  on public.commercial_offer_source_reingests(source_job_id);
create unique index if not exists commercial_offer_source_reingests_active_uq
  on public.commercial_offer_source_reingests(organization_id,remediation_queue_id)
  where status in ('requested','uploading');

alter table public.commercial_offer_source_reingests enable row level security;
revoke all on public.commercial_offer_source_reingests from public,anon,authenticated;
grant select on public.commercial_offer_source_reingests to authenticated,service_role;
grant insert,update on public.commercial_offer_source_reingests to service_role;
grant usage,select on sequence public.commercial_offer_source_reingests_id_seq to service_role;

drop policy if exists commercial_offer_source_reingests_member_select
on public.commercial_offer_source_reingests;
create policy commercial_offer_source_reingests_member_select
on public.commercial_offer_source_reingests
for select to authenticated
using (public.is_organization_member(organization_id,false));

create or replace function private.request_offer_source_reingest_impl(
  p_organization_id uuid,
  p_thread_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  actor_id uuid := (select auth.uid());
  q public.commercial_offer_remediation_queue%rowtype;
  invalid_run public.commercial_offer_reparse_runs%rowtype;
  existing_id bigint;
  recovery_id bigint;
begin
  if actor_id is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'offer-source-reingest:'||p_organization_id::text||':'||p_thread_id::text,0));

  select * into q
  from public.commercial_offer_remediation_queue
  where organization_id=p_organization_id
    and thread_id=p_thread_id
    and category='source_reparse_required'
    and recommended_action='source_email_reparse'
    and status='pending'
  order by id desc limit 1;

  if not found then
    return jsonb_build_object('status','blocked','reason','pending_remediation_not_found');
  end if;

  select r.* into invalid_run
  from public.commercial_offer_reparse_runs r
  join public.commercial_offer_reparse_run_invalidations i
    on i.organization_id=r.organization_id and i.run_id=r.id
  where r.organization_id=p_organization_id
    and r.remediation_queue_id=q.id
  order by r.id desc limit 1;

  if not found then
    return jsonb_build_object('status','blocked','reason','quarantined_run_not_found');
  end if;

  select id into existing_id
  from public.commercial_offer_source_reingests
  where organization_id=p_organization_id
    and remediation_queue_id=q.id
    and status in ('requested','uploading')
  order by id desc limit 1;

  if existing_id is not null then
    return jsonb_build_object(
      'status','already_requested','reingest_id',existing_id,
      'thread_id',p_thread_id,'remediation_queue_id',q.id
    );
  end if;

  insert into public.commercial_offer_source_reingests(
    organization_id,remediation_queue_id,thread_id,requested_from_run_id,
    requested_by,note
  ) values (
    p_organization_id,q.id,p_thread_id,invalid_run.id,actor_id,
    left(nullif(btrim(coalesce(p_note,'')),''),2000)
  ) returning id into recovery_id;

  return jsonb_build_object(
    'status','requested',
    'reingest_id',recovery_id,
    'thread_id',p_thread_id,
    'remediation_queue_id',q.id,
    'requested_from_run_id',invalid_run.id,
    'allowed_extensions',jsonb_build_array('.eml'),
    'source_only',true,
    'automatic_observation_promotion',false,
    'successor_reparse_candidate_only',true,
    'control_phase','PA2.30.3'
  );
end;
$$;

revoke all on function private.request_offer_source_reingest_impl(uuid,uuid,text)
from public,anon;
grant execute on function private.request_offer_source_reingest_impl(uuid,uuid,text)
to authenticated,service_role;

create or replace function public.p1_request_offer_source_reingest(
  p_organization_id uuid,
  p_thread_id uuid,
  p_note text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.request_offer_source_reingest_impl(
    p_organization_id,p_thread_id,p_note
  );
$$;

revoke all on function public.p1_request_offer_source_reingest(uuid,uuid,text)
from public,anon;
grant execute on function public.p1_request_offer_source_reingest(uuid,uuid,text)
to authenticated,service_role;

create or replace function public.p1_offer_source_reingest_readiness(
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
        ir.id invalidated_run_id,
        sr.id reingest_id,
        sr.status reingest_status,
        sr.source_job_id,
        sr.successor_run_id,
        sr.filename,
        sr.error,
        (
          select coalesce(jsonb_agg(distinct o.source_filename order by o.source_filename),'[]'::jsonb)
          from public.commercial_observations o
          where o.organization_id=q.organization_id
            and o.thread_id=q.thread_id
            and o.source_filename is not null
        ) expected_source_filenames
      from public.commercial_offer_remediation_queue q
      join public.commercial_threads t
        on t.organization_id=q.organization_id and t.id=q.thread_id
      left join lateral (
        select r.id
        from public.commercial_offer_reparse_runs r
        join public.commercial_offer_reparse_run_invalidations i
          on i.organization_id=r.organization_id and i.run_id=r.id
        where r.organization_id=q.organization_id
          and r.remediation_queue_id=q.id
        order by r.id desc limit 1
      ) ir on true
      left join lateral (
        select s.*
        from public.commercial_offer_source_reingests s
        where s.organization_id=q.organization_id
          and s.remediation_queue_id=q.id
        order by s.id desc limit 1
      ) sr on true
      where q.organization_id=p_organization_id
        and q.category='source_reparse_required'
        and q.recommended_action='source_email_reparse'
        and q.status='pending'
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'target_threads',(select count(*) from target),
        'needs_reingest',(select count(*) from target where invalidated_run_id is not null and reingest_id is null),
        'requested',(select count(*) from target where reingest_status='requested'),
        'uploading',(select count(*) from target where reingest_status='uploading'),
        'recovered',(select count(*) from target where reingest_status='consumed'),
        'failed',(select count(*) from target where reingest_status='failed')
      ),
      'items',coalesce((
        select jsonb_agg(jsonb_build_object(
          'remediation_queue_id',x.remediation_queue_id,
          'thread_id',x.thread_id,
          'subject',x.subject,
          'source_conversation_id',x.source_conversation_id,
          'invalidated_run_id',x.invalidated_run_id,
          'reingest_id',x.reingest_id,
          'reingest_status',x.reingest_status,
          'source_job_id',x.source_job_id,
          'successor_run_id',x.successor_run_id,
          'filename',x.filename,
          'error',x.error,
          'expected_source_filenames',x.expected_source_filenames,
          'action_status',case
            when x.invalidated_run_id is null then 'not_required'
            when x.reingest_status='consumed' then 'recovered'
            when x.reingest_status='requested' then 'awaiting_upload'
            when x.reingest_status='uploading' then 'uploading'
            when x.reingest_status='failed' then 'retry_allowed'
            else 'needs_reingest'
          end
        ) order by x.thread_id)
        from (select * from target limit greatest(1,least(coalesce(p_limit,100),500))) x
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'allowed_extensions',jsonb_build_array('.eml'),
        'source_only',true,
        'thread_binding_required',true,
        'checksum_required',true,
        'observation_mutation',false,
        'automatic_promotion',false,
        'successor_run_candidate_only',true
      )
    )
  );
end;
$$;

revoke all on function public.p1_offer_source_reingest_readiness(uuid,integer)
from public,anon;
grant execute on function public.p1_offer_source_reingest_readiness(uuid,integer)
to authenticated,service_role;

create or replace function public.p1_claim_offer_source_reingest(
  p_reingest_id bigint,
  p_owner_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  s public.commercial_offer_source_reingests%rowtype;
  t public.commercial_threads%rowtype;
  expected_source_filenames jsonb;
begin
  select * into s
  from public.commercial_offer_source_reingests
  where id=p_reingest_id
  for update;

  if not found then return jsonb_build_object('status','not_found'); end if;
  if s.requested_by<>p_owner_id then
    return jsonb_build_object('status','blocked','reason','owner_mismatch');
  end if;
  if s.status='uploading' then
    return jsonb_build_object('status','claimed','reingest_id',s.id);
  end if;
  if s.status<>'requested' then
    return jsonb_build_object('status','not_claimable','reingest_status',s.status);
  end if;

  select * into t
  from public.commercial_threads
  where organization_id=s.organization_id and id=s.thread_id;

  select coalesce(jsonb_agg(distinct o.source_filename order by o.source_filename),'[]'::jsonb)
  into expected_source_filenames
  from public.commercial_observations o
  where o.organization_id=s.organization_id
    and o.thread_id=s.thread_id
    and o.source_filename is not null;

  if jsonb_array_length(expected_source_filenames)=0 then
    return jsonb_build_object(
      'status','blocked',
      'reason','source_filename_evidence_missing'
    );
  end if;

  update public.commercial_offer_source_reingests
  set status='uploading',started_at=now(),error=null
  where id=s.id;

  return jsonb_build_object(
    'status','claimed','reingest_id',s.id,
    'organization_id',s.organization_id,
    'remediation_queue_id',s.remediation_queue_id,
    'thread_id',s.thread_id,
    'requested_from_run_id',s.requested_from_run_id,
    'owner_id',s.requested_by,
    'dataset_id',t.dataset_id,
    'source_conversation_id',t.source_conversation_id,
    'subject',t.subject,
    'expected_source_filenames',expected_source_filenames,
    'allowed_extensions',jsonb_build_array('.eml'),
    'source_only',true
  );
end;
$$;

revoke all on function public.p1_claim_offer_source_reingest(bigint,uuid)
from public,anon,authenticated;
grant execute on function public.p1_claim_offer_source_reingest(bigint,uuid)
to service_role;

create or replace function public.p1_complete_offer_source_reingest(
  p_reingest_id bigint,
  p_source_job_id uuid,
  p_filename text,
  p_storage_path text,
  p_content_checksum text,
  p_size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  s public.commercial_offer_source_reingests%rowtype;
  t public.commercial_threads%rowtype;
  new_run_id bigint;
  ext text;
begin
  select * into s
  from public.commercial_offer_source_reingests
  where id=p_reingest_id
  for update;

  if not found then return jsonb_build_object('status','not_found'); end if;
  if s.status='consumed' then
    return jsonb_build_object(
      'status','consumed','reingest_id',s.id,
      'source_job_id',s.source_job_id,'successor_run_id',s.successor_run_id
    );
  end if;
  if s.status<>'uploading' then
    return jsonb_build_object('status','not_completable','reingest_status',s.status);
  end if;

  ext := lower(substring(coalesce(p_filename,'') from '(\.[^.]+)$'));
  if ext is distinct from '.eml' then
    raise exception 'source re-ingest requires .eml' using errcode='22023';
  end if;
  if p_storage_path is null or btrim(p_storage_path)='' then
    raise exception 'storage path required' using errcode='22023';
  end if;
  if p_content_checksum is null or p_content_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'sha256 checksum required' using errcode='22023';
  end if;
  if p_size_bytes is null or p_size_bytes<=0 then
    raise exception 'positive source size required' using errcode='22023';
  end if;

  if not exists (
    select 1
    from public.commercial_observations o
    where o.organization_id=s.organization_id
      and o.thread_id=s.thread_id
      and o.source_filename is not null
      and lower(regexp_replace(o.source_filename,'^.*/',''))=lower(p_filename)
  ) then
    raise exception 'uploaded EML filename is not part of the target thread source history'
      using errcode='22023';
  end if;

  select * into t
  from public.commercial_threads
  where organization_id=s.organization_id and id=s.thread_id;

  insert into public.worker_jobs(
    id,filename,extension,size_bytes,storage_path,status,parser_version,input_kind,
    extraction_count,created_at,started_at,completed_at,owner_id,dataset_id,thread_id,
    promoted_observation_count,organization_id,content_checksum,source_thread_id,email_subject
  ) values (
    p_source_job_id,p_filename,'.eml',p_size_bytes,p_storage_path,'completed',null,'source_reingest',
    0,now(),now(),now(),s.requested_by,t.dataset_id,s.thread_id,
    0,s.organization_id,p_content_checksum,t.source_conversation_id::text,t.subject
  );

  insert into public.commercial_offer_reparse_runs(
    organization_id,remediation_queue_id,thread_id,source_job_id,source_storage_path,
    source_checksum,requested_parser_version,status,source_snapshot,requested_by,
    requested_at,supersedes_run_id
  ) values (
    s.organization_id,s.remediation_queue_id,s.thread_id,p_source_job_id,p_storage_path,
    p_content_checksum,'v4','queued',
    jsonb_build_object(
      'source_job_id',p_source_job_id,
      'storage_path',p_storage_path,
      'filename',p_filename,
      'extension','.eml',
      'size_bytes',p_size_bytes,
      'content_checksum',p_content_checksum,
      'source_thread_id',t.source_conversation_id::text,
      'reingest_id',s.id,
      'source_kind','source_reingest',
      'supersedes_run_id',s.requested_from_run_id
    ),
    s.requested_by,now(),s.requested_from_run_id
  ) returning id into new_run_id;

  update public.commercial_offer_source_reingests
  set status='consumed',
      source_job_id=p_source_job_id,
      successor_run_id=new_run_id,
      filename=p_filename,
      storage_path=p_storage_path,
      content_checksum=p_content_checksum,
      size_bytes=p_size_bytes,
      completed_at=now(),
      error=null
  where id=s.id;

  return jsonb_build_object(
    'status','consumed',
    'reingest_id',s.id,
    'source_job_id',p_source_job_id,
    'successor_run_id',new_run_id,
    'supersedes_run_id',s.requested_from_run_id,
    'thread_id',s.thread_id,
    'source_binding','direct_thread',
    'candidate_only',true,
    'observation_mutation',false,
    'automatic_promotion',false,
    'control_phase','PA2.30.3'
  );
end;
$$;

revoke all on function public.p1_complete_offer_source_reingest(bigint,uuid,text,text,text,bigint)
from public,anon,authenticated;
grant execute on function public.p1_complete_offer_source_reingest(bigint,uuid,text,text,text,bigint)
to service_role;

create or replace function public.p1_fail_offer_source_reingest(
  p_reingest_id bigint,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare s public.commercial_offer_source_reingests%rowtype;
begin
  select * into s from public.commercial_offer_source_reingests
  where id=p_reingest_id for update;
  if not found then return jsonb_build_object('status','not_found'); end if;
  if s.status='consumed' then
    return jsonb_build_object('status','not_fail-able','reingest_status',s.status);
  end if;
  update public.commercial_offer_source_reingests
  set status='failed',error=left(coalesce(p_error,'source re-ingest failed'),2000),completed_at=now()
  where id=s.id;
  return jsonb_build_object('status','failed','reingest_id',s.id);
end;
$$;

revoke all on function public.p1_fail_offer_source_reingest(bigint,text)
from public,anon,authenticated;
grant execute on function public.p1_fail_offer_source_reingest(bigint,text)
to service_role;

-- Latest-run closure semantics: an older invalidated run must not poison its valid successor.
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
  latest_run_id bigint;
  latest_thread_id uuid;
  latest_status text;
  invalid_reason text;
  invalidated_at timestamptz;
begin
  select r.id,r.thread_id,r.status into latest_run_id,latest_thread_id,latest_status
  from public.commercial_offer_reparse_runs r
  where r.organization_id=p_organization_id
    and r.remediation_queue_id=p_remediation_queue_id
  order by r.id desc limit 1;

  if latest_run_id is not null then
    select i.reason,i.invalidated_at into invalid_reason,invalidated_at
    from public.commercial_offer_reparse_run_invalidations i
    where i.organization_id=p_organization_id and i.run_id=latest_run_id;
    if found then
      return jsonb_build_object(
        'remediation_queue_id',p_remediation_queue_id,
        'thread_id',latest_thread_id,
        'remediation_status',(
          select q.status
          from public.commercial_offer_remediation_queue q
          where q.organization_id=p_organization_id and q.id=p_remediation_queue_id
        ),
        'run_id',latest_run_id,
        'run_status',latest_status,
        'candidate_count',0,
        'pending_candidate_count',0,
        'accepted_count',0,
        'rejected_count',0,
        'decision_count',0,
        'residual_gaps',jsonb_build_object('quantity',0,'price',0,'currency',0),
        'unresolved_conflict_count',0,
        'unresolved_conflicts','[]'::jsonb,
        'closure_status','run_provenance_invalid',
        'recommended_outcome',null,
        'resolution_reason',null,
        'invalidation_reason',invalid_reason,
        'invalidated_at',invalidated_at,
        'reingest_required',true,
        'requires_explicit_close',false,
        'automatic_closure',false
      );
    end if;
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
