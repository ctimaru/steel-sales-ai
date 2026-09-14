alter table public.worker_jobs
  add column if not exists knowledge_document_id uuid references public.knowledge_documents(id) on delete set null,
  add column if not exists knowledge_chunk_count integer not null default 0 check (knowledge_chunk_count >= 0),
  add column if not exists knowledge_deduplicated boolean;

create index if not exists worker_jobs_knowledge_document_id_idx
  on public.worker_jobs (knowledge_document_id)
  where knowledge_document_id is not null;
