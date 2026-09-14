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
    select
      o.thread_id,
      o.source_filename,
      coalesce(nullif(t.subject, ''), nullif(o.source_filename, ''), 'Commercial archive') as title,
      extensions.encode(
        extensions.digest(
          convert_to(string_agg(o.source_text, E'\n' order by o.id), 'UTF8'),
          'sha256'
        ),
        'hex'
      ) as document_checksum,
      jsonb_agg(
        jsonb_build_object(
          'chunk_index', x.chunk_index,
          'content', x.source_text,
          'content_checksum', x.chunk_checksum,
          'language_code', 'und',
          'token_count', x.token_count,
          'section_path', jsonb_build_array('Commercial archive', coalesce(o.source_filename, 'unknown file')),
          'source_locator', jsonb_strip_nulls(jsonb_build_object(
            'kind', 'commercial_observation',
            'observation_id', o.id,
            'source_extraction_id', o.source_extraction_id,
            'thread_id', o.thread_id,
            'source_filename', o.source_filename
          )),
          'metadata', jsonb_strip_nulls(jsonb_build_object(
            'item_role', o.item_role,
            'direction', o.direction,
            'confidence', o.confidence,
            'backfill_version', 'commercial-archive-v1'
          ))
        ) order by x.chunk_index
      ) as chunks
    from public.commercial_observations o
    left join public.commercial_threads t on t.id = o.thread_id
    cross join lateral (
      select
        row_number() over (
          partition by o.owner_id, o.thread_id, o.source_filename
          order by o.id
        ) - 1 as chunk_index,
        o.source_text,
        extensions.encode(
          extensions.digest(convert_to(o.source_text, 'UTF8'), 'sha256'),
          'hex'
        ) as chunk_checksum,
        greatest(1, cardinality(regexp_split_to_array(trim(o.source_text), E'\\s+'))) as token_count
    ) x
    where o.owner_id = p_owner_id
      and o.source_text is not null
      and length(trim(o.source_text)) > 0
    group by o.owner_id, o.thread_id, o.source_filename, t.subject
    order by o.thread_id, o.source_filename
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

revoke all on function public.backfill_commercial_archive_knowledge(uuid) from public, anon, authenticated;
grant execute on function public.backfill_commercial_archive_knowledge(uuid) to service_role;

comment on function public.backfill_commercial_archive_knowledge(uuid) is
  'Idempotently backfills validated commercial observation source text into owner-scoped M5 knowledge documents and chunks.';
