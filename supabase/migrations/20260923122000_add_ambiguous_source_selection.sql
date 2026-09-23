-- PA2.30.4 — Ambiguous Source Selection & Controlled Recovery

alter table public.commercial_offer_source_reingests
  add column if not exists selected_source_filename text,
  add column if not exists source_selection_mode text
    check (source_selection_mode is null or source_selection_mode in ('unique_offered_source','manual_offered_source')),
  add column if not exists selected_by uuid references auth.users(id) on delete restrict,
  add column if not exists selected_at timestamptz;

create index if not exists commercial_offer_source_reingests_selected_by_idx
  on public.commercial_offer_source_reingests(selected_by)
  where selected_by is not null;

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
  offered_source_filenames jsonb;
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

  select coalesce(
    jsonb_agg(distinct o.source_filename order by o.source_filename)
      filter(where o.source_filename is not null and o.item_role='offered'),
    '[]'::jsonb
  )
  into offered_source_filenames
  from public.commercial_observations o
  where o.organization_id=p_organization_id
    and o.thread_id=p_thread_id;

  if jsonb_array_length(offered_source_filenames)>1 then
    return jsonb_build_object(
      'status','blocked',
      'reason','ambiguous_source_selection_required',
      'thread_id',p_thread_id,
      'offered_source_filenames',offered_source_filenames
    );
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
    requested_by,note,selected_source_filename,source_selection_mode,selected_by,selected_at
  ) values (
    p_organization_id,q.id,p_thread_id,invalid_run.id,actor_id,
    left(nullif(btrim(coalesce(p_note,'')),''),2000),
    case when jsonb_array_length(offered_source_filenames)=1 then offered_source_filenames->>0 else null end,
    case when jsonb_array_length(offered_source_filenames)=1 then 'unique_offered_source' else null end,
    case when jsonb_array_length(offered_source_filenames)=1 then actor_id else null end,
    case when jsonb_array_length(offered_source_filenames)=1 then now() else null end
  ) returning id into recovery_id;

  return jsonb_build_object(
    'status','requested',
    'reingest_id',recovery_id,
    'thread_id',p_thread_id,
    'remediation_queue_id',q.id,
    'requested_from_run_id',invalid_run.id,
    'selected_source_filename',
      case when jsonb_array_length(offered_source_filenames)=1 then offered_source_filenames->>0 else null end,
    'source_selection_mode',
      case when jsonb_array_length(offered_source_filenames)=1 then 'unique_offered_source' else null end,
    'allowed_extensions',jsonb_build_array('.eml'),
    'source_only',true,
    'automatic_observation_promotion',false,
    'successor_reparse_candidate_only',true,
    'control_phase','PA2.30.4'
  );
end;
$$;

revoke all on function private.request_offer_source_reingest_impl(uuid,uuid,text)
from public,anon;
grant execute on function private.request_offer_source_reingest_impl(uuid,uuid,text)
to authenticated,service_role;

