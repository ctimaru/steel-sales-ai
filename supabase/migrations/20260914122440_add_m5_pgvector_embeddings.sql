create schema if not exists extensions;
create extension if not exists vector with schema extensions;

create table public.knowledge_embedding_models (
  id uuid primary key default gen_random_uuid(),
  model_key text not null unique,
  provider text not null,
  model_name text not null,
  model_revision text,
  dimensions integer not null check (dimensions > 0 and dimensions <= 4000),
  distance_metric text not null default 'cosine' check (distance_metric in ('cosine', 'l2', 'inner_product')),
  normalized boolean not null default true,
  max_input_tokens integer check (max_input_tokens is null or max_input_tokens > 0),
  status text not null default 'candidate' check (status in ('candidate', 'active', 'retired')),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index knowledge_embedding_models_single_active_uq
  on public.knowledge_embedding_models ((status))
  where status = 'active';

create table public.knowledge_chunk_embeddings (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null,
  document_id uuid not null,
  chunk_id uuid not null,
  model_id uuid not null references public.knowledge_embedding_models(id) on delete restrict,
  model_key text not null,
  embedding extensions.vector not null,
  embedding_dimensions integer not null check (embedding_dimensions > 0 and embedding_dimensions <= 4000),
  content_checksum text not null,
  embedded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  foreign key (chunk_id, document_id, source_id)
    references public.knowledge_chunks(id, document_id, source_id)
    on delete cascade,
  unique (chunk_id, model_id),
  check (extensions.vector_dims(embedding) = embedding_dimensions)
);

create index knowledge_chunk_embeddings_chunk_idx
  on public.knowledge_chunk_embeddings (chunk_id, model_id);

create index knowledge_chunk_embeddings_source_document_idx
  on public.knowledge_chunk_embeddings (source_id, document_id);

create index knowledge_chunk_embeddings_checksum_idx
  on public.knowledge_chunk_embeddings (model_id, content_checksum);

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
    'baai-bge-m3-v1',
    'huggingface',
    'BAAI/bge-m3',
    1024,
    'cosine',
    true,
    8192,
    'candidate',
    '{"role":"quality_candidate","modes":["dense","sparse","colbert"]}'::jsonb
  ),
  (
    'multilingual-e5-base-v1',
    'huggingface',
    'intfloat/multilingual-e5-base',
    768,
    'cosine',
    true,
    512,
    'candidate',
    '{"role":"balanced_candidate","query_prefix":"query: ","passage_prefix":"passage: "}'::jsonb
  ),
  (
    'multilingual-minilm-l12-v2',
    'huggingface',
    'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
    384,
    'cosine',
    true,
    128,
    'candidate',
    '{"role":"latency_candidate"}'::jsonb
  )
on conflict (model_key) do nothing;

create index knowledge_chunk_embeddings_bge_m3_hnsw_idx
  on public.knowledge_chunk_embeddings
  using hnsw ((embedding::extensions.vector(1024)) extensions.vector_cosine_ops)
  where model_key = 'baai-bge-m3-v1' and embedding_dimensions = 1024;

create index knowledge_chunk_embeddings_e5_base_hnsw_idx
  on public.knowledge_chunk_embeddings
  using hnsw ((embedding::extensions.vector(768)) extensions.vector_cosine_ops)
  where model_key = 'multilingual-e5-base-v1' and embedding_dimensions = 768;

create index knowledge_chunk_embeddings_minilm_hnsw_idx
  on public.knowledge_chunk_embeddings
  using hnsw ((embedding::extensions.vector(384)) extensions.vector_cosine_ops)
  where model_key = 'multilingual-minilm-l12-v2' and embedding_dimensions = 384;

alter table public.knowledge_embedding_models enable row level security;
alter table public.knowledge_chunk_embeddings enable row level security;

revoke all on table public.knowledge_embedding_models from public, anon, authenticated;
revoke all on table public.knowledge_chunk_embeddings from public, anon, authenticated;

grant select, insert, update, delete on table public.knowledge_embedding_models to service_role;
grant select, insert, update, delete on table public.knowledge_chunk_embeddings to service_role;

comment on table public.knowledge_embedding_models is
  'Versioned embedding model registry. Models remain candidates until benchmarked and explicitly activated.';
comment on table public.knowledge_chunk_embeddings is
  'Derived vector representations of knowledge_chunks. Reproducible from chunk content checksum and model version; never authoritative knowledge.';
