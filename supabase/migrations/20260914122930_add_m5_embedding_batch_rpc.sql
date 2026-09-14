create or replace function public.get_chunks_needing_embedding(
  target_model_key text,
  batch_limit integer default 32
)
returns table (
  chunk_id uuid,
  source_id uuid,
  document_id uuid,
  content text,
  content_checksum text,
  model_id uuid,
  model_key text,
  model_name text,
  model_revision text,
  dimensions integer,
  normalized boolean,
  config jsonb
)
language sql
stable
set search_path = ''
as $$
  select
    c.id,
    c.source_id,
    c.document_id,
    c.content,
    c.content_checksum,
    m.id,
    m.model_key,
    m.model_name,
    m.model_revision,
    m.dimensions,
    m.normalized,
    m.config
  from public.knowledge_embedding_models m
  cross join public.knowledge_chunks c
  left join public.knowledge_chunk_embeddings e
    on e.chunk_id = c.id
   and e.model_id = m.id
  where m.model_key = target_model_key
    and m.status in ('candidate', 'active')
    and (e.id is null or e.content_checksum <> c.content_checksum)
  order by c.created_at, c.chunk_index
  limit greatest(1, least(batch_limit, 128));
$$;

revoke all on function public.get_chunks_needing_embedding(text, integer) from public, anon, authenticated;
grant execute on function public.get_chunks_needing_embedding(text, integer) to service_role;

comment on function public.get_chunks_needing_embedding(text, integer) is
  'Service-role batch selector for missing or stale chunk embeddings by model key.';
