alter table public.retrieval_golden_query_cases
  add column relevance_mode text not null default 'targets'
    check (relevance_mode in ('targets', 'criteria')),
  add column relevance_criteria jsonb not null default '{}'::jsonb;

comment on column public.retrieval_golden_query_cases.relevance_mode is
  'How evaluation determines relevance: exact annotated targets or explicit broad criteria.';
comment on column public.retrieval_golden_query_cases.relevance_criteria is
  'Additional relevance criteria for broad semantic queries whose valid answer set is not exhaustively chunk-annotated.';

-- Annotation correction only: the semantic intent is unchanged. The two Bologna-order
-- queries have 137 valid owner-scoped S355J2H / EN 10219 ordered chunks in Bologna
-- documents, so the five curated example chunks are not an exhaustive gold set.
update public.retrieval_golden_query_cases
set relevance_mode = 'criteria',
    relevance_criteria = '{"document_query":"Bologna"}'::jsonb,
    expected_filters = expected_filters || '{"document_query":"Bologna"}'::jsonb,
    notes = coalesce(notes || ' ', '') ||
      'v1 annotation correction 2026-09-15: broad relevance is criteria-based; curated target chunks remain examples, not an exhaustive set.'
where set_version = 'v1'
  and case_key in ('semantic:bologna-orders-it', 'semantic:bologna-orders-en');

create or replace function public.get_retrieval_golden_queries(
  p_set_version text default 'v1',
  p_limit integer default 200
)
returns table(
  case_id uuid,
  case_key text,
  case_type text,
  language_code text,
  query_text text,
  expected_match boolean,
  expected_behavior text,
  expected_entities jsonb,
  expected_filters jsonb,
  expected_grounding_status text,
  relevance_mode text,
  relevance_criteria jsonb,
  target_chunk_ids uuid[],
  target_document_ids uuid[],
  notes text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.case_key, c.case_type, c.language_code, c.query_text,
    c.expected_match, c.expected_behavior, c.expected_entities, c.expected_filters,
    c.expected_grounding_status, c.relevance_mode, c.relevance_criteria,
    coalesce(array_agg(t.chunk_id order by t.chunk_id) filter (where t.chunk_id is not null), '{}'::uuid[]),
    coalesce(array_agg(distinct k.document_id order by k.document_id) filter (where k.document_id is not null), '{}'::uuid[]),
    c.notes
  from public.retrieval_golden_query_cases c
  left join public.retrieval_golden_query_targets t on t.case_id = c.id
  left join public.knowledge_chunks k on k.id = t.chunk_id
  where c.set_version = p_set_version
  group by c.id
  order by c.case_type, c.language_code, c.case_key
  limit greatest(1, least(p_limit, 500));
$$;

revoke all on function public.get_retrieval_golden_queries(text, integer) from public, anon, authenticated;
grant execute on function public.get_retrieval_golden_queries(text, integer) to service_role;
