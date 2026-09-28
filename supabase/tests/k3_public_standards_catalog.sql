-- K3 — Public Standards Catalog acceptance.
begin;

create or replace function pg_temp.k3_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'K3 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.k3_assert(
  (
    select count(*)=6
    from public.steel_knowledge_standard_pages
    where page_status='published'
      and slug in (
        'en-10210',
        'en-10219',
        'en-10216-2',
        'en-10217-1',
        'en-10217-2',
        'en-10224'
      )
  ),
  'the initial K3 standards cluster must publish six reviewed pages'
);

select pg_temp.k3_assert(
  not exists (
    select 1
    from public.steel_knowledge_standard_pages
    where page_status='published'
      and (
        last_reviewed_at is null
        or jsonb_array_length(source_references)=0
        or nullif(btrim(coalesce(seo_description,'')),'') is null
        or jsonb_array_length(faq)=0
        or jsonb_array_length(editorial_sections)=0
      )
  ),
  'every published standard must have review date, official references, SEO copy, FAQ and editorial sections'
);

select pg_temp.k3_assert(
  not has_table_privilege('anon','public.steel_knowledge_standard_pages','SELECT')
  and not has_table_privilege('anon','public.steel_standards','SELECT'),
  'K3 must keep backing tables private'
);

set local role anon;

select count(*) as cluster_count
from public.k2_public_knowledge_standards(null,250,0)
where slug in (
  'en-10210',
  'en-10219',
  'en-10216-2',
  'en-10217-1',
  'en-10217-2',
  'en-10224'
)
\gset

select count(*) as elevated_temperature_count
from public.k2_public_knowledge_standards('temperatura elevata',250,0)
where slug in ('en-10216-2','en-10217-2')
\gset

select to_jsonb(x) as en10219_detail
from public.k2_public_knowledge_standard('en-10219') x
\gset

select to_jsonb(x) as en10216_detail
from public.k2_public_knowledge_standard('en-10216-2') x
\gset

reset role;

select pg_temp.k3_assert(
  :'cluster_count'::integer=6,
  'anonymous catalog must expose all six K3 standards'
);

select pg_temp.k3_assert(
  :'elevated_temperature_count'::integer=2,
  'catalog search must find the two elevated-temperature standards in the K3 cluster'
);

select pg_temp.k3_assert(
  jsonb_typeof(:'en10219_detail'::jsonb->'source_references')='array'
  and jsonb_array_length(:'en10219_detail'::jsonb->'source_references')>=2
  and (:'en10219_detail'::jsonb->>'last_reviewed_at')='2026-09-28',
  'public detail must expose reviewed official references and freshness'
);

select pg_temp.k3_assert(
  exists (
    select 1
    from jsonb_array_elements(:'en10219_detail'::jsonb->'source_references') ref
    where ref->>'publisher'='UNI'
      and ref->>'url' like 'https://store.uni.com/%'
  ),
  'EN 10219 must expose at least one official UNI reference'
);

select pg_temp.k3_assert(
  exists (
    select 1
    from jsonb_array_elements(:'en10219_detail'::jsonb->'related_standard_pages') rel
    where rel->>'slug'='en-10210'
  ),
  'EN 10219 must link editorially to EN 10210'
);

select pg_temp.k3_assert(
  exists (
    select 1
    from jsonb_array_elements(:'en10216_detail'::jsonb->'related_standard_pages') rel
    where rel->>'slug'='en-10217-2'
  ),
  'EN 10216-2 must link editorially to the welded elevated-temperature counterpart'
);

select pg_temp.k3_assert(
  not (:'en10219_detail'::jsonb ? 'knowledge_source_id')
  and not (:'en10219_detail'::jsonb ? 'source_locator')
  and not (:'en10219_detail'::jsonb ? 'metadata'),
  'public standard detail must not leak internal provenance payloads'
);

rollback;
