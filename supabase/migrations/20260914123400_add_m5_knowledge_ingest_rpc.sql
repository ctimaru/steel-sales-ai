create or replace function public.ingest_knowledge_upload(
  p_owner_id uuid,
  p_external_id text,
  p_document_type text,
  p_title text,
  p_filename text,
  p_mime_type text,
  p_storage_path text,
  p_content_checksum text,
  p_extraction_method text,
  p_extraction_version text,
  p_language_code text,
  p_chunks jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_source_id uuid;
  v_existing_id uuid;
  v_previous_id uuid;
  v_document_id uuid;
  v_chunk_count integer := 0;
begin
  if p_owner_id is null then
    raise exception 'owner_id is required for private knowledge ingestion';
  end if;
  if p_content_checksum is null or length(p_content_checksum) < 16 then
    raise exception 'content checksum is required';
  end if;
  if jsonb_typeof(coalesce(p_chunks, '[]'::jsonb)) <> 'array' then
    raise exception 'chunks must be a JSON array';
  end if;

  insert into public.knowledge_sources (
    owner_id, access_scope, source_key, source_type, source_class, name,
    provider, language_code, trust_score, metadata
  ) values (
    p_owner_id, 'owner', 'internal-commercial-archive', 'commercial_archive',
    'internal', 'Internal commercial archive', 'steel-sales-ai-worker',
    p_language_code, 1, '{"managed_by":"worker"}'::jsonb
  ) on conflict do nothing;

  select id into v_source_id
  from public.knowledge_sources
  where owner_id = p_owner_id
    and access_scope = 'owner'
    and source_key = 'internal-commercial-archive';

  if v_source_id is null then
    raise exception 'could not resolve knowledge source';
  end if;

  select id into v_existing_id
  from public.knowledge_documents
  where source_id = v_source_id
    and checksum_algorithm = 'sha256'
    and content_checksum = p_content_checksum
  limit 1;

  if v_existing_id is not null then
    select count(*) into v_chunk_count
    from public.knowledge_chunks where document_id = v_existing_id;
    return jsonb_build_object(
      'document_id', v_existing_id,
      'source_id', v_source_id,
      'deduplicated', true,
      'chunk_count', v_chunk_count
    );
  end if;

  select id into v_previous_id
  from public.knowledge_documents
  where source_id = v_source_id
    and external_id = p_external_id
  order by created_at desc
  limit 1;

  insert into public.knowledge_documents (
    source_id, external_id, document_type, title, filename, mime_type,
    storage_path, checksum_algorithm, content_checksum, document_version,
    language_code, extracted_at, extraction_method, extraction_version,
    status, supersedes_document_id, metadata
  ) values (
    v_source_id, p_external_id, p_document_type, p_title, p_filename, p_mime_type,
    p_storage_path, 'sha256', p_content_checksum, left(p_content_checksum, 16),
    p_language_code, now(), p_extraction_method, p_extraction_version,
    'ready', v_previous_id, jsonb_build_object('ingest_origin', 'worker_upload')
  ) returning id into v_document_id;

  if v_previous_id is not null then
    update public.knowledge_documents
    set status = 'superseded', updated_at = now()
    where id = v_previous_id and status = 'ready';
  end if;

  insert into public.knowledge_chunks (
    source_id, document_id, chunk_index, content, checksum_algorithm,
    content_checksum, language_code, token_count, char_start, char_end,
    page_start, page_end, section_path, source_locator, metadata
  )
  select
    v_source_id,
    v_document_id,
    (item->>'chunk_index')::integer,
    item->>'content',
    'sha256',
    item->>'content_checksum',
    nullif(item->>'language_code', ''),
    nullif(item->>'token_count', '')::integer,
    nullif(item->>'char_start', '')::integer,
    nullif(item->>'char_end', '')::integer,
    nullif(item->>'page_start', '')::integer,
    nullif(item->>'page_end', '')::integer,
    coalesce(array(select jsonb_array_elements_text(coalesce(item->'section_path', '[]'::jsonb))), '{}'::text[]),
    coalesce(item->'source_locator', '{}'::jsonb),
    coalesce(item->'metadata', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_chunks, '[]'::jsonb)) as item;

  get diagnostics v_chunk_count = row_count;

  return jsonb_build_object(
    'document_id', v_document_id,
    'source_id', v_source_id,
    'deduplicated', false,
    'chunk_count', v_chunk_count,
    'supersedes_document_id', v_previous_id
  );
end;
$$;

revoke all on function public.ingest_knowledge_upload(uuid,text,text,text,text,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.ingest_knowledge_upload(uuid,text,text,text,text,text,text,text,text,text,text,jsonb) to service_role;

comment on function public.ingest_knowledge_upload(uuid,text,text,text,text,text,text,text,text,text,text,jsonb) is
  'Atomically deduplicates/version-controls a private uploaded document and persists its deterministic knowledge chunks.';
