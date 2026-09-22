-- PA2.7 — structured message identity capture / reconstruction.

alter table public.worker_jobs
  add column if not exists source_message_id text,
  add column if not exists source_thread_id text,
  add column if not exists sender_email text,
  add column if not exists recipient_emails text[] not null default '{}',
  add column if not exists sent_at timestamptz,
  add column if not exists email_subject text;

alter table public.messages
  add column if not exists source_thread_id text;

create unique index if not exists messages_org_external_message_uq
  on public.messages (organization_id, external_message_id)
  where external_message_id is not null;

create index if not exists worker_jobs_source_message_idx
  on public.worker_jobs (organization_id, source_message_id)
  where source_message_id is not null;

create or replace function public.materialize_worker_message_identity(
  p_job_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  job public.worker_jobs%rowtype;
  source_thread public.commercial_threads%rowtype;
  normalized_conversation_id uuid;
  normalized_message_id uuid;
  conversation_external_id text;
begin
  if current_user <> 'service_role' then
    raise exception 'Service role required';
  end if;

  select *
  into job
  from public.worker_jobs
  where id=p_job_id;

  if not found then
    raise exception 'Worker job not found';
  end if;

  if job.thread_id is null then
    raise exception 'Worker job has no promoted commercial thread';
  end if;

  select *
  into source_thread
  from public.commercial_threads
  where id=job.thread_id;

  if not found then
    raise exception 'Commercial thread not found';
  end if;

  if source_thread.organization_id is null then
    raise exception 'Commercial thread has no organization';
  end if;

  if job.source_message_id is null or btrim(job.source_message_id)='' then
    return jsonb_build_object(
      'status','captured_only',
      'reason','missing_message_id',
      'job_id',job.id,
      'thread_id',source_thread.id
    );
  end if;

  conversation_external_id := source_thread.source_conversation_id::text;

  select c.id
  into normalized_conversation_id
  from public.conversations c
  where c.organization_id=source_thread.organization_id
    and c.external_thread_id=conversation_external_id
  limit 1;

  if normalized_conversation_id is null then
    insert into public.conversations(
      owner_id,
      organization_id,
      subject,
      external_thread_id,
      status,
      started_at,
      last_activity_at
    )
    values(
      coalesce(job.owner_id,source_thread.owner_id),
      source_thread.organization_id,
      coalesce(job.email_subject,source_thread.subject),
      conversation_external_id,
      'open',
      coalesce(job.sent_at,source_thread.started_at,job.created_at),
      coalesce(job.sent_at,source_thread.last_activity_at,job.created_at)
    )
    returning id into normalized_conversation_id;
  end if;

  select m.id
  into normalized_message_id
  from public.messages m
  where m.organization_id=source_thread.organization_id
    and m.external_message_id=job.source_message_id
  limit 1;

  if normalized_message_id is null then
    insert into public.messages(
      owner_id,
      organization_id,
      conversation_id,
      external_message_id,
      source_thread_id,
      direction,
      sender_email,
      recipient_emails,
      sent_at,
      subject
    )
    values(
      coalesce(job.owner_id,source_thread.owner_id),
      source_thread.organization_id,
      normalized_conversation_id,
      job.source_message_id,
      job.source_thread_id,
      null,
      job.sender_email,
      coalesce(job.recipient_emails,'{}'::text[]),
      job.sent_at,
      job.email_subject
    )
    returning id into normalized_message_id;
  else
    update public.messages
    set
      conversation_id=coalesce(conversation_id,normalized_conversation_id),
      source_thread_id=coalesce(source_thread_id,job.source_thread_id),
      sender_email=coalesce(sender_email,job.sender_email),
      recipient_emails=case
        when cardinality(recipient_emails)=0 then coalesce(job.recipient_emails,'{}'::text[])
        else recipient_emails
      end,
      sent_at=coalesce(sent_at,job.sent_at),
      subject=coalesce(subject,job.email_subject)
    where id=normalized_message_id;
  end if;

  return jsonb_build_object(
    'status','materialized',
    'job_id',job.id,
    'thread_id',source_thread.id,
    'conversation_id',normalized_conversation_id,
    'message_id',normalized_message_id,
    'external_message_id',job.source_message_id,
    'source_thread_id',job.source_thread_id
  );
end;
$$;

revoke execute on function public.materialize_worker_message_identity(uuid)
from public,anon,authenticated;
grant execute on function public.materialize_worker_message_identity(uuid)
to service_role;

comment on function public.materialize_worker_message_identity(uuid) is
  'PA2.7 materializes normalized Conversation + Message from structured RFC822 evidence captured on a worker job. Missing Message-ID remains captured-only.';
