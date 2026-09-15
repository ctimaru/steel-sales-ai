\set ON_ERROR_STOP on

begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P0.9 observability assertion failed: %', message;
  end if;
end;
$$;

select pg_temp.assert_true(
  (select relrowsecurity from pg_class where oid='public.observability_events'::regclass),
  'observability_events must have RLS enabled'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.observability_events', 'SELECT'),
  'authenticated must not read internal observability events'
);
select pg_temp.assert_true(
  not has_table_privilege('authenticated', 'public.observability_events', 'INSERT'),
  'authenticated must not write internal observability events'
);
select pg_temp.assert_true(
  has_table_privilege('service_role', 'public.observability_events', 'SELECT'),
  'service_role must read observability events'
);
select pg_temp.assert_true(
  has_table_privilege('service_role', 'public.observability_events', 'INSERT'),
  'service_role must write observability events'
);
select pg_temp.assert_true(
  not has_function_privilege('authenticated', 'public.observability_health(integer)', 'EXECUTE'),
  'authenticated must not execute observability health RPC'
);
select pg_temp.assert_true(
  has_function_privilege('service_role', 'public.observability_health(integer)', 'EXECUTE'),
  'service_role must execute observability health RPC'
);
select pg_temp.assert_true(
  exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='observability_events'
      and policyname='observability_events_client_deny'
  ),
  'explicit client deny policy must exist'
);

-- Two request events: one healthy, one server failure.
insert into public.observability_events (
  occurred_at, trace_id, event_type, operation, status, duration_ms, http_status, metadata
) values
  (now() - interval '2 minutes', '90000000-0000-0000-0000-000000000001', 'request', 'GET /v1/test-ok', 'ok', 100, 200, '{"method":"GET"}'),
  (now() - interval '1 minute', '90000000-0000-0000-0000-000000000002', 'request', 'POST /v1/test-error', 'error', 400, 503, '{"method":"POST"}');

-- Provider usage is observable even when no applicable price is configured.
insert into public.observability_events (
  occurred_at, trace_id, event_type, operation, status, duration_ms,
  provider, model, usage_quantity, usage_unit, estimated_cost_usd, metadata
) values
  (now() - interval '90 seconds', '90000000-0000-0000-0000-000000000003', 'provider', 'embedding.feature_extraction', 'ok', 150,
   'huggingface', 'example/model', 1000, 'input_chars', 0.002, '{"text_count":2}'),
  (now() - interval '30 seconds', '90000000-0000-0000-0000-000000000004', 'provider', 'embedding.feature_extraction', 'error', 250,
   'huggingface', 'example/model', 500, 'input_chars', null, '{"text_count":1}');

-- Job lifecycle trigger must create deterministic, durable telemetry.
insert into public.worker_jobs (
  id, filename, extension, size_bytes, status, created_at
) values (
  '91000000-0000-0000-0000-000000000001',
  'p0-observability-test.pdf', '.pdf', 100, 'queued', now() - interval '3 minutes'
);

update public.worker_jobs
set status='processing', started_at=now() - interval '2 minutes'
where id='91000000-0000-0000-0000-000000000001';

update public.worker_jobs
set status='failed', completed_at=now(), error='provider token=super-secret-value failed'
where id='91000000-0000-0000-0000-000000000001';

select pg_temp.assert_true(
  (select count(*) = 3 from public.observability_events where job_id='91000000-0000-0000-0000-000000000001'),
  'job trigger must emit queued, processing and failed lifecycle events'
);
select pg_temp.assert_true(
  (select count(distinct trace_id) = 1 from public.observability_events where job_id='91000000-0000-0000-0000-000000000001'),
  'all lifecycle events for one job must share a deterministic trace ID'
);
select pg_temp.assert_true(
  exists (
    select 1 from public.observability_events
    where job_id='91000000-0000-0000-0000-000000000001'
      and operation='worker_job.failed'
      and status='error'
      and error_message like '%[REDACTED]%'
      and error_message not like '%super-secret-value%'
  ),
  'job failure telemetry must redact token-like secrets'
);

create temporary table p09_health as
select public.observability_health(60) as payload;

select pg_temp.assert_true(
  (select payload->>'contract' = 'p0.9-v1' from p09_health),
  'health contract version must be p0.9-v1'
);
select pg_temp.assert_true(
  (select (payload->'requests'->>'total')::integer = 2 from p09_health),
  'health must count request events'
);
select pg_temp.assert_true(
  (select (payload->'requests'->>'server_5xx')::integer = 1 from p09_health),
  'health must count application server failures'
);
select pg_temp.assert_true(
  (select (payload->'providers'->>'calls')::integer = 2 from p09_health),
  'health must count provider calls'
);
select pg_temp.assert_true(
  (select (payload->'providers'->>'errors')::integer = 1 from p09_health),
  'health must count provider failures'
);
select pg_temp.assert_true(
  (select (payload->'providers'->>'usage_quantity_total')::numeric = 1500 from p09_health),
  'health must aggregate observed provider usage'
);
select pg_temp.assert_true(
  (select (payload->'providers'->>'estimated_cost_usd')::numeric = 0.002 from p09_health),
  'health must aggregate only explicitly priced cost estimates'
);
select pg_temp.assert_true(
  (select (payload->'providers'->>'unpriced_calls')::integer = 1 from p09_health),
  'health must expose provider calls with usage but no configured price'
);
select pg_temp.assert_true(
  (select (payload->'jobs'->>'failed_in_window')::integer = 1 from p09_health),
  'health must count failed jobs in the window'
);
select pg_temp.assert_true(
  (select (payload->>'critical_issue_count')::integer = 3 from p09_health),
  'critical count must combine request 5xx + provider error + failed job without platform log noise'
);
select pg_temp.assert_true(
  (select (payload->>'railway_severity_is_health_signal')::boolean = false from p09_health),
  'raw Railway severity must never be treated as the application health signal'
);

rollback;
