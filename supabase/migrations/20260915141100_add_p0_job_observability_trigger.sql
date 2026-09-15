-- P0.9 — durable worker-job lifecycle events.
--
-- Job trace IDs are deterministic from worker_jobs.id. This provides a stable
-- trace for queued -> processing -> completed/failed transitions without making
-- the ingestion pipeline depend on in-memory application context.

create or replace function public.observability_worker_job_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trace_id uuid;
  v_event_at timestamptz;
  v_duration_ms numeric;
  v_status text;
  v_error text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then
    return new;
  end if;

  v_trace_id := md5('steel-sales-ai|worker-job|' || new.id::text)::uuid;
  v_event_at := case
    when new.status = 'processing' then coalesce(new.started_at, now())
    when new.status in ('completed', 'failed') then coalesce(new.completed_at, now())
    else coalesce(new.created_at, now())
  end;

  if new.started_at is not null and new.completed_at is not null then
    v_duration_ms := greatest(
      0,
      extract(epoch from (new.completed_at - new.started_at)) * 1000
    );
  end if;

  v_status := case when new.status = 'failed' then 'error' else 'ok' end;
  v_error := case
    when new.error is null then null
    else left(
      regexp_replace(
        regexp_replace(new.error, '(?i)(bearer\\s+)[A-Za-z0-9._~+/=-]+', '\\1[REDACTED]', 'g'),
        '(?i)((?:api[_-]?key|token|secret|password)\\s*[=:]\\s*)[^\\s,;]+',
        '\\1[REDACTED]',
        'g'
      ),
      500
    )
  end;

  insert into public.observability_events (
    occurred_at,
    service,
    environment,
    trace_id,
    event_type,
    operation,
    status,
    duration_ms,
    organization_id,
    owner_id,
    job_id,
    error_class,
    error_message,
    metadata
  ) values (
    v_event_at,
    'worker',
    'production',
    v_trace_id,
    'job',
    'worker_job.' || new.status,
    v_status,
    v_duration_ms,
    new.organization_id,
    new.owner_id,
    new.id,
    case when new.status = 'failed' then 'WorkerJobFailed' else null end,
    v_error,
    jsonb_strip_nulls(jsonb_build_object(
      'from_status', case when tg_op = 'UPDATE' then old.status else null end,
      'to_status', new.status,
      'parser_version', new.parser_version,
      'input_kind', new.input_kind,
      'extraction_count', new.extraction_count,
      'promoted_observation_count', new.promoted_observation_count,
      'knowledge_chunk_count', new.knowledge_chunk_count,
      'knowledge_deduplicated', new.knowledge_deduplicated,
      'trace_source', 'deterministic_job_id'
    ))
  );

  return new;
end;
$$;

revoke execute on function public.observability_worker_job_event()
  from public, anon, authenticated;
grant execute on function public.observability_worker_job_event()
  to service_role;

drop trigger if exists worker_jobs_observability_after_change on public.worker_jobs;
create trigger worker_jobs_observability_after_change
after insert or update of status
on public.worker_jobs
for each row
execute function public.observability_worker_job_event();

comment on function public.observability_worker_job_event() is
  'P0.9 durable lifecycle telemetry for worker jobs. Trace ID is deterministic from job ID; no document content or filename is stored.';
