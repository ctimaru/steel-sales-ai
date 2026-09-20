-- P1.15 / SK4.4d — ASME SA-family + DN designation acceptance.

begin;

create or replace function pg_temp.sk44d_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SK4.4d assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.sk44d_assert(
  (select count(*)=2
   from public.steel_standards
   where id in (
     'a5440000-0000-4000-8000-000000000105'::uuid,
     'a5440000-0000-4000-8000-000000000106'::uuid
   )
     and standard_system='ASME'
     and status='active'
     and coalesce((metadata->>'not_normative_complete')::boolean,false)),
  'SA-106 and SA-53 catalog identities must exist as source-scoped ASME standards'
);

select pg_temp.sk44d_assert(
  (select count(*)=3
   from public.steel_material_grades
   where id in (
     'a5440000-0000-4000-8000-000000000321'::uuid,
     'a5440000-0000-4000-8000-000000000322'::uuid,
     'a5440000-0000-4000-8000-000000000323'::uuid
   )
     and standard_system_key=public.canonical_steel_token('ASME')
     and coalesce((metadata->>'manufacturer_certified_scope')::boolean,false)),
  'SA-106 Gr B/C and SA-53 Gr B identities must be manufacturer-certified scope'
);

select pg_temp.sk44d_assert(
  (select count(*)=3
   from public.steel_standard_grade_applicability
   where standard_id in (
     'a5440000-0000-4000-8000-000000000105'::uuid,
     'a5440000-0000-4000-8000-000000000106'::uuid
   )
     and applicability_type='manufacturer_range'
     and manufacturing_process='seamless'
     and coalesce((metadata->>'not_normative_complete')::boolean,false)),
  'SA family grade applicability must remain manufacturer range only'
);

select pg_temp.sk44d_assert(
  (select count(*)=3
   from public.steel_grade_cross_references x
   where x.knowledge_source_id='a5440000-0000-4000-8000-000000000007'::uuid
     and x.relation_type='supplier_cross_reference'
     and x.evidence_class='manufacturer_reference'
     and coalesce((x.metadata->>'normative_substitution_allowed')::boolean,true)=false
     and x.metadata->>'microblock'='SK4.4d'),
  'three ASTM/ASME manufacturer cross-references must exist without substitution'
);

select pg_temp.sk44d_assert(
  not exists(
    select 1
    from public.steel_grade_cross_references x
    join public.steel_material_grades f on f.id=x.from_material_grade_id
    join public.steel_material_grades t on t.id=x.to_material_grade_id
    where (
      f.standard_system_key in (
        public.canonical_steel_token('ASTM'),
        public.canonical_steel_token('ASME')
      )
      or t.standard_system_key in (
        public.canonical_steel_token('ASTM'),
        public.canonical_steel_token('ASME')
      )
    )
      and x.knowledge_source_id='a5440000-0000-4000-8000-000000000007'::uuid
      and x.relation_type='normative_equivalent'
  ),
  'SK4.4d must not create normative ASTM/ASME equivalence'
);

select pg_temp.sk44d_assert(
  (select count(*)=13
   from public.steel_dimension_designations dd
   where dd.dimensional_system_id='a5440000-0000-4000-8000-000000000201'::uuid
     and dd.metadata->>'microblock' in ('SK4.4b','SK4.4c')
     and dd.nps in (6,8,10,12)
     and dd.dn=case dd.nps
       when 6 then 150
       when 8 then 200
       when 10 then 250
       when 12 then 300
     end
     and dd.metadata->>'dn_mapping_source_key'='primary:victaulic:17.09-nps-dn-map-2026'
     and coalesce((dd.metadata->>'dn_mapping_not_normative_equivalence')::boolean,false)),
  'all 13 NPS sample designations must receive the explicit Victaulic DN map'
);

select pg_temp.sk44d_assert(
  exists(
    select 1
    from public.steel_dimensional_systems
    where id='a5440000-0000-4000-8000-000000000201'::uuid
      and metadata->>'dn_mapping_source_key'='primary:victaulic:17.09-nps-dn-map-2026'
      and (metadata #>> '{dn_mapping_values,6}')='150'
      and (metadata #>> '{dn_mapping_values,8}')='200'
      and (metadata #>> '{dn_mapping_values,10}')='250'
      and (metadata #>> '{dn_mapping_values,12}')='300'
  ),
  'NPS/DN system metadata must preserve source-backed mapping'
);

select pg_temp.sk44d_assert(
  (select count(*)=13
   from public.steel_weight_references
   where knowledge_source_id='a5440000-0000-4000-8000-000000000005'::uuid
     and metadata->>'microblock' in ('SK4.4b','SK4.4c')
     and weight_method='published'
     and not is_canonical),
  'DN/SA enrichment must not promote any U. S. Steel weight reference'
);

rollback;
