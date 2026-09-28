-- K2 — Standards & Grades Information Architecture acceptance.
begin;

create or replace function pg_temp.k2_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'K2 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.k2_assert(
  (
    select count(*) = (
      select count(*) from public.steel_standards where status='active'
    )
    from public.steel_knowledge_standard_pages
  ),
  'every active standard must have one editorial backlog row'
);

select pg_temp.k2_assert(
  (
    select count(*) = (
      select count(*) from public.steel_material_grades
    )
    from public.steel_knowledge_grade_pages
  ),
  'every canonical material grade must have one editorial backlog row'
);

select pg_temp.k2_assert(
  not exists (
    select 1
    from public.steel_knowledge_standard_pages
    where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  )
  and not exists (
    select 1
    from public.steel_knowledge_grade_pages
    where slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  'all public slugs must satisfy the stable URL contract'
);

select pg_temp.k2_assert(
  not has_table_privilege('anon','public.steel_knowledge_standard_pages','SELECT')
  and not has_table_privilege('anon','public.steel_knowledge_grade_pages','SELECT')
  and not has_table_privilege('anon','public.steel_standards','SELECT')
  and not has_table_privilege('anon','public.steel_material_grades','SELECT'),
  'anonymous users must not read canonical/editorial backing tables directly'
);

select pg_temp.k2_assert(
  has_function_privilege(
    'anon',
    'public.k2_public_knowledge_standards(text,integer,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'anon',
    'public.k2_public_knowledge_standard(text)',
    'EXECUTE'
  )
  and has_function_privilege(
    'anon',
    'public.k2_public_knowledge_grades(text,integer,integer)',
    'EXECUTE'
  )
  and has_function_privilege(
    'anon',
    'public.k2_public_knowledge_grade(text)',
    'EXECUTE'
  ),
  'anonymous users must have only the public Knowledge read contracts'
);

-- Publish one standard and one related grade inside this rollback-only fixture.
update public.steel_knowledge_standard_pages p
set
  page_status='published',
  seo_title='EN 10216-2 test title',
  seo_description='K2 public contract acceptance description for EN 10216-2.',
  intro='K2 acceptance intro.',
  what_it_covers='K2 acceptance scope.',
  how_to_read='K2 acceptance reading guidance.',
  typical_applications='K2 acceptance applications.',
  published_at=now(),
  updated_at=now()
from public.steel_standards s
where s.id=p.standard_id
  and s.code='EN 10216-2';

update public.steel_knowledge_grade_pages p
set
  page_status='published',
  seo_title='P265GH test title',
  seo_description='K2 public contract acceptance description for P265GH.',
  intro='K2 acceptance intro.',
  designation_explanation='K2 acceptance designation explanation.',
  typical_applications='K2 acceptance applications.',
  published_at=now(),
  updated_at=now()
from public.steel_material_grades g
where g.id=p.material_grade_id
  and g.designation='P265GH'
  and g.material_number='1.0425';

-- Force one unrelated standard page out of the public contract regardless of
-- any future editorial state.
update public.steel_knowledge_standard_pages p
set page_status='archived', updated_at=now()
from public.steel_standards s
where s.id=p.standard_id
  and s.code='EN 10216-1';

set local role anon;

select count(*) as public_standard_count
from public.k2_public_knowledge_standards('10216-2',100,0)
where slug='en-10216-2'
\gset

select count(*) as archived_standard_count
from public.k2_public_knowledge_standards('10216-1',100,0)
where slug='en-10216-1'
\gset

select to_jsonb(x) as standard_detail
from public.k2_public_knowledge_standard('en-10216-2') x
\gset

select count(*) as public_grade_count
from public.k2_public_knowledge_grades('P265GH',100,0)
\gset

select to_jsonb(x) as grade_detail
from public.k2_public_knowledge_grade('p265gh') x
\gset

reset role;

select pg_temp.k2_assert(
  :'public_standard_count'::integer=1,
  'published standard must be discoverable through the anonymous list contract'
);

select pg_temp.k2_assert(
  :'archived_standard_count'::integer=0,
  'archived standard must not leak into the anonymous list contract'
);

select pg_temp.k2_assert(
  :'public_grade_count'::integer=1,
  'published grade must be discoverable through the anonymous list contract'
);

select pg_temp.k2_assert(
  (:'standard_detail'::jsonb->>'slug')='en-10216-2'
  and (:'standard_detail'::jsonb->>'code')='EN 10216-2'
  and jsonb_typeof(:'standard_detail'::jsonb->'related_grades')='array',
  'standard detail must expose the stable slug and structured related-grade contract'
);

select pg_temp.k2_assert(
  (:'grade_detail'::jsonb->>'slug')='p265gh'
  and (:'grade_detail'::jsonb->>'designation')='P265GH'
  and jsonb_typeof(:'grade_detail'::jsonb->'related_standards')='array',
  'grade detail must expose the stable slug and structured related-standard contract'
);

select pg_temp.k2_assert(
  not (:'standard_detail'::jsonb ? 'metadata')
  and not (:'standard_detail'::jsonb ? 'source_locator')
  and not (:'grade_detail'::jsonb ? 'metadata')
  and not (:'grade_detail'::jsonb ? 'knowledge_source_id'),
  'public detail contracts must not expose internal provenance payloads or metadata blobs'
);

select pg_temp.k2_assert(
  exists (
    select 1
    from jsonb_array_elements(:'standard_detail'::jsonb->'related_grades') item
    where item ? 'applicability_type'
      and item ? 'is_normative'
  ),
  'standard-grade relationships must preserve applicability semantics'
);

rollback;
