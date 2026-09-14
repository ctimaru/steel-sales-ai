create index knowledge_chunk_embeddings_chunk_lineage_fk_idx
  on public.knowledge_chunk_embeddings (chunk_id, document_id, source_id);

create policy knowledge_embedding_models_no_browser_access
  on public.knowledge_embedding_models
  for select
  to anon, authenticated
  using (false);

create policy knowledge_chunk_embeddings_no_browser_access
  on public.knowledge_chunk_embeddings
  for select
  to anon, authenticated
  using (false);
