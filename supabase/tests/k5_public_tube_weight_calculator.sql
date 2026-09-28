-- K5 — Public Tube Weight Calculator & Dimensions Foundation acceptance.
begin;

create or replace function pg_temp.k5_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'K5 assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.k5_assert(
  not has_table_privilege('anon','public.steel_geometries','SELECT')
  and not has_table_privilege('anon','public.steel_weight_references','SELECT')
  and not has_table_privilege('anon','public.knowledge_sources','SELECT'),
  'K5 must keep geometry, weight and provenance backing tables private'
);

set local role anon;

select count(*) as all_count
from public.k5_public_tube_weight_references(null,500,0)
\gset

select count(*) as round_count
from public.k5_public_tube_weight_references('round_tube',500,0)
\gset

select count(*) as square_count
from public.k5_public_tube_weight_references('square_tube',500,0)
\gset

select count(*) as rectangular_count
from public.k5_public_tube_weight_references('rectangular_tube',500,0)
\gset

select to_jsonb(x) as sample_round
from public.k5_public_tube_weight_references('round_tube',500,0) x
where x.outer_diameter_mm=21.30
  and x.thickness_mm=2.77
limit 1
\gset

reset role;

select pg_temp.k5_assert(
  :'all_count'::integer >= 109,
  'anonymous public dimension catalog must expose the curated canonical reference set'
);

select pg_temp.k5_assert(
  :'round_count'::integer >= 59
  and :'square_count'::integer >= 27
  and :'rectangular_count'::integer >= 23,
  'all three tube families must have public reference coverage'
);

select pg_temp.k5_assert(
  (:'sample_round'::jsonb->>'weight_kg_m')::numeric=1.27
  and :'sample_round'::jsonb->>'weight_method'='published',
  'known round reference must preserve its published kg/m value and method'
);

select pg_temp.k5_assert(
  nullif(btrim(:'sample_round'::jsonb->>'source_provider'),'') is not null
  and nullif(btrim(:'sample_round'::jsonb->>'source_url'),'') is not null,
  'public canonical references must retain a human-readable source and public URL'
);

select pg_temp.k5_assert(
  not (:'sample_round'::jsonb ? 'knowledge_source_id')
  and not (:'sample_round'::jsonb ? 'source_locator')
  and not (:'sample_round'::jsonb ? 'metadata'),
  'public tube references must not leak internal provenance payloads'
);

rollback;
