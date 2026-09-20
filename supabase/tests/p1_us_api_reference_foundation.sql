-- P1.15 / SK4.4a — US/API reference foundation acceptance.
-- Disposable CI database only.

begin;

create or replace function pg_temp.sk44a_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'SK4.4a assertion failed: %',message;
  end if;
end;
$$;

select pg_temp.sk44a_assert(
  exists(
    select 1 from public.steel_standards
    where code_key=public.canonical_steel_token('API Spec 5L')
      and edition='47th Edition (2026)'
      and status='active'
      and standard_system_key is null
  ) is not false,
  'API Spec 5L 47th edition standard must exist'
);

select pg_temp.sk44a_assert(
  (select count(*)=4
   from public.steel_standards
   where code_key in (
     public.canonical_steel_token('API Spec 5L'),
     public.canonical_steel_token('ASTM A53/A53M'),
     public.canonical_steel_token('ASTM A106/A106M'),
     public.canonical_steel_token('ASME B36.10')
   )
   and status='active'),
  'four controlled US/API standards must exist'
);

select pg_temp.sk44a_assert(
  exists(
    select 1 from public.steel_dimensional_systems
    where code_key=public.canonical_steel_token('nps-dn-schedule')
      and unit_system='mixed'
      and issuing_body='ASME'
      and standard_id='a5440000-0000-4000-8000-000000000104'::uuid
      and coalesce((metadata->>'normative_table_seeded')::boolean,false)=false
  ),
  'NPS/DN/Schedule dimensional-system identity must exist without copied normative table'
);

select pg_temp.sk44a_assert(
  (select count(*)=9
   from public.steel_material_grades
   where standard_system_key=public.canonical_steel_token('API')
     and designation_key in (
       public.canonical_steel_token('B'),
       public.canonical_steel_token('X42'),
       public.canonical_steel_token('X46'),
       public.canonical_steel_token('X52'),
       public.canonical_steel_token('X56'),
       public.canonical_steel_token('X60'),
       public.canonical_steel_token('X65'),
       public.canonical_steel_token('X70'),
       public.canonical_steel_token('X80')
     )),
  'nine source-backed API grade identities must exist'
);

select pg_temp.sk44a_assert(
  (select count(*)=4
   from public.steel_material_grades
   where standard_system_key=public.canonical_steel_token('ASTM')
     and designation_key in (
       public.canonical_steel_token('A53 Gr B'),
       public.canonical_steel_token('A106 Gr A'),
       public.canonical_steel_token('A106 Gr B'),
       public.canonical_steel_token('A106 Gr C')
     )),
  'controlled ASTM grade identities must exist'
);

select pg_temp.sk44a_assert(
  (select count(*)=9
   from public.steel_standard_grade_applicability a
   where a.standard_id='a5440000-0000-4000-8000-000000000101'::uuid
     and a.applicability_type='manufacturer_range'
     and coalesce((a.metadata->>'not_normative_complete')::boolean,false)),
  'API 5L grade applicability must remain manufacturer-range and explicitly incomplete'
);

select pg_temp.sk44a_assert(
  (select count(*)=4
   from public.steel_standard_grade_applicability a
   where a.standard_id in (
     'a5440000-0000-4000-8000-000000000102'::uuid,
     'a5440000-0000-4000-8000-000000000103'::uuid
   )
     and a.applicability_type='manufacturer_range'),
  'ASTM manufacturer-backed applicability rows must exist'
);

select pg_temp.sk44a_assert(
  exists(
    select 1
    from public.steel_grade_cross_references x
    join public.steel_material_grades f on f.id=x.from_material_grade_id
    join public.steel_material_grades t on t.id=x.to_material_grade_id
    where f.designation_key=public.canonical_steel_token('A53 Gr B')
      and t.designation_key=public.canonical_steel_token('A106 Gr B')
      and x.relation_type='commercially_comparable'
      and x.evidence_class='manufacturer_reference'
      and coalesce((x.metadata->>'normative_substitution_allowed')::boolean,true)=false
  ),
  'manufacturer multi-stencil context must be weak commercial comparability only'
);

select pg_temp.sk44a_assert(
  not exists(
    select 1
    from public.steel_grade_cross_references x
    join public.steel_material_grades f on f.id=x.from_material_grade_id
    join public.steel_material_grades t on t.id=x.to_material_grade_id
    where f.standard_system_key in (
      public.canonical_steel_token('API'),
      public.canonical_steel_token('ASTM')
    )
      and t.standard_system_key in (
        public.canonical_steel_token('API'),
        public.canonical_steel_token('ASTM')
      )
      and x.relation_type='normative_equivalent'
  ),
  'SK4.4a must not invent API/ASTM normative equivalence'
);

select pg_temp.sk44a_assert(
  has_table_privilege('authenticated','public.steel_standards','SELECT')
  and has_table_privilege('authenticated','public.steel_material_grades','SELECT')
  and not has_table_privilege('authenticated','public.steel_standards','INSERT,UPDATE,DELETE'),
  'US/API foundation must inherit shared read-only browser contract'
);

rollback;
