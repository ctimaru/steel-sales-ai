create index knowledge_chunks_document_source_fk_idx
  on public.knowledge_chunks (document_id, source_id);

create index knowledge_documents_supersedes_fk_idx
  on public.knowledge_documents (supersedes_document_id)
  where supersedes_document_id is not null;

create index knowledge_evidence_chunk_document_source_fk_idx
  on public.knowledge_evidence (chunk_id, document_id, source_id)
  where chunk_id is not null;

create index knowledge_evidence_document_source_fk_idx
  on public.knowledge_evidence (document_id, source_id);
