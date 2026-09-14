update public.knowledge_embedding_models
set status = 'retired', updated_at = now()
where model_key in ('multilingual-e5-base-v1', 'multilingual-minilm-l12-v2')
  and status = 'candidate';

insert into public.knowledge_embedding_models (
  model_key,
  provider,
  model_name,
  dimensions,
  distance_metric,
  normalized,
  max_input_tokens,
  status,
  config
)
values
  (
    'multilingual-e5-large-instruct-v1',
    'huggingface',
    'intfloat/multilingual-e5-large-instruct',
    1024,
    'cosine',
    true,
    512,
    'candidate',
    '{"role":"quality_candidate","query_prefix":"Instruct: Retrieve the commercial steel tube passages most relevant to the query\nQuery: "}'::jsonb
  ),
  (
    'harrier-oss-v1-270m-v1',
    'huggingface',
    'microsoft/harrier-oss-v1-270m',
    640,
    'cosine',
    true,
    32768,
    'candidate',
    '{"role":"compact_candidate","query_prefix":"Instruct: Retrieve the commercial steel tube passages most relevant to the query\nQuery: "}'::jsonb
  )
on conflict (model_key) do update
set provider = excluded.provider,
    model_name = excluded.model_name,
    dimensions = excluded.dimensions,
    distance_metric = excluded.distance_metric,
    normalized = excluded.normalized,
    max_input_tokens = excluded.max_input_tokens,
    config = excluded.config,
    status = case
      when public.knowledge_embedding_models.status = 'active' then 'active'
      else 'candidate'
    end,
    updated_at = now();

create index if not exists knowledge_chunk_embeddings_e5_large_instruct_hnsw_idx
  on public.knowledge_chunk_embeddings
  using hnsw ((embedding::extensions.vector(1024)) extensions.vector_cosine_ops)
  where model_key = 'multilingual-e5-large-instruct-v1' and embedding_dimensions = 1024;

create index if not exists knowledge_chunk_embeddings_harrier_270m_hnsw_idx
  on public.knowledge_chunk_embeddings
  using hnsw ((embedding::extensions.vector(640)) extensions.vector_cosine_ops)
  where model_key = 'harrier-oss-v1-270m-v1' and embedding_dimensions = 640;
