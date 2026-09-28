-- K6 — Indexable Dimension Pages & SEO Scale-Up acceptance.
begin;

create or replace function pg_temp.k6_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'K6 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.k6_assert(
  not has_table_privilege('anon','public.steel_geometries','SELECT')
  and not has_table_privilege('anon','public.steel_weight_references','SELECT')
  and not has_table_privilege('anon','public.knowledge_sources','SELECT'),
  'K6 must preserve private backing tables'
);

select pg_temp.k6_assert(
  not has_function_privilege('anon','public.k6_slug_number(numeric)','EXECUTE')
  and not has_function_privilege('anon','public.k6_dimension_slug(text,numeric,numeric,numeric,numeric)','EXECUTE'),
  'K6 slug helpers are internal implementation details'
);

set local role anon;

select count(*) as page_count,
       count(distinct dimension_slug) as unique_slug_count
from public.k6_public_tube_dimension_pages(null,500,0)
\gset

select count(*) as round_count
from public.k6_public_tube_dimension_pages('round_tube',500,0)
\gset

select count(*) as square_count
from public.k6_public_tube_dimension_pages('square_tube',500,0)
\gset

select count(*) as rectangular_count
from public.k6_public_tube_dimension_pages('rectangular_tube',500,0)
\gset

select to_jsonb(x) as round_detail
from public.k6_public_tube_dimension_page('tondo-406-4x6-3') x
\gset

select to_jsonb(x) as square_detail
from public.k6_public_tube_dimension_page('quadro-100x100x5') x
\gset

reset role;

select pg_temp.k6_assert(
  :'page_count'::integer=109
  and :'unique_slug_count'::integer=109,
  'K6 must expose one unique crawlable page for each canonical K5 reference'
);

select pg_temp.k6_assert(
  :'round_count'::integer=59
  and :'square_count'::integer=27
  and :'rectangular_count'::integer=23,
  'K6 dimension-page counts must preserve the three K5 public families'
);

select pg_temp.k6_assert(
  (:'round_detail'::jsonb->>'weight_kg_m')::numeric=62.2
  and (:'round_detail'::jsonb->>'outer_diameter_mm')::numeric=406.4
  and (:'round_detail'::jsonb->>'thickness_mm')::numeric=6.3,
  'tondo-406-4x6-3 must resolve to the exact canonical 406.4 x 6.3 reference'
);

select pg_temp.k6_assert(
  (:'square_detail'::jsonb->>'weight_kg_m')::numeric=14.4
  and (:'square_detail'::jsonb->>'width_mm')::numeric=100
  and (:'square_detail'::jsonb->>'height_mm')::numeric=100
  and (:'square_detail'::jsonb->>'thickness_mm')::numeric=5,
  'quadro-100x100x5 must resolve to the exact canonical SHS reference'
);

select pg_temp.k6_assert(
  jsonb_typeof(:'round_detail'::jsonb->'related_dimensions')='array'
  and jsonb_array_length(:'round_detail'::jsonb->'related_dimensions') between 1 and 6,
  'dimension detail must expose a small related-dimension graph'
);

select pg_temp.k6_assert(
  nullif(btrim(:'round_detail'::jsonb->>'source_provider'),'') is not null
  and nullif(btrim(:'round_detail'::jsonb->>'source_url'),'') is not null
  and nullif(btrim(:'round_detail'::jsonb->>'published_at'),'') is not null,
  'indexable dimension details must carry public source and freshness metadata'
);

select pg_temp.k6_assert(
  not (:'round_detail'::jsonb ? 'knowledge_source_id')
  and not (:'round_detail'::jsonb ? 'source_locator')
  and not (:'round_detail'::jsonb ? 'metadata')
  and not (:'round_detail'::jsonb ? 'verified_by'),
  'public dimension detail must not leak internal provenance payloads'
);

rollback;
