create or replace function public.hybrid_search_knowledge_filtered(
  p_owner_id uuid,
  p_query_text text,
  p_query_embedding real[],
  p_match_count integer default 10,
  p_candidate_count integer default 60,
  p_entity_filters jsonb default '{}'::jsonb,
  p_commercial_filters jsonb default '{}'::jsonb,
  p_document_filters jsonb default '{}'::jsonb,
  p_rrf_k integer default 60
)
returns table(
  chunk_id uuid,
  source_id uuid,
  document_id uuid,
  content text,
  language_code text,
  title text,
  filename text,
  document_type text,
  source_name text,
  source_class text,
  source_uri text,
  page_start integer,
  page_end integer,
  section_path text[],
  source_locator jsonb,
  chunk_metadata jsonb,
  vector_similarity double precision,
  lexical_score double precision,
  entity_match_count integer,
  rrf_score double precision,
  matched_entities jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select h.*
  from public.hybrid_search_knowledge(
    p_owner_id,
    p_query_text,
    p_query_embedding,
    50,
    greatest(120, least(p_candidate_count, 250)),
    coalesce(p_entity_filters, '{}'::jsonb),
    coalesce(p_commercial_filters, '{}'::jsonb),
    p_rrf_k
  ) h
  join public.knowledge_documents d on d.id = h.document_id
  join public.knowledge_sources s on s.id = h.source_id
  where
    (
      not (coalesce(p_document_filters, '{}'::jsonb) ? 'source_class')
      or lower(coalesce(s.source_class, '')) = lower(p_document_filters ->> 'source_class')
    )
    and (
      not (coalesce(p_document_filters, '{}'::jsonb) ? 'source_type')
      or lower(coalesce(s.source_type, '')) = lower(p_document_filters ->> 'source_type')
    )
    and (
      not (coalesce(p_document_filters, '{}'::jsonb) ? 'document_type')
      or lower(coalesce(d.document_type, '')) = lower(p_document_filters ->> 'document_type')
    )
    and (
      not (coalesce(p_document_filters, '{}'::jsonb) ? 'document_id')
      or d.id = (p_document_filters ->> 'document_id')::uuid
    )
    and (
      not (coalesce(p_document_filters, '{}'::jsonb) ? 'document_query')
      or coalesce(d.title, '') ilike '%' || (p_document_filters ->> 'document_query') || '%'
      or coalesce(d.filename, '') ilike '%' || (p_document_filters ->> 'document_query') || '%'
      or coalesce(s.name, '') ilike '%' || (p_document_filters ->> 'document_query') || '%'
    )
    and (
      not (coalesce(p_document_filters, '{}'::jsonb) ? 'date_from')
      or coalesce(d.published_at, d.fetched_at, d.extracted_at, d.created_at)::date >= (p_document_filters ->> 'date_from')::date
    )
    and (
      not (coalesce(p_document_filters, '{}'::jsonb) ? 'date_to')
      or coalesce(d.published_at, d.fetched_at, d.extracted_at, d.created_at)::date <= (p_document_filters ->> 'date_to')::date
    )
  order by h.rrf_score desc, h.vector_similarity desc nulls last, h.lexical_score desc nulls last
  limit greatest(1, least(p_match_count, 50));
$$;

revoke execute on function public.hybrid_search_knowledge_filtered(uuid,text,real[],integer,integer,jsonb,jsonb,jsonb,integer) from public, anon, authenticated;
grant execute on function public.hybrid_search_knowledge_filtered(uuid,text,real[],integer,integer,jsonb,jsonb,jsonb,integer) to service_role;

comment on function public.hybrid_search_knowledge_filtered(uuid,text,real[],integer,integer,jsonb,jsonb,jsonb,integer) is
  'M5.6 document-aware wrapper around M5.5 hybrid retrieval. Adds source/document/date filters while preserving owner isolation and provenance.';
