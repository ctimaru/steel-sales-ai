create or replace function public.get_embedding_benchmark_cases(
  p_limit integer default 40
)
returns table (
  case_key text,
  language_code text,
  query_text text,
  target_chunk_ids uuid[],
  target_count integer,
  signature jsonb
)
language sql
stable
set search_path = ''
as $$
  with mapped as (
    select
      o.id as observation_id,
      c.id as chunk_id,
      o.grade,
      o.standard,
      o.outer_diameter_mm,
      o.width_mm,
      o.height_mm,
      o.thickness_mm,
      o.item_role
    from public.commercial_observations o
    join public.knowledge_chunks c
      on nullif(c.source_locator->>'observation_id', '')::bigint = o.id
    where o.grade is not null
      and o.thickness_mm is not null
      and (o.outer_diameter_mm is not null or (o.width_mm is not null and o.height_mm is not null))
  ), grouped as (
    select
      grade,
      standard,
      outer_diameter_mm,
      width_mm,
      height_mm,
      thickness_mm,
      item_role,
      array_agg(chunk_id order by chunk_id) as target_chunk_ids,
      count(*)::integer as target_count
    from mapped
    group by grade, standard, outer_diameter_mm, width_mm, height_mm, thickness_mm, item_role
  ), ranked as (
    select
      g.*,
      row_number() over (
        order by target_count desc, grade, standard nulls last,
          outer_diameter_mm nulls last, width_mm nulls last, height_mm nulls last,
          thickness_mm, item_role
      ) as rank_no,
      case
        when outer_diameter_mm is not null then
          concat('Ø ', trim(to_char(outer_diameter_mm, 'FM999999990.###')), ' x ', trim(to_char(thickness_mm, 'FM999999990.###')), ' mm')
        else
          concat(trim(to_char(width_mm, 'FM999999990.###')), ' x ', trim(to_char(height_mm, 'FM999999990.###')), ' x ', trim(to_char(thickness_mm, 'FM999999990.###')), ' mm')
      end as dims
    from grouped g
  ), base as (
    select * from ranked
    order by rank_no
    limit greatest(1, least(ceil(p_limit / 2.0)::integer, 100))
  )
  select
    encode(
      extensions.digest(
        convert_to(concat_ws('|', b.grade, coalesce(b.standard, ''), b.dims, b.item_role, lang.language_code), 'UTF8'),
        'sha256'
      ),
      'hex'
    ) as case_key,
    lang.language_code,
    case lang.language_code
      when 'it' then concat(
        case b.item_role
          when 'requested' then 'Trova richieste per '
          when 'offered' then 'Trova offerte per '
          when 'ordered' then 'Trova ordini per '
          when 'delivered' then 'Trova consegne per '
          else 'Trova informazioni per '
        end,
        b.grade,
        case when b.standard is not null then concat(' ', b.standard) else '' end,
        ', dimensioni ', b.dims
      )
      else concat(
        case b.item_role
          when 'requested' then 'Find requests for '
          when 'offered' then 'Find offers for '
          when 'ordered' then 'Find orders for '
          when 'delivered' then 'Find deliveries for '
          else 'Find information for '
        end,
        b.grade,
        case when b.standard is not null then concat(' ', b.standard) else '' end,
        ', dimensions ', b.dims
      )
    end as query_text,
    b.target_chunk_ids,
    b.target_count,
    jsonb_strip_nulls(jsonb_build_object(
      'grade', b.grade,
      'standard', b.standard,
      'outer_diameter_mm', b.outer_diameter_mm,
      'width_mm', b.width_mm,
      'height_mm', b.height_mm,
      'thickness_mm', b.thickness_mm,
      'item_role', b.item_role
    )) as signature
  from base b
  cross join (values ('it'::text), ('en'::text)) as lang(language_code)
  order by b.rank_no, lang.language_code
  limit greatest(1, least(p_limit, 200));
$$;

create or replace function public.search_embedding_benchmark(
  p_model_key text,
  p_query_embedding real[],
  p_match_count integer default 10
)
returns table (
  chunk_id uuid,
  distance double precision
)
language sql
stable
set search_path = ''
as $$
  select
    e.chunk_id,
    (e.embedding OPERATOR(extensions.<=>) (p_query_embedding::extensions.vector))::double precision as distance
  from public.knowledge_chunk_embeddings e
  join public.knowledge_documents d on d.id = e.document_id
  where e.model_key = p_model_key
    and d.status = 'ready'
    and extensions.vector_dims(e.embedding) = cardinality(p_query_embedding)
  order by e.embedding OPERATOR(extensions.<=>) (p_query_embedding::extensions.vector)
  limit greatest(1, least(p_match_count, 100));
$$;

revoke all on function public.get_embedding_benchmark_cases(integer) from public, anon, authenticated;
revoke all on function public.search_embedding_benchmark(text, real[], integer) from public, anon, authenticated;
grant execute on function public.get_embedding_benchmark_cases(integer) to service_role;
grant execute on function public.search_embedding_benchmark(text, real[], integer) to service_role;

comment on function public.get_embedding_benchmark_cases(integer) is
  'Builds deterministic bilingual IT/EN embedding benchmark cases from structured commercial observations linked to real knowledge chunks.';
comment on function public.search_embedding_benchmark(text, real[], integer) is
  'Service-role vector search helper used only by the M5.2 embedding model benchmark.';
