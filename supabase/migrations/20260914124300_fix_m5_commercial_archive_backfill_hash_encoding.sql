create or replace function public.backfill_commercial_archive_knowledge(
  p_owner_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_group record;
  v_result jsonb;
  v_documents integer := 0;
  v_deduplicated integer := 0;
  v_chunks integer := 0;
begin
  if p_owner_id is null then
    raise exception 'owner_id is required';
  end if;

  for v_group in
    with ranked as (
      select
        o.*,
        (row_number() over (
          partition by o.owner_id, o.thread_id, o.source_filename
          order by o.id
        ) - 1)::integer as chunk_index,
        encode(
          extensions.digest(convert_to(o.source_text, 'UTF8'), 'sha256'),
          'hex'
        ) as chunk_checksum,
        greatest(1, cardinality(regexp_split_to_array(trim(o.source_text), E'\\s+'))) as token_count
      from public.commercial_observations o
      where o.owner_id = p_owner_id
        and o.source_text is not null
        and length(trim(o.source_text)) > 0
    )
    select
      r.thread_id,
      r.source_filename,
      coalesce(nullif(t.subject, ''), nullif(r.source_filename, ''), 'Commercial archive') as title,
      encode(
        extensions.digest(
          convert_to(string_agg(r.source_text, E'\n' order by r.id), 'UTF8'),
          'sha256'
        ),
        'hex'
      ) as document_checksum,
      jsonb_agg(
        jsonb_build_object(
          'chunk_index', r.chunk_index,
          'content', r.source_text,
          'content_checksum', r.chunk_checksum,
          'language_code', 'und',
          'token_count', r.token_count,
          'section_path', jsonb_build_array('Commercial archive', coalesce(r.source_filename, 'unknown file')),
          'source_locator', jsonb_strip_nulls(jsonb_build_object(
            'kind', 'commercial_observation',
            'observation_id', r.id,
            'source_extraction_id', r.source_extraction_id,
            'thread_id', r.thread_id,
            'source_filename', r.source_filename
          )),
          'metadata', jsonb_strip_nulls(jsonb_build_object(
            'item_role', r.item_role,
            'direction', r.direction,
            'confidence', r.confidence,
            'backfill_version', 'commercial-archive-v1'
          ))
        ) order by r.chunk_index
      ) as chunks
    from ranked r
    left join public.commercial_threads t on t.id = r.thread_id
    group by r.owner_id, r.thread_id, r.source_filename, t.subject
    order by r.thread_id, r.source_filename
  loop
    select public.ingest_knowledge_upload(
      p_owner_id,
      concat('commercial-thread:', v_group.thread_id::text, ':file:', coalesce(v_group.source_filename, 'unknown')),
      'commercial_archive_extract',
      v_group.title,
      v_group.source_filename,
      'text/plain',
      null,
      v_group.document_checksum,
      'commercial-observations-backfill',
      'v1',
      'und',
      v_group.chunks
    ) into v_result;

    v_documents := v_documents + 1;
    v_chunks := v_chunks + coalesce((v_result->>'chunk_count')::integer, 0);
    if coalesce((v_result->>'deduplicated')::boolean, false) then
      v_deduplicated := v_deduplicated + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'groups_processed', v_documents,
    'deduplicated_groups', v_deduplicated,
    'chunk_count', v_chunks
  );
end;
$$;
