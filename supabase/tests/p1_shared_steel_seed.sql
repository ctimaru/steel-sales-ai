-- P1.15 / SK3 real seed provenance acceptance. Disposable CI database only.
begin;

create or replace function pg_temp.p115_seed_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then
    raise exception 'P1.15 seed assertion failed: %', message;
  end if;
end;
$$;

select pg_temp.p115_seed_assert(
  (select count(*) = 1
   from public.steel_standards
   where code_key = 'en10224'
     and status = 'active'),
  'one active canonical EN 10224 seed must exist'
);

select pg_temp.p115_seed_assert(
  (select count(*) = 1
   from public.knowledge_sources
   where source_key = 'official:uni:en-10224:2006'
     and access_scope = 'global'
     and source_class = 'official'),
  'official UNI metadata provenance source must exist'
);

select pg_temp.p115_seed_assert(
  (select count(*) = 1
   from public.knowledge_sources
   where source_key = 'primary:metalcondotte:uni-en-10224-product-range'
     and access_scope = 'global'
     and source_class = 'primary'),
  'manufacturer product-range provenance source must exist separately'
);

select pg_temp.p115_seed_assert(
  (select count(*) = 3
   from public.steel_dimensional_rows r
   join public.steel_standards s on s.id = r.standard_id
   where s.code_key = 'en10224'),
  'controlled EN 10224 development subset must contain exactly three rows'
);

select pg_temp.p115_seed_assert(
  (select count(*) = 3
   from public.steel_dimensional_rows r
   join public.steel_standards s on s.id = r.standard_id
   join public.knowledge_sources ks on ks.id = r.knowledge_source_id
   where s.code_key = 'en10224'
     and ks.source_key = 'primary:metalcondotte:uni-en-10224-product-range'
     and r.metadata ->> 'dataset_scope' = 'manufacturer_product_range'
     and (r.metadata ->> 'not_normative_complete')::boolean is true),
  'all development dimensions must remain explicitly manufacturer-range and non-normative-complete'
);

select pg_temp.p115_seed_assert(
  exists (
    select 1
    from public.steel_dimensional_rows r
    join public.steel_standards s on s.id = r.standard_id
    where s.code_key = 'en10224'
      and r.outer_diameter_mm = 323.9
      and r.thickness_mm = 5.9
      and r.theoretical_weight_kg_m = 46.3
      and r.weight_method = 'published'
  ),
  '323.9 x 5.9 manufacturer row must retain published 46.3 kg/m'
);

select pg_temp.p115_seed_assert(
  exists (
    select 1
    from public.steel_dimensional_rows r
    join public.steel_standards s on s.id = r.standard_id
    where s.code_key = 'en10224'
      and r.outer_diameter_mm = 406.4
      and r.thickness_mm = 6.3
      and r.theoretical_weight_kg_m = 62.2
      and r.weight_method = 'published'
  ),
  '406.4 x 6.3 manufacturer row must retain published 62.2 kg/m'
);

set local role authenticated;
select pg_temp.p115_seed_assert(
  (select count(*) = 1 from public.steel_standards where code_key = 'en10224'),
  'authenticated users must be able to read the real shared EN 10224 seed'
);
select pg_temp.p115_seed_assert(
  (select count(*) = 3
   from public.steel_dimensional_rows r
   join public.steel_standards s on s.id = r.standard_id
   where s.code_key = 'en10224'),
  'authenticated users must read the same shared manufacturer-range subset'
);

reset role;
rollback;
