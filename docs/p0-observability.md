# P0.9 — Production Observability

## Goal

P0.9 makes Steel Sales AI operationally inspectable without introducing a paid third-party observability dependency.

The contract covers:

- request tracing with `X-Trace-ID`;
- structured JSON application logs;
- durable operational events in Supabase;
- worker-job lifecycle tracing;
- external AI/provider usage and failure accounting;
- latency and failure health metrics;
- cost estimates only when an explicit accounting rate is configured;
- internal health and trace lookup endpoints;
- CI acceptance tests and production smoke tests.

## Why platform log severity is not the health contract

Railway currently receives Uvicorn startup messages on stderr. As a result, normal lines such as `Application startup complete` can appear with platform severity `error` even though the application is healthy.

P0.9 therefore treats Railway logs and metrics as infrastructure evidence, not as the canonical application failure counter. `observability_health()` derives application health from structured events and durable `worker_jobs` state.

## Event schema

`public.observability_events` stores operational metadata only.

Core fields:

- `occurred_at`
- `service`, `environment`
- `trace_id`, `span_id`, `parent_span_id`
- `event_type`: `request`, `provider`, `job`, `dependency`, `system`
- `operation`
- `status`: `ok`, `client_error`, `error`
- `duration_ms`, `http_status`
- optional tenant/user/job identifiers
- optional provider/model/usage/cost fields
- sanitized error class/message
- bounded JSON metadata

The table intentionally does **not** store:

- request bodies;
- uploaded document contents;
- commercial source text;
- authentication tokens or API keys;
- arbitrary response bodies.

RLS is enabled. `anon` and `authenticated` have no table privileges and an explicit deny policy. Only the service role can insert/read events through application infrastructure.

## Request tracing

The worker middleware accepts an incoming `X-Trace-ID` when it is a valid UUID. Otherwise it generates one.

The same trace ID is returned in the response header:

```text
X-Trace-ID: <uuid>
```

Every non-health, non-observability request produces a structured request event with:

- normalized FastAPI route rather than high-cardinality raw URL;
- HTTP method;
- response status;
- elapsed milliseconds;
- sanitized exception details for unhandled failures.

`/health` is deliberately excluded from durable event persistence because Railway probes it frequently and probe noise would distort product traffic and latency metrics.

## Worker-job tracing

`worker_jobs_observability_after_change` emits durable events on:

- `queued`
- `processing`
- `completed`
- `failed`

The job trace ID is deterministic from `worker_jobs.id`, so all lifecycle transitions for one job share a stable trace even across processes or restarts.

Job telemetry excludes filenames and document contents. Completion/failure duration is derived from `started_at` and `completed_at` when available.

## Provider usage and cost

The Hugging Face embedding adapter records every feature-extraction call used by both:

- document/chunk embedding batches;
- query embeddings used by hybrid retrieval/RAG.

Recorded usage:

- provider = `huggingface`;
- concrete model name;
- configured inference provider backend;
- number of input texts;
- total input characters;
- elapsed time;
- success/failure.

### Cost rule

P0.9 never fabricates a provider price. Hugging Face inference pricing can vary by backend, model and compute mode.

By default:

- `usage_quantity` is recorded;
- `usage_unit = input_chars`;
- `estimated_cost_usd = null`.

If finance/operations has a valid accounting rate, set:

```text
HF_EMBEDDING_COST_PER_1M_CHARS_USD=<rate>
```

Then the worker computes:

```text
estimated_cost_usd = input_chars / 1,000,000 × configured_rate
```

The health contract reports unpriced calls separately so missing cost configuration is visible rather than silently interpreted as zero cost.

## Health contract

Internal RPC:

```sql
select public.observability_health(60);
```

The parameter is a rolling window in minutes (`5..10080`).

Contract version: `p0.9-v1`.

Key outputs:

- request count;
- request application errors;
- HTTP 5xx count;
- client error count;
- p50/p95 request latency;
- provider call/error count;
- provider usage total;
- estimated provider cost total;
- provider calls with observed usage but no configured price;
- completed/failed jobs in the window;
- processing jobs now;
- jobs stuck in processing for more than 30 minutes;
- latest structured event;
- `critical_issue_count`.

`critical_issue_count` is intentionally simple for P0:

```text
request 5xx
+ provider failures
+ worker jobs failed in the selected window
+ currently stale processing jobs
```

This can evolve into SLO/error-budget policy later without changing the underlying event model.

## Internal operations API

All operations endpoints require `X-Worker-Token` matching `WORKER_INTERNAL_TOKEN`.

### Current health

```text
GET /v1/ops/observability?window_minutes=60
```

Returns the Supabase `observability_health()` result.

### Trace inspection

```text
GET /v1/ops/traces/<trace-uuid>
```

Returns up to 200 structured events in chronological order.

## Structured Railway logs

Each application event is also emitted to stdout as compact JSON with schema:

```text
steel_sales_ai.observability.v1
```

This allows Railway log filtering by application fields instead of relying on stderr-derived platform severity.

Useful Railway operational checks remain:

```bash
railway logs --service <service> --since 1h --lines 400 --json
railway logs --service <service> --http --status ">=400" --lines 100 --json
railway metrics --service <service> --since 6h --cpu --memory --json
```

Railway CPU/memory/network metrics complement the application contract; they do not replace it.

## Failure behavior

Observability is best-effort on the application path:

- persistence errors never fail a customer request;
- failed telemetry persistence emits a local structured `observability.persist` error;
- pending event writes are flushed on worker shutdown;
- secrets in common `Bearer`, `token=`, `api_key=`, `secret=` and `password=` shapes are redacted before error persistence.

The durable worker-job trigger is independent from in-memory application telemetry, so job failure state remains observable even if the Python process terminates after writing the job state.

## CI acceptance gate

`supabase/tests/p0_observability.sql` verifies:

- RLS and service-role-only access;
- explicit client deny policy;
- health RPC privileges;
- request/server-error counters;
- provider usage, cost and unpriced-call accounting;
- job lifecycle trigger;
- deterministic per-job traces;
- token-like error redaction;
- critical issue calculation;
- explicit declaration that Railway raw severity is not a health signal.

`services/worker/tests/test_observability.py` verifies:

- trace ID propagation/replacement;
- secret redaction;
- explicit-rate-only cost estimation;
- middleware request event structure;
- unhandled failure telemetry without request payload persistence.

The full worker/RAG regression suite remains part of the P0 Foundation CI gate.
