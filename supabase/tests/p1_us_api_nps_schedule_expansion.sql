-- P1.15 / SK4.4c — expanded U. S. Steel NPS / Schedule sample acceptance.

begin;

create or replace function pg_temp.sk44c_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SK4.4c assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.sk44c_assert(
  (select count(*)=9
   from public.steel_standard_dimension_applicability
   where standard_id='a5440000-0000-4000-8000-000000000101'::uuid
     and dimensional_system_id='a5440000-0000-4000-8000-000000000201'::uuid
     and applicability_type='manufacturer_range'
     and not is_normative_complete
     and metadata->>'microblock'='SK4.4c'),
  'nine expanded API 5L manufacturer dimension rows must exist'
);

select pg_temp.sk44c_assert(
  (select count(*)=9
   from public.steel_dimension_designations
   where dimensional_system_id='a5440000-0000-4000-8000-000000000201'::uuid
     and nps in (8,10,12)
     and dn=case nps
       when 8 then 200
       when 10 then 250
       when 12 then 300
     end
     and metadata->>'dn_mapping_source_key'='primary:victaulic:17.09-nps-dn-map-2026'
     and coalesce((metadata->>'dn_mapping_not_normative_equivalence')::boolean,false)
     and metadata->>'microblock'='SK4.4c'
     and coalesce((metadata->>'manufacturer_designation_only')::boolean,false)
     and coalesce((metadata->>'not_asme_normative_mapping')::boolean,false)),
  'NPS 8/10/12 designations must preserve manufacturer facts and source-backed DN mapping'
);

select pg_temp.sk44c_assert(
  exists(
    select 1
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.outer_diameter_mm=219.10
      and g.thickness_mm=10.31
      and w.weight_kg_m=53.08
      and (w.metadata->>'source_weight_lb_ft')::numeric=35.67
      and not w.is_canonical
      and w.metadata->>'microblock'='SK4.4c'
  )
  and exists(
    select 1
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.outer_diameter_mm=219.10
      and g.thickness_mm=12.70
      and w.weight_kg_m=64.63
      and (w.metadata->>'source_weight_lb_ft')::numeric=43.43
      and not w.is_canonical
      and w.metadata->>'microblock'='SK4.4c'
  )
  and exists(
    select 1
    from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.outer_diameter_mm=219.10
      and g.thickness_mm=15.09
      and w.weight_kg_m=75.90
      and (w.metadata->>'source_weight_lb_ft')::numeric=51.00
      and not w.is_canonical
      and w.metadata->>'microblock'='SK4.4c'
  ),
  'NPS 8 source rows must match controlled manufacturer facts'
);

select pg_temp.sk44c_assert(
  exists(
    select 1 from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.outer_diameter_mm=273.10 and g.thickness_mm=6.35
      and w.weight_kg_m=41.76
      and (w.metadata->>'source_weight_lb_ft')::numeric=28.06
      and w.metadata->>'microblock'='SK4.4c'
  )
  and exists(
    select 1 from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.outer_diameter_mm=273.10 and g.thickness_mm=9.27
      and w.weight_kg_m=60.30
      and (w.metadata->>'source_weight_lb_ft')::numeric=40.52
      and w.metadata->>'microblock'='SK4.4c'
  )
  and exists(
    select 1 from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.outer_diameter_mm=273.10 and g.thickness_mm=25.40
      and w.weight_kg_m=155.11
      and (w.metadata->>'source_weight_lb_ft')::numeric=104.23
      and w.metadata->>'microblock'='SK4.4c'
  ),
  'NPS 10 source rows must match controlled manufacturer facts'
);

select pg_temp.sk44c_assert(
  exists(
    select 1 from public.steel_dimension_designations dd
    join public.steel_geometries g on g.id=dd.geometry_id
    where dd.nps=12 and dd.schedule is null
      and dd.metadata->>'class_label'='STD'
      and g.outer_diameter_mm=323.90 and g.thickness_mm=9.53
      and dd.metadata->>'microblock'='SK4.4c'
  )
  and exists(
    select 1 from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.outer_diameter_mm=323.90 and g.thickness_mm=14.27
      and w.weight_kg_m=108.96
      and w.metadata->>'microblock'='SK4.4c'
  )
  and exists(
    select 1 from public.steel_weight_references w
    join public.steel_geometries g on g.id=w.geometry_id
    where g.outer_diameter_mm=323.90 and g.thickness_mm=21.44
      and w.weight_kg_m=159.86
      and w.metadata->>'microblock'='SK4.4c'
  ),
  'NPS 12 STD / Sch 60 / Sch 100 source rows must exist'
);

select pg_temp.sk44c_assert(
  (select count(*)=9
   from public.steel_weight_references
   where knowledge_source_id='a5440000-0000-4000-8000-000000000005'::uuid
     and metadata->>'microblock'='SK4.4c'
     and weight_method='published'
     and not is_canonical),
  'all expanded weights must remain published and noncanonical'
);

select pg_temp.sk44c_assert(
  not exists(
    select 1
    from public.steel_standard_dimension_applicability
    where standard_id='a5440000-0000-4000-8000-000000000104'::uuid
      and metadata->>'microblock'='SK4.4c'
  ),
  'expanded manufacturer rows must not masquerade as ASME normative applicability'
);

rollback;
