create table public.retrieval_evaluation_runs (
  id uuid primary key default gen_random_uuid(),
  set_version text not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  embedding_model_key text,
  rag_model text,
  config jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  quality_gates jsonb not null default '{}'::jsonb,
  passed boolean,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.retrieval_evaluation_case_results (
  run_id uuid not null references public.retrieval_evaluation_runs(id) on delete cascade,
  case_id uuid not null references public.retrieval_golden_query_cases(id) on delete restrict,
  case_key text not null,
  case_type text not null,
  language_code text not null,
  retrieval jsonb not null default '{}'::jsonb,
  rag jsonb not null default '{}'::jsonb,
  latency jsonb not null default '{}'::jsonb,
  passed boolean not null,
  failure_reasons text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  primary key (run_id, case_id)
);

create index retrieval_evaluation_runs_version_created_idx
  on public.retrieval_evaluation_runs (set_version, created_at desc);
create index retrieval_evaluation_case_results_case_key_idx
  on public.retrieval_evaluation_case_results (case_key, created_at desc);
create index retrieval_evaluation_case_results_case_id_idx
  on public.retrieval_evaluation_case_results (case_id);

alter table public.retrieval_evaluation_runs enable row level security;
alter table public.retrieval_evaluation_case_results enable row level security;

revoke all on table public.retrieval_evaluation_runs from public, anon, authenticated;
revoke all on table public.retrieval_evaluation_case_results from public, anon, authenticated;
grant select, insert, update, delete on table public.retrieval_evaluation_runs to service_role;
grant select, insert, update, delete on table public.retrieval_evaluation_case_results to service_role;

create policy retrieval_evaluation_runs_service_role_all
  on public.retrieval_evaluation_runs
  for all to service_role
  using (true) with check (true);

create policy retrieval_evaluation_case_results_service_role_all
  on public.retrieval_evaluation_case_results
  for all to service_role
  using (true) with check (true);

comment on table public.retrieval_evaluation_runs is
  'Persisted M5.8 Golden Query evaluation runs and aggregate metrics. Service-role only.';
comment on table public.retrieval_evaluation_case_results is
  'Per-case retrieval/RAG evaluation results for a persisted M5.8 run.';

create or replace function public.get_retrieval_golden_query_owner(
  p_set_version text default 'v1'
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owners uuid[];
begin
  select array_agg(distinct s.owner_id order by s.owner_id)
    into owners
  from public.retrieval_golden_query_cases q
  join public.retrieval_golden_query_targets t on t.case_id = q.id
  join public.knowledge_chunks c on c.id = t.chunk_id
  join public.knowledge_sources s on s.id = c.source_id
  where q.set_version = p_set_version;

  if owners is null or cardinality(owners) = 0 then
    raise exception 'Golden query set % has no owner-scoped targets', p_set_version;
  end if;
  if cardinality(owners) <> 1 then
    raise exception 'Golden query set % spans % owners; evaluation requires one owner',
      p_set_version, cardinality(owners);
  end if;
  return owners[1];
end;
$$;

revoke all on function public.get_retrieval_golden_query_owner(text) from public, anon, authenticated;
grant execute on function public.get_retrieval_golden_query_owner(text) to service_role;
