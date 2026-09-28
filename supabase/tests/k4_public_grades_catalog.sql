-- K4 — Public Grades Catalog acceptance.
begin;

create or replace function pg_temp.k4_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'K4 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.k4_assert(
  (
    select count(*)=10
    from public.steel_knowledge_grade_pages
    where page_status='published'
      and slug in (
        'p235gh','p265gh','16mo3',
        'p235tr1','p235tr2','p265tr1','p265tr2',
        's355j2h','s355nh','s355nlh'
      )
  ),
  'the initial K4 grade cluster must publish ten reviewed pages'
);

select pg_temp.k4_assert(
  not exists (
    select 1
    from public.steel_knowledge_grade_pages
    where page_status='published'
      and (
        last_reviewed_at is null
        or jsonb_array_length(source_references)=0
        or nullif(btrim(coalesce(seo_description,'')),'') is null
        or nullif(btrim(coalesce(designation_explanation,'')),'') is null
        or jsonb_array_length(faq)=0
        or jsonb_array_length(editorial_sections)=0
      )
  ),
  'every published grade must have freshness, sources and complete editorial copy'
);

select pg_temp.k4_assert(
  not has_table_privilege('anon','public.steel_knowledge_grade_pages','SELECT')
  and not has_table_privilege('anon','public.steel_material_grades','SELECT'),
  'K4 must keep grade backing tables private'
);

set local role anon;

select count(*) as cluster_count
from public.k2_public_knowledge_grades(null,250,0)
where slug in (
  'p235gh','p265gh','16mo3',
  'p235tr1','p235tr2','p265tr1','p265tr2',
  's355j2h','s355nh','s355nlh'
)
\gset

select count(*) as en10217_1_grade_count
from public.k2_public_knowledge_grades('EN 10217-1',250,0)
where slug in ('p235tr1','p235tr2','p265tr1','p265tr2')
\gset

select count(*) as structural_grade_count
from public.k2_public_knowledge_grades('S355',250,0)
where slug in ('s355j2h','s355nh','s355nlh')
\gset

select to_jsonb(x) as p265gh_detail
from public.k2_public_knowledge_grade('p265gh') x
\gset

select to_jsonb(x) as s355j2h_detail
from public.k2_public_knowledge_grade('s355j2h') x
\gset

reset role;

select pg_temp.k4_assert(
  :'cluster_count'::integer=10,
  'anonymous catalog must expose all ten K4 grades'
);

select pg_temp.k4_assert(
  :'en10217_1_grade_count'::integer=4,
  'search by related standard code must discover the four TR grades in the K4 cluster'
);

select pg_temp.k4_assert(
  :'structural_grade_count'::integer=3,
  'search by S355 must discover the three structural K4 grades'
);

select pg_temp.k4_assert(
  jsonb_typeof(:'p265gh_detail'::jsonb->'source_references')='array'
  and jsonb_array_length(:'p265gh_detail'::jsonb->'source_references')>=2
  and (:'p265gh_detail'::jsonb->>'last_reviewed_at')='2026-09-28',
  'public grade detail must expose reviewed references and freshness'
);

select pg_temp.k4_assert(
  exists (
    select 1
    from jsonb_array_elements(:'p265gh_detail'::jsonb->'related_grade_pages') rel
    where rel->>'slug'='p235gh'
  )
  and exists (
    select 1
    from jsonb_array_elements(:'p265gh_detail'::jsonb->'related_grade_pages') rel
    where rel->>'slug'='16mo3'
  ),
  'P265GH must link to the adjacent reviewed elevated-temperature grade pages'
);

select pg_temp.k4_assert(
  exists (
    select 1
    from jsonb_array_elements(:'p265gh_detail'::jsonb->'related_standards') rel
    where rel->>'slug'='en-10216-2'
  )
  and exists (
    select 1
    from jsonb_array_elements(:'p265gh_detail'::jsonb->'related_standards') rel
    where rel->>'slug'='en-10217-2'
  ),
  'P265GH must link bidirectionally into the published standards cluster'
);

select pg_temp.k4_assert(
  exists (
    select 1
    from jsonb_array_elements(:'s355j2h_detail'::jsonb->'related_standards') rel
    where rel->>'slug'='en-10210'
  )
  and exists (
    select 1
    from jsonb_array_elements(:'s355j2h_detail'::jsonb->'related_standards') rel
    where rel->>'slug'='en-10219'
  ),
  'S355J2H must link to both published structural standard families'
);

select pg_temp.k4_assert(
  not (:'p265gh_detail'::jsonb ? 'knowledge_source_id')
  and not (:'p265gh_detail'::jsonb ? 'source_locator')
  and not (:'p265gh_detail'::jsonb ? 'metadata'),
  'public grade detail must not leak internal provenance payloads'
);

rollback;
