create index knowledge_entity_bindings_company_fk_idx
  on public.knowledge_entity_bindings (company_id)
  where company_id is not null;

create index knowledge_entity_bindings_product_fk_idx
  on public.knowledge_entity_bindings (product_id)
  where product_id is not null;

create index knowledge_entity_mentions_source_fk_idx
  on public.knowledge_entity_mentions (source_id)
  where source_id is not null;

create index knowledge_entity_mentions_document_source_fk_idx
  on public.knowledge_entity_mentions (document_id, source_id)
  where document_id is not null;

create index knowledge_entity_mentions_chunk_document_source_fk_idx
  on public.knowledge_entity_mentions (chunk_id, document_id, source_id)
  where chunk_id is not null;
