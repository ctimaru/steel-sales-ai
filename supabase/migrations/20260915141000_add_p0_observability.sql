-- P0.9 — application observability contract.
--
-- The table stores operational metadata only: no request bodies, document text,
-- authentication tokens, or customer payloads. Application events are written
-- by the service role and are not exposed to anon/authenticated clients.

create table if not exists public.observability_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  service text not null default 'worker' check (length(btrim(service)) between 1 and 80),
  environment text not null default 'production' check (length(btrim(environment)) between 1 and 80),
  trace_id uuid not null,
  span_id uuid not null default gen_random_uuid(),
  parent_span_id uuid,
  event_type text not null check (event_type in ('request', 'provider', 'job', 'dependency', 'system')),
  operation text not null check (length(btrim(operation)) between 1 and 160),
  status text not null check (status in ('ok', 'client_error', 'error')),
  duration_ms numeric check (duration_ms is null or duration_ms >= 0),
  http_status integer check (http_status is null or http_status between 100 and 599),
  organization_id uuid references public.organizations(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  job_id uuid references public.worker_jobs(id) on delete set null,
  provider text,
  model text,
  usage_quantity numeric check (usage_quantity is null or usage_quantity >= 0),
  usage_unit text,
  estimated_cost_usd numeric check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  error_class text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  constraint observability_events_usage_pair check (
    (usage_quantity is null and usage_unit is null)
    or (usage_quantity is not null and nullif(btrim(usage_unit), '') is not null)
  )
);

comment on table public.observability_events is
  'P0.9 operational telemetry. Metadata only; request/customer/document payloads are intentionally excluded.';
comment on column public.observability_events.estimated_cost_usd is
  'Optional estimate only when an explicit provider price is configured. Null means usage was observed but not priced.';

create index if not exists observability_events_occurred_at_idx
  on public.observability_events (occurred_at desc);
create index if not exists observability_events_trace_idx
  on public.observability_events (trace_id, occurred_at asc);
create index if not exists observability_events_status_idx
  on public.observability_events (status, occurred_at desc);
create index if not exists observability_events_job_idx
  on public.observability_events (job_id, occurred_at desc)
  where job_id is not null;
create index if not exists observability_events_provider_idx
  on public.observability_events (provider, model, occurred_at desc)
  where provider is not null;
create index if not exists observability_events_organization_idx
  on public.observability_events (organization_id, occurred_at desc)
  where organization_id is not null;
create index if not exists observability_events_owner_idx
  on public.observability_events (owner_id, occurred_at desc)
  where owner_id is not null;

alter table public.observability_events enable row level security;

revoke all on table public.observability_events from public, anon, authenticated;
grant select, insert on table public.observability_events to service_role;

-- Explicit deny policy is defense in depth and avoids an intentionally policy-less
-- RLS table being mistaken for incomplete security configuration by advisors.
drop policy if exists observability_events_client_deny on public.observability_events;
create policy observability_events_client_deny
on public.observability_events
for all
to anon, authenticated
using (false)
with check (false);

create or replace function public.observability_health(
  p_window_minutes integer default 60
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cutoff timestamptz;
  v_request_count bigint := 0;
  v_request_error_count bigint := 0;
  v_request_5xx_count bigint := 0;
  v_client_error_count bigint := 0;
  v_request_p50_ms numeric;
  v_request_p95_ms numeric;
  v_provider_call_count bigint := 0;
  v_provider_error_count bigint := 0;
  v_usage_quantity numeric := 0;
  v_estimated_cost_usd numeric := 0;
  v_unpriced_provider_calls bigint := 0;
  v_completed_jobs bigint := 0;
  v_failed_jobs bigint := 0;
  v_processing_jobs bigint := 0;
  v_stale_processing_jobs bigint := 0;
  v_latest_event_at timestamptz;
  v_critical_issue_count bigint := 0;
begin
  if p_window_minutes < 5 or p_window_minutes > 10080 then
    raise exception 'p_window_minutes must be between 5 and 10080';
  end if;

  v_cutoff := now() - make_interval(mins => p_window_minutes);

  select
    count(*) filter (where event_type = 'request'),
    count(*) filter (where event_type = 'request' and status = 'error'),
    count(*) filter (where event_type = 'request' and http_status >= 500),
    count(*) filter (where event_type = 'request' and status = 'client_error'),
    percentile_cont(0.50) within group (order by duration_ms)
      filter (where event_type = 'request' and duration_ms is not null),
    percentile_cont(0.95) within group (order by duration_ms)
      filter (where event_type = 'request' and duration_ms is not null),
    count(*) filter (where event_type = 'provider'),
    count(*) filter (where event_type = 'provider' and status = 'error'),
    coalesce(sum(usage_quantity) filter (where event_type = 'provider'), 0),
    coalesce(sum(estimated_cost_usd) filter (where event_type = 'provider'), 0),
    count(*) filter (
      where event_type = 'provider'
        and usage_quantity is not null
        and estimated_cost_usd is null
    ),
    max(occurred_at)
  into
    v_request_count,
    v_request_error_count,
    v_request_5xx_count,
    v_client_error_count,
    v_request_p50_ms,
    v_request_p95_ms,
    v_provider_call_count,
    v_provider_error_count,
    v_usage_quantity,
    v_estimated_cost_usd,
    v_unpriced_provider_calls,
    v_latest_event_at
  from public.observability_events
  where occurred_at >= v_cutoff;

  select
    count(*) filter (
      where status = 'completed'
        and coalesce(completed_at, created_at) >= v_cutoff
    ),
    count(*) filter (
      where status = 'failed'
        and coalesce(completed_at, created_at) >= v_cutoff
    ),
    count(*) filter (where status = 'processing'),
    count(*) filter (
      where status = 'processing'
        and coalesce(started_at, created_at) < now() - interval '30 minutes'
    )
  into
    v_completed_jobs,
    v_failed_jobs,
    v_processing_jobs,
    v_stale_processing_jobs
  from public.worker_jobs;

  v_critical_issue_count :=
    v_request_5xx_count
    + v_provider_error_count
    + v_failed_jobs
    + v_stale_processing_jobs;

  return jsonb_build_object(
    'contract', 'p0.9-v1',
    'generated_at', now(),
    'window_minutes', p_window_minutes,
    'cutoff', v_cutoff,
    'critical_issue_count', v_critical_issue_count,
    'requests', jsonb_build_object(
      'total', v_request_count,
      'errors', v_request_error_count,
      'server_5xx', v_request_5xx_count,
      'client_errors', v_client_error_count,
      'p50_ms', v_request_p50_ms,
      'p95_ms', v_request_p95_ms
    ),
    'providers', jsonb_build_object(
      'calls', v_provider_call_count,
      'errors', v_provider_error_count,
      'usage_quantity_total', v_usage_quantity,
      'estimated_cost_usd', v_estimated_cost_usd,
      'unpriced_calls', v_unpriced_provider_calls
    ),
    'jobs', jsonb_build_object(
      'completed_in_window', v_completed_jobs,
      'failed_in_window', v_failed_jobs,
      'processing_now', v_processing_jobs,
      'stale_processing_now', v_stale_processing_jobs,
      'stale_after_minutes', 30
    ),
    'latest_event_at', v_latest_event_at,
    'railway_severity_is_health_signal', false
  );
end;
$$;

revoke execute on function public.observability_health(integer)
  from public, anon, authenticated;
grant execute on function public.observability_health(integer)
  to service_role;

comment on function public.observability_health(integer) is
  'P0.9 operational health contract. Uses structured application events and worker_jobs, never raw platform log severity.';
