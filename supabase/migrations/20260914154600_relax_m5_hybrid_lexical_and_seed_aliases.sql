create or replace function public.relaxed_knowledge_tsquery(p_text text)
returns tsquery
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when cardinality(
      tsvector_to_array(to_tsvector('pg_catalog.simple'::regconfig, p_text))
    ) = 0 then
      websearch_to_tsquery('pg_catalog.simple'::regconfig, '')
    else
      to_tsquery(
        'pg_catalog.simple'::regconfig,
        array_to_string(
          tsvector_to_array(to_tsvector('pg_catalog.simple'::regconfig, p_text)),
          ' | '
        )
      )
  end
$$;

with aliases(canonical_key, alias, language_code) as (
  values
    ('rectangulartube', 'rectangular tube', 'en'),
    ('rectangulartube', 'rectangular tubes', 'en'),
    ('rectangulartube', 'tubo rettangolare', 'it'),
    ('rectangulartube', 'tubi rettangolari', 'it'),
    ('rectangulartube', 'tubolare rettangolare', 'it'),
    ('rectangulartube', 'tubolari rettangolari', 'it'),
    ('squaretube', 'square tube', 'en'),
    ('squaretube', 'square tubes', 'en'),
    ('squaretube', 'tubo quadro', 'it'),
    ('squaretube', 'tubi quadri', 'it'),
    ('squaretube', 'tubolare quadro', 'it'),
    ('squaretube', 'tubolari quadri', 'it'),
    ('roundtube', 'round tube', 'en'),
    ('roundtube', 'round tubes', 'en'),
    ('roundtube', 'circular tube', 'en'),
    ('roundtube', 'tubo tondo', 'it'),
    ('roundtube', 'tubi tondi', 'it'),
    ('roundtube', 'tubolare tondo', 'it'),
    ('roundtube', 'tubolari tondi', 'it')
)
insert into public.knowledge_entity_aliases (
  entity_id,
  alias,
  normalized_alias,
  language_code,
  alias_type,
  confidence,
  metadata
)
select
  e.id,
  a.alias,
  public.normalize_knowledge_entity_value(a.alias),
  a.language_code,
  'synonym',
  1,
  jsonb_build_object('seed', 'm5.5-retrieval')
from aliases a
join public.knowledge_entities e
  on e.access_scope = 'global'
 and e.entity_type = 'product_family'
 and e.canonical_key = a.canonical_key
on conflict (entity_id, normalized_alias) do nothing;

