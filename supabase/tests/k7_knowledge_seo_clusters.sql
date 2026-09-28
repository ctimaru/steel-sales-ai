-- K7 — Knowledge SEO Cluster & Discovery Hardening acceptance.
begin;

create or replace function pg_temp.k7_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'K7 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.k7_assert(
  not has_table_privilege('anon','public.steel_geometries','SELECT')
  and not has_table_privilege('anon','public.steel_weight_references','SELECT')
  and not has_table_privilege('anon','public.knowledge_sources','SELECT'),
  'K7 must preserve private backing tables'
);

select pg_temp.k7_assert(
  not has_function_privilege('anon','public.k7_tube_family_slug(text)','EXECUTE')
  and not has_function_privilege('anon','public.k7_tube_size_slug(text,numeric,numeric,numeric)','EXECUTE'),
  'K7 internal slug helpers must not be exposed to anon'
);

set local role anon;

select count(*) as family_count
from public.k7_public_tube_family_hubs()
\gset

select count(*) as hub_count
from public.k7_public_tube_size_hubs(null)
\gset

select count(*) as round_hubs
from public.k7_public_tube_size_hubs('tondo')
\gset

select count(*) as square_hubs
from public.k7_public_tube_size_hubs('quadro')
\gset

select count(*) as rectangular_hubs
from public.k7_public_tube_size_hubs('rettangolare')
\gset

select count(*) as thin_hubs
from public.k7_public_tube_size_hubs(null)
where variant_count<2
\gset

select count(*) as singleton_rect_hub
from public.k7_public_tube_size_hubs('rettangolare')
where size_slug='120x60'
\gset

select to_jsonb(x) as round_406_hub
from public.k7_public_tube_size_hub('tondo','406-4') x
\gset

reset role;

select pg_temp.k7_assert(
  :'family_count'::integer=3,
  'K7 must expose exactly three public family hubs'
);

select pg_temp.k7_assert(
  :'hub_count'::integer=34
  and :'round_hubs'::integer=21
  and :'square_hubs'::integer=7
  and :'rectangular_hubs'::integer=6,
  'K7 must expose the expected 34 non-thin size hubs'
);

select pg_temp.k7_assert(
  :'thin_hubs'::integer=0
  and :'singleton_rect_hub'::integer=0,
  'single-variant outer sizes must not become indexable cluster pages'
);

select pg_temp.k7_assert(
  (:'round_406_hub'::jsonb->>'variant_count')::integer=3
  and jsonb_array_length(:'round_406_hub'::jsonb->'variants')=3,
  '406.4 mm round hub must aggregate all three canonical thickness variants'
);

select pg_temp.k7_assert(
  exists (
    select 1
    from jsonb_array_elements(:'round_406_hub'::jsonb->'variants') v
    where (v->>'thickness_mm')::numeric=6.3
      and (v->>'weight_kg_m')::numeric=62.2
      and nullif(btrim(v->>'source_url'),'') is not null
  ),
  '406.4 x 6.3 must remain linked to its exact published 62.2 kg/m reference'
);

select pg_temp.k7_assert(
  not (:'round_406_hub'::jsonb ? 'knowledge_source_id')
  and not (:'round_406_hub'::jsonb ? 'source_locator')
  and not (:'round_406_hub'::jsonb ? 'metadata'),
  'public K7 hub detail must not leak internal provenance payloads'
);

rollback;