create or replace function private.request_offer_source_reingest_selection_impl(
  p_organization_id uuid,
  p_thread_id uuid,
  p_source_filename text,
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
  existing public.commercial_offer_source_reingests%rowtype;
  recovery_id bigint;
  normalized_source text := nullif(btrim(coalesce(p_source_filename,'')),'');
begin
  if actor_id is null then raise exception 'authentication required' using errcode='28000'; end if;
  if not public.is_organization_member(p_organization_id,true) then
    raise exception 'active organization write membership required' using errcode='42501';
  end if;
  if normalized_source is null then
    return jsonb_build_object('status','blocked','reason','source_selection_required');
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

  if not exists (
    select 1
    from public.commercial_observations o
    where o.organization_id=p_organization_id
      and o.thread_id=p_thread_id
      and o.item_role='offered'
      and o.source_filename=normalized_source
  ) then
    return jsonb_build_object(
      'status','blocked',
      'reason','selected_source_not_offered_evidence',
      'selected_source_filename',normalized_source
    );
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

  select * into existing
  from public.commercial_offer_source_reingests
  where organization_id=p_organization_id
    and remediation_queue_id=q.id
    and status in ('requested','uploading')
  order by id desc limit 1;

  if found then
    if existing.selected_source_filename=normalized_source then
      return jsonb_build_object(
        'status','already_requested',
        'reingest_id',existing.id,
        'thread_id',p_thread_id,
        'remediation_queue_id',q.id,
        'selected_source_filename',existing.selected_source_filename,
        'source_selection_mode',existing.source_selection_mode
      );
    end if;
    return jsonb_build_object(
      'status','blocked',
      'reason','active_reingest_selection_conflict',
      'reingest_id',existing.id,
      'selected_source_filename',existing.selected_source_filename
    );
  end if;

  insert into public.commercial_offer_source_reingests(
    organization_id,remediation_queue_id,thread_id,requested_from_run_id,
    requested_by,note,selected_source_filename,source_selection_mode,selected_by,selected_at
  ) values (
    p_organization_id,q.id,p_thread_id,invalid_run.id,actor_id,
    left(nullif(btrim(coalesce(p_note,'')),''),2000),
    normalized_source,'manual_offered_source',actor_id,now()
  ) returning id into recovery_id;

  return jsonb_build_object(
    'status','requested',
    'reingest_id',recovery_id,
    'thread_id',p_thread_id,
    'remediation_queue_id',q.id,
    'requested_from_run_id',invalid_run.id,
    'selected_source_filename',normalized_source,
    'source_selection_mode','manual_offered_source',
    'source_only',true,
    'automatic_source_selection',false,
    'automatic_observation_promotion',false,
    'successor_reparse_candidate_only',true,
    'control_phase','PA2.30.4'
  );
end;
$$;

revoke all on function private.request_offer_source_reingest_selection_impl(uuid,uuid,text,text)
from public,anon;
grant execute on function private.request_offer_source_reingest_selection_impl(uuid,uuid,text,text)
to authenticated,service_role;

create or replace function public.p1_request_offer_source_reingest_selection(
  p_organization_id uuid,
  p_thread_id uuid,
  p_source_filename text,
  p_note text default null
)
returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.request_offer_source_reingest_selection_impl(
    p_organization_id,p_thread_id,p_source_filename,p_note
  );
$$;

revoke all on function public.p1_request_offer_source_reingest_selection(uuid,uuid,text,text)
from public,anon;
grant execute on function public.p1_request_offer_source_reingest_selection(uuid,uuid,text,text)
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
  offered_source_filenames jsonb;
  preferred_source_filename text;
  source_selection_status text;
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
    return jsonb_build_object(
      'status','claimed',
      'reingest_id',s.id,
      'selected_source_filename',s.selected_source_filename,
      'source_selection_mode',s.source_selection_mode
    );
  end if;
  if s.status<>'requested' then
    return jsonb_build_object('status','not_claimable','reingest_status',s.status);
  end if;

  select * into t
  from public.commercial_threads
  where organization_id=s.organization_id and id=s.thread_id;

  select
    coalesce(jsonb_agg(distinct o.source_filename order by o.source_filename)
      filter(where o.source_filename is not null),'[]'::jsonb),
    coalesce(jsonb_agg(distinct o.source_filename order by o.source_filename)
      filter(where o.source_filename is not null and o.item_role='offered'),'[]'::jsonb)
  into expected_source_filenames,offered_source_filenames
  from public.commercial_observations o
  where o.organization_id=s.organization_id
    and o.thread_id=s.thread_id;

  if jsonb_array_length(expected_source_filenames)=0 then
    return jsonb_build_object('status','blocked','reason','source_filename_evidence_missing');
  end if;

  if s.selected_source_filename is not null then
    preferred_source_filename := s.selected_source_filename;
    source_selection_status := case
      when s.source_selection_mode='manual_offered_source' then 'manually_selected_offered_source'
      else 'unique_offered_source'
    end;
  elsif jsonb_array_length(offered_source_filenames)=1 then
    preferred_source_filename := offered_source_filenames->>0;
    source_selection_status := 'unique_offered_source';
  elsif jsonb_array_length(offered_source_filenames)>1 then
    return jsonb_build_object(
      'status','blocked',
      'reason','ambiguous_source_selection_required',
      'offered_source_filenames',offered_source_filenames
    );
  else
    source_selection_status := 'missing_offered_source';
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
    'offered_source_filenames',offered_source_filenames,
    'preferred_source_filename',preferred_source_filename,
    'selected_source_filename',s.selected_source_filename,
    'source_selection_mode',s.source_selection_mode,
    'source_selection_status',source_selection_status,
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

  if s.selected_source_filename is not null then
    if lower(regexp_replace(s.selected_source_filename,'^.*/','')) <> lower(p_filename) then
      raise exception 'uploaded EML filename does not match the explicitly selected source'
        using errcode='22023';
    end if;
  elsif not exists (
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
    p_source_job_id,p_filename,'.eml',p_size_bytes,p_storage_path,'completed','v4','source_reingest',
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
      'source_selection_mode',s.source_selection_mode,
      'selected_source_filename',s.selected_source_filename,
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
    'selected_source_filename',s.selected_source_filename,
    'source_selection_mode',s.source_selection_mode,
    'source_binding','direct_thread',
    'candidate_only',true,
    'observation_mutation',false,
    'automatic_promotion',false,
    'control_phase','PA2.30.4'
  );
end;
$$;

revoke all on function public.p1_complete_offer_source_reingest(bigint,uuid,text,text,text,bigint)
from public,anon,authenticated;
grant execute on function public.p1_complete_offer_source_reingest(bigint,uuid,text,text,text,bigint)
to service_role;