create or replace function public.hybrid_search_knowledge(
  p_owner_id uuid,
  p_query_text text,
  p_query_embedding real[],
  p_match_count integer default 10,
  p_candidate_count integer default 60,
  p_entity_filters jsonb default '{}'::jsonb,
  p_commercial_filters jsonb default '{}'::jsonb,
  p_rrf_k integer default 60
)
returns table (
  chunk_id uuid,
  source_id uuid,
  document_id uuid,
  content text,
  language_code text,
  title text,
  filename text,
  document_type text,
  source_name text,
  source_class text,
  source_uri text,
  page_start integer,
  page_end integer,
  section_path text[],
  source_locator jsonb,
  chunk_metadata jsonb,
  vector_similarity double precision,
  lexical_score double precision,
  entity_match_count integer,
  rrf_score double precision,
  matched_entities jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with params as (
    select
      greatest(1, least(p_match_count, 50)) as match_count,
      greatest(10, least(p_candidate_count, 250)) as candidate_count,
      greatest(1, least(p_rrf_k, 500))::double precision as rrf_k,
      public.normalize_knowledge_entity_value(p_query_text) as normalized_query,
      public.relaxed_knowledge_tsquery(p_query_text) as ts_query
  ),
  active_model as (
    select m.model_key, m.dimensions
    from public.knowledge_embedding_models m
    where m.status = 'active'
    order by m.updated_at desc
    limit 1
  ),
  requested_filters as (
    select
      filter_entry.key as entity_type,
      public.normalize_knowledge_entity_value(filter_value.value) as normalized_value
    from jsonb_each(coalesce(p_entity_filters, '{}'::jsonb)) filter_entry
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(filter_entry.value) = 'array' then filter_entry.value
        else '[]'::jsonb
      end
    ) filter_value
    where filter_entry.key in (
      'company', 'plant', 'country', 'standard', 'product_family',
      'grade', 'process', 'application'
    )
  ),
  filter_types as (
    select distinct entity_type from requested_filters
  ),
  requested_filter_entities as (
    select distinct rf.entity_type, e.id as entity_id
    from requested_filters rf
    join public.knowledge_entities e
      on e.entity_type = rf.entity_type
     and (e.access_scope = 'global' or e.owner_id = p_owner_id)
     and (
       e.canonical_key = rf.normalized_value
       or exists (
         select 1
         from public.knowledge_entity_aliases a
         where a.entity_id = e.id
           and a.normalized_alias = rf.normalized_value
       )
     )
  ),
  chunk_observations as (
    select distinct
      kc.id as chunk_id,
      nullif(kc.source_locator ->> 'observation_id', '')::bigint as observation_id
    from public.knowledge_chunks kc
    where kc.source_locator ? 'observation_id'
      and nullif(kc.source_locator ->> 'observation_id', '') is not null
    union
    select distinct
      m.chunk_id,
      m.observation_id
    from public.knowledge_entity_mentions m
    where m.chunk_id is not null
      and m.observation_id is not null
  ),
  chunk_entities as (
    select distinct m.chunk_id, m.entity_id
    from public.knowledge_entity_mentions m
    where m.chunk_id is not null
    union
    select distinct kc.id as chunk_id, m.entity_id
    from public.knowledge_entity_mentions m
    join public.knowledge_chunks kc
      on m.chunk_id is null
     and m.observation_id is not null
     and kc.source_locator ->> 'observation_id' = m.observation_id::text
  ),
  visible as (
    select
      kc.*,
      d.title,
      d.filename,
      d.document_type,
      s.name as source_name,
      s.source_class,
      coalesce(d.source_uri, s.source_uri) as resolved_source_uri,
      ce.embedding,
      ce.model_key,
      am.dimensions
    from public.knowledge_chunks kc
    join public.knowledge_documents d
      on d.id = kc.document_id
     and d.status = 'ready'
    join public.knowledge_sources s
      on s.id = kc.source_id
     and (s.access_scope = 'global' or s.owner_id = p_owner_id)
    cross join active_model am
    join public.knowledge_chunk_embeddings ce
      on ce.chunk_id = kc.id
     and ce.model_key = am.model_key
     and ce.content_checksum = kc.content_checksum
     and ce.embedding_dimensions = am.dimensions
  ),
  eligible as (
    select v.*
    from visible v
    where
      not exists (
        select 1
        from filter_types ft
        where not exists (
          select 1
          from requested_filter_entities rfe
          join chunk_entities cex
            on cex.entity_id = rfe.entity_id
           and cex.chunk_id = v.id
          where rfe.entity_type = ft.entity_type
        )
      )
      and (
        coalesce(p_commercial_filters, '{}'::jsonb) = '{}'::jsonb
        or exists (
          select 1
          from chunk_observations co
          join public.commercial_observations o
            on o.id = co.observation_id
           and o.owner_id = p_owner_id
          where co.chunk_id = v.id
            and (
              not (p_commercial_filters ? 'item_role')
              or lower(coalesce(o.item_role, '')) = lower(p_commercial_filters ->> 'item_role')
            )
            and (
              not (p_commercial_filters ? 'outer_diameter_mm')
              or o.outer_diameter_mm = (p_commercial_filters ->> 'outer_diameter_mm')::numeric
            )
            and (
              not (p_commercial_filters ? 'width_mm')
              or o.width_mm = (p_commercial_filters ->> 'width_mm')::numeric
            )
            and (
              not (p_commercial_filters ? 'height_mm')
              or o.height_mm = (p_commercial_filters ->> 'height_mm')::numeric
            )
            and (
              not (p_commercial_filters ? 'thickness_mm')
              or o.thickness_mm = (p_commercial_filters ->> 'thickness_mm')::numeric
            )
            and (
              not (p_commercial_filters ? 'length_mm')
              or o.length_mm = (p_commercial_filters ->> 'length_mm')::numeric
            )
        )
      )
  ),
  query_entity_candidates as (
    select distinct on (matched.entity_id, matched.matched_key)
      matched.entity_id,
      matched.entity_type,
      matched.canonical_name,
      matched.matched_key,
      length(matched.matched_key) as match_length
    from (
      select
        e.id as entity_id,
        e.entity_type,
        e.canonical_name,
        e.canonical_key as matched_key
      from public.knowledge_entities e
      cross join params p
      where (e.access_scope = 'global' or e.owner_id = p_owner_id)
        and length(e.canonical_key) >= 3
        and position(e.canonical_key in p.normalized_query) > 0
      union all
      select
        e.id,
        e.entity_type,
        e.canonical_name,
        a.normalized_alias
      from public.knowledge_entities e
      join public.knowledge_entity_aliases a on a.entity_id = e.id
      cross join params p
      where (e.access_scope = 'global' or e.owner_id = p_owner_id)
        and length(a.normalized_alias) >= 3
        and position(a.normalized_alias in p.normalized_query) > 0
    ) matched
    order by matched.entity_id, matched.matched_key, length(matched.matched_key) desc
  ),
  query_entities as (
    select qec.*
    from query_entity_candidates qec
    where not exists (
      select 1
      from query_entity_candidates longer
      where longer.entity_type = qec.entity_type
        and longer.entity_id <> qec.entity_id
        and longer.match_length > qec.match_length
        and position(qec.matched_key in longer.matched_key) > 0
    )
  ),
  vector_candidates as (
    select
      e.id as chunk_id,
      (1 - (
        e.embedding OPERATOR(extensions.<=>) (p_query_embedding::extensions.vector)
      ))::double precision as vector_similarity,
      row_number() over (
        order by e.embedding OPERATOR(extensions.<=>) (p_query_embedding::extensions.vector)
      )::integer as vector_rank
    from eligible e
    cross join params p
    where cardinality(p_query_embedding) = e.dimensions
    order by e.embedding OPERATOR(extensions.<=>) (p_query_embedding::extensions.vector)
    limit (select candidate_count from params)
  ),
  lexical_candidates as (
    select
      e.id as chunk_id,
      ts_rank_cd(e.search_vector, p.ts_query)::double precision as lexical_score,
      row_number() over (
        order by ts_rank_cd(e.search_vector, p.ts_query) desc, e.id
      )::integer as lexical_rank
    from eligible e
    cross join params p
    where e.search_vector @@ p.ts_query
    order by lexical_score desc, e.id
    limit (select candidate_count from params)
  ),
  entity_signals as (
    select
      e.id as chunk_id,
      count(distinct qe.entity_id)::integer as entity_match_count,
      jsonb_agg(
        distinct jsonb_build_object(
          'entity_id', qe.entity_id,
          'entity_type', qe.entity_type,
          'canonical_name', qe.canonical_name
        )
      ) as matched_entities
    from eligible e
    join chunk_entities cex on cex.chunk_id = e.id
    join query_entities qe on qe.entity_id = cex.entity_id
    group by e.id
  ),
  candidate_ids as (
    select chunk_id from vector_candidates
    union
    select chunk_id from lexical_candidates
  ),
  scored as (
    select
      e.*,
      vc.vector_similarity,
      vc.vector_rank,
      lc.lexical_score,
      lc.lexical_rank,
      coalesce(es.entity_match_count, 0) as entity_match_count,
      coalesce(es.matched_entities, '[]'::jsonb) as matched_entities,
      (
        case when vc.vector_rank is not null
          then 1.0 / (p.rrf_k + vc.vector_rank)
          else 0.0 end
        + case when lc.lexical_rank is not null
          then 1.0 / (p.rrf_k + lc.lexical_rank)
          else 0.0 end
        + least(coalesce(es.entity_match_count, 0), 3) * 0.02
      )::double precision as rrf_score
    from candidate_ids ci
    join eligible e on e.id = ci.chunk_id
    cross join params p
    left join vector_candidates vc on vc.chunk_id = e.id
    left join lexical_candidates lc on lc.chunk_id = e.id
    left join entity_signals es on es.chunk_id = e.id
  )
  select
    s.id as chunk_id,
    s.source_id,
    s.document_id,
    s.content,
    s.language_code,
    s.title,
    s.filename,
    s.document_type,
    s.source_name,
    s.source_class,
    s.resolved_source_uri as source_uri,
    s.page_start,
    s.page_end,
    s.section_path,
    s.source_locator,
    s.metadata as chunk_metadata,
    s.vector_similarity,
    s.lexical_score,
    s.entity_match_count,
    s.rrf_score,
    s.matched_entities
  from scored s
  order by s.rrf_score desc, s.vector_similarity desc nulls last, s.lexical_score desc nulls last
  limit (select match_count from params);
$$;

revoke all on function public.relaxed_knowledge_tsquery(text) from public, anon;
grant execute on function public.relaxed_knowledge_tsquery(text) to authenticated, service_role;