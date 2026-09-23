-- PA2.30.3b — Bulk archive source recovery selection.
-- Batch automation is allowed only when one offered source filename is unique.

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
        ) expected_source_filenames,
        (
          select coalesce(jsonb_agg(distinct o.source_filename order by o.source_filename),'[]'::jsonb)
          from public.commercial_observations o
          where o.organization_id=q.organization_id
            and o.thread_id=q.thread_id
            and o.source_filename is not null
            and o.item_role='offered'
        ) offered_source_filenames
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
    ),
    enriched as (
      select
        target.*,
        case
          when jsonb_array_length(offered_source_filenames)=1
            then offered_source_filenames->>0
          else null
        end preferred_source_filename,
        case
          when jsonb_array_length(offered_source_filenames)=1 then 'unique_offered_source'
          when jsonb_array_length(offered_source_filenames)>1 then 'ambiguous_offered_source'
          else 'missing_offered_source'
        end source_selection_status
      from target
    )
    select jsonb_build_object(
      'summary',jsonb_build_object(
        'target_threads',(select count(*) from enriched),
        'needs_reingest',(select count(*) from enriched where invalidated_run_id is not null and reingest_id is null),
        'requested',(select count(*) from enriched where reingest_status='requested'),
        'uploading',(select count(*) from enriched where reingest_status='uploading'),
        'recovered',(select count(*) from enriched where reingest_status='consumed'),
        'failed',(select count(*) from enriched where reingest_status='failed'),
        'batch_auto_match_ready',(select count(*) from enriched
          where invalidated_run_id is not null
            and coalesce(reingest_status,'') not in ('uploading','consumed')
            and source_selection_status='unique_offered_source'),
        'batch_ambiguous',(select count(*) from enriched
          where invalidated_run_id is not null
            and coalesce(reingest_status,'') not in ('uploading','consumed')
            and source_selection_status='ambiguous_offered_source')
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
          'offered_source_filenames',x.offered_source_filenames,
          'preferred_source_filename',x.preferred_source_filename,
          'source_selection_status',x.source_selection_status,
          'action_status',case
            when x.invalidated_run_id is null then 'not_required'
            when x.reingest_status='consumed' then 'recovered'
            when x.reingest_status='requested' then 'awaiting_upload'
            when x.reingest_status='uploading' then 'uploading'
            when x.reingest_status='failed' then 'retry_allowed'
            else 'needs_reingest'
          end
        ) order by x.thread_id)
        from (
          select * from enriched
          limit greatest(1,least(coalesce(p_limit,100),500))
        ) x
      ),'[]'::jsonb),
      'policy',jsonb_build_object(
        'allowed_extensions',jsonb_build_array('.eml'),
        'bulk_archive_extension','.zip',
        'source_only',true,
        'thread_binding_required',true,
        'checksum_required',true,
        'observation_mutation',false,
        'automatic_promotion',false,
        'successor_run_candidate_only',true,
        'batch_auto_match_requires_unique_offered_source',true,
        'ambiguous_source_requires_manual_selection',true
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
    return jsonb_build_object('status','claimed','reingest_id',s.id);
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
    return jsonb_build_object(
      'status','blocked',
      'reason','source_filename_evidence_missing'
    );
  end if;

  if jsonb_array_length(offered_source_filenames)=1 then
    preferred_source_filename := offered_source_filenames->>0;
    source_selection_status := 'unique_offered_source';
  elsif jsonb_array_length(offered_source_filenames)>1 then
    source_selection_status := 'ambiguous_offered_source';
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
