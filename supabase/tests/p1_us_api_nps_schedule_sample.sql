-- P1.15 / SK4.4b — U. S. Steel NPS / Schedule sample acceptance.

begin;

create or replace function pg_temp.sk44b_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SK4.4b assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.sk44b_assert(
  (select count(*)=4
   from public.steel_standard_dimension_applicability
   where standard_id='a5440000-0000-4000-8000-000000000101'::uuid
     and dimensional_system_id='a5440000-0000-4000-8000-000000000201'::uuid
     and applicability_type='manufacturer_range'
     and not is_normative_complete
     and metadata->>'microblock'='SK4.4b'),
  'four controlled API 5L manufacturer dimension rows must exist'
);

select pg_temp.sk44b_assert(
  (select count(*)=4
   from public.steel_dimension_designations dd
   where dd.dimensional_system_id='a5440000-0000-4000-8000-000000000201'::uuid
     and dd.nps=6
     and dd.schedule_key in (
       public.canonical_steel_token('40'),
       public.canonical_steel_token('80'),
       public.canonical_steel_token('120'),
       public.canonical_steel_token('160')
     )
     and dd.dn is null
     and coalesce((dd.metadata->>'manufacturer_designation_only')::boolean,false)
     and coalesce((dd.metadata->>'not_asme_normative_mapping')::boolean,false)),
  'NPS 6 schedule designations must remain source-scoped manufacturer facts'
);

select pg_temp.sk44b_assert(
  exists(
    select 1
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.outer_diameter_mm=168.30
      and g.thickness_mm=7.11
      and w.material_grade_id is null
      and w.weight_method='published'
      and w.weight_kg_m=28.26
      and not w.is_canonical
      and w.knowledge_source_id='a5440000-0000-4000-8000-000000000005'::uuid
      and (w.metadata->>'source_weight_lb_ft')::numeric=18.99
      and coalesce((w.metadata->>'unit_conversion_only')::boolean,false)
  ),
  'NPS 6 Sch 40 source row must preserve 18.99 lb/ft and normalized 28.26 kg/m'
);

select pg_temp.sk44b_assert(
  exists(
    select 1
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.outer_diameter_mm=168.30
      and g.thickness_mm=10.97
      and w.weight_kg_m=42.56
      and not w.is_canonical
      and w.knowledge_source_id='a5440000-0000-4000-8000-000000000005'::uuid
  ),
  'NPS 6 Sch 80 / XS source row must exist'
);

select pg_temp.sk44b_assert(
  exists(
    select 1
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.outer_diameter_mm=168.30
      and g.thickness_mm=14.27
      and w.weight_kg_m=54.21
      and not w.is_canonical
  )
  and exists(
    select 1
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.outer_diameter_mm=168.30
      and g.thickness_mm=18.26
      and w.weight_kg_m=67.55
      and not w.is_canonical
  ),
  'NPS 6 Sch 120 and Sch 160 source rows must exist'
);

select pg_temp.sk44b_assert(
  not exists(
    select 1
    from public.steel_standard_dimension_applicability
    where standard_id='a5440000-0000-4000-8000-000000000104'::uuid
      and metadata->>'microblock'='SK4.4b'
  ),
  'manufacturer sample must not masquerade as ASME normative dimensional applicability'
);

select pg_temp.sk44b_assert(
  (select count(*)=4
   from public.steel_weight_references w
   where w.knowledge_source_id='a5440000-0000-4000-8000-000000000005'::uuid
     and w.metadata->>'microblock'='SK4.4b'
     and not w.is_canonical),
  'all SK4.4b published weights must remain noncanonical'
);

rollback;
