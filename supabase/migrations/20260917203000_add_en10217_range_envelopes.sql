-- P1.15 / SK4.3b — EN 10217 supplier range envelopes + grade completion.
--
-- Adds a safe representation for supplier/manufacturer dimensional ranges when a
-- source states min/max OD and wall thickness but does not prove that every
-- intermediate OD×t combination exists. This avoids fabricating discrete rows.

create table public.steel_product_range_envelopes (
  id uuid primary key default gen_random_uuid(),
  standard_series_id uuid references public.steel_standard_series(id) on delete cascade,
  standard_id uuid references public.steel_standards(id) on delete cascade,
  material_grade_id uuid references public.steel_material_grades(id) on delete set null,
  product_family text not null
    check (product_family in ('round_tube', 'square_tube', 'rectangular_tube')),
  manufacturing_process text,
  range_type text not null
    check (range_type in ('manufacturer_range', 'supplier_range', 'official_reference', 'verified_internal')),
  outer_diameter_min_mm numeric,
  outer_diameter_max_mm numeric,
  width_min_mm numeric,
  width_max_mm numeric,
  height_min_mm numeric,
  height_max_mm numeric,
  thickness_min_mm numeric not null check (thickness_min_mm > 0),
  thickness_max_mm numeric not null check (thickness_max_mm >= thickness_min_mm),
  combination_complete boolean not null default false,
  knowledge_source_id uuid not null references public.knowledge_sources(id) on delete restrict,
  source_document_id uuid,
  source_locator jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (source_document_id, knowledge_source_id)
    references public.knowledge_documents(id, source_id)
    on delete restrict,
  check (standard_series_id is not null or standard_id is not null),
  check (source_document_id is null or knowledge_source_id is not null),
  check (
    (product_family = 'round_tube'
      and outer_diameter_min_mm is not null and outer_diameter_min_mm > 0
      and outer_diameter_max_mm is not null and outer_diameter_max_mm >= outer_diameter_min_mm
      and width_min_mm is null and width_max_mm is null
      and height_min_mm is null and height_max_mm is null)
    or
    (product_family in ('square_tube','rectangular_tube')
      and outer_diameter_min_mm is null and outer_diameter_max_mm is null
      and width_min_mm is not null and width_min_mm > 0
      and width_max_mm is not null and width_max_mm >= width_min_mm
      and height_min_mm is not null and height_min_mm > 0
      and height_max_mm is not null and height_max_mm >= height_min_mm)
  )
);

create unique index steel_product_range_envelopes_identity_uq
  on public.steel_product_range_envelopes (
    coalesce(standard_series_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(standard_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(material_grade_id, '00000000-0000-0000-0000-000000000000'::uuid),
    product_family,
    coalesce(public.canonical_steel_token(manufacturing_process), ''),
    range_type,
    outer_diameter_min_mm,
    outer_diameter_max_mm,
    coalesce(width_min_mm, 0),
    coalesce(width_max_mm, 0),
    coalesce(height_min_mm, 0),
    coalesce(height_max_mm, 0),
    thickness_min_mm,
    thickness_max_mm,
    knowledge_source_id
  );

create index steel_product_range_envelopes_lookup_idx
  on public.steel_product_range_envelopes (
    standard_series_id, standard_id, product_family,
    outer_diameter_min_mm, outer_diameter_max_mm,
    thickness_min_mm, thickness_max_mm
  );

comment on table public.steel_product_range_envelopes is
  'P1.15 SK4.3 source-backed dimensional envelopes. An envelope never implies every OD×wall combination exists unless combination_complete=true.';

alter table public.steel_product_range_envelopes enable row level security;
revoke all on table public.steel_product_range_envelopes from public, anon, authenticated;
grant select on table public.steel_product_range_envelopes to authenticated;
grant select, insert, update, delete on table public.steel_product_range_envelopes to service_role;
create policy steel_product_range_envelopes_authenticated_read
  on public.steel_product_range_envelopes for select to authenticated using (true);

insert into public.knowledge_sources (
  id, owner_id, access_scope, source_key, source_type, source_class,
  name, provider, source_uri, country_code, language_code,
  license_name, trust_score, metadata, organization_id
) values
  (
    '10217000-0000-4000-8000-000000000003'::uuid, null, 'global',
    'official:uni:en-10217-3:2019', 'standards_registry', 'official',
    'UNI EN 10217-3:2019 — official metadata', 'UNI',
    'https://store.uni.com/uni-en-10217-3-2019',
    'IT', 'it', null, 1.00,
    jsonb_build_object(
      'reference_purpose','standard_metadata_status_scope_only',
      'standard_status','current',
      'effective_date','2019-06-13',
      'en_edition','EN 10217-3:2019',
      'reuse_basis','public_metadata_reference_only',
      'verified_on','2026-09-17'
    ), null
  ),
  (
    '10217000-0000-4000-8000-000000000020'::uuid, null, 'global',
    'primary:arcelormittal:en10217-product-range', 'manufacturer_catalog', 'primary',
    'ArcelorMittal Tubular Products Europe — EN 10217 product range', 'ArcelorMittal',
    'https://constructalia.arcelormittal.com/files/EN%20Welded%20steel%20tubes%20for%20pressure%20purposes--7f7156c483b35d1754278e30839d8133.pdf',
    null, 'en', null, 0.95,
    jsonb_build_object(
      'reference_purpose','manufacturer_dimension_range',
      'dataset_scope','manufacturer_product_range',
      'not_normative_complete',true,
      'contains_dimension_matrix',true,
      'verified_on','2026-09-17'
    ), null
  ),
  (
    '10217000-0000-4000-8000-000000000021'::uuid, null, 'global',
    'primary:arcelormittal:industrial-europe-en10217-ranges', 'manufacturer_catalog', 'primary',
    'ArcelorMittal Tubular Products Europe — Industrial Europe product ranges', 'ArcelorMittal',
    'https://constructalia.arcelormittal.com/files/2018_AMTP_Industrial%20business%20unit--f60f43f530ca5cadb7b4e3b2abda0059.pdf',
    null, 'en', null, 0.95,
    jsonb_build_object(
      'reference_purpose','manufacturer_standard_grade_range',
      'dataset_scope','manufacturer_product_range',
      'not_normative_complete',true,
      'verified_on','2026-09-17'
    ), null
  ),
  (
    '10217000-0000-4000-8000-000000000022'::uuid, null, 'global',
    'primary:mannesmann:en10217-materials', 'manufacturer_product_page', 'primary',
    'Mannesmann — EN 10217 material references', 'Mannesmann',
    'https://www.mannesmann.com/en/knowledge/standards-materials/hfi-welded-steel-pipes/en-10217-1.html',
    'DE', 'en', null, 0.95,
    jsonb_build_object(
      'reference_purpose','manufacturer_grade_material_number_reference',
      'dataset_scope','manufacturer_product_range',
      'not_normative_complete',true,
      'verified_on','2026-09-17'
    ), null
  )
on conflict do nothing;

insert into public.steel_standards (
  id, code, title, short_explanation, scope_summary, issuing_body, edition, valid_from,
  status, knowledge_source_id, source_locator, metadata, standard_series_id,
  standard_system, part_number, application_category, manufacturing_processes,
  dimensional_basis
) values (
  '10217000-0000-4000-8000-000000000130'::uuid,
  'EN 10217-3',
  'Welded steel tubes for pressure purposes — Part 3',
  'Electric-welded and submerged-arc-welded alloy fine-grain steel tubes for pressure service.',
  'Technical delivery conditions for circular welded alloy fine-grain steel tubes with specified room-, elevated- and low-temperature properties.',
  'CEN; national adoption metadata via UNI',
  'EN 10217-3:2019 / UNI EN 10217-3:2019',
  '2019-06-13',
  'active',
  '10217000-0000-4000-8000-000000000003'::uuid,
  jsonb_build_object('page','UNI EN 10217-3:2019 current metadata'),
  jsonb_build_object('copyright_rule','metadata_and_original_summary_only'),
  '10217000-0000-4000-8000-000000000100'::uuid,
  'EN','3','pressure_tubes',array['electric_welded','submerged_arc_welded']::text[],'metric_od_t'
)
on conflict do nothing;

insert into public.steel_standard_product_families (standard_id, product_family, notes, metadata)
select id, 'round_tube', 'Welded pressure-tube family; manufacturer ranges are not normative-complete.', jsonb_build_object('reference_database_v2',true)
from public.steel_standards
where code_key=public.canonical_steel_token('EN 10217-3') and status='active'
on conflict do nothing;

insert into public.steel_material_grades (
  standard_system, designation, material_number, material_family, density_kg_m3,
  short_description, knowledge_source_id, source_locator, metadata
) values
  ('EN','P195TR2','1.0108','pressure_carbon_steel',7850,'TR2 non-alloy pressure-tube grade for room-temperature service.','10217000-0000-4000-8000-000000000022'::uuid,jsonb_build_object('reference','EN 10217-1 manufacturer material page'),jsonb_build_object('grade_reference','primary_manufacturer')),
  ('EN','P235TR2','1.0255','pressure_carbon_steel',7850,'TR2 non-alloy pressure-tube grade for room-temperature service.','10217000-0000-4000-8000-000000000022'::uuid,jsonb_build_object('reference','EN 10217-1 manufacturer material page'),jsonb_build_object('grade_reference','primary_manufacturer')),
  ('EN','P265TR2','1.0259','pressure_carbon_steel',7850,'TR2 non-alloy pressure-tube grade for room-temperature service.','10217000-0000-4000-8000-000000000022'::uuid,jsonb_build_object('reference','EN 10217-1 manufacturer material page'),jsonb_build_object('grade_reference','primary_manufacturer')),
  ('EN','P275NL1','1.0488','fine_grain_pressure_steel',7850,'Fine-grain welded pressure-tube grade for low-temperature service.','10217000-0000-4000-8000-000000000022'::uuid,jsonb_build_object('reference','EN 10217-3 manufacturer material reference'),jsonb_build_object('grade_reference','primary_manufacturer')),
  ('EN','P355NH','1.0565','fine_grain_pressure_steel',7850,'Fine-grain welded pressure-tube grade with elevated-temperature properties.','10217000-0000-4000-8000-000000000022'::uuid,jsonb_build_object('reference','EN 10217-3 manufacturer material reference'),jsonb_build_object('grade_reference','primary_manufacturer')),
  ('EN','P355NL1','1.0566','fine_grain_pressure_steel',7850,'Fine-grain welded pressure-tube grade for low-temperature service.','10217000-0000-4000-8000-000000000022'::uuid,jsonb_build_object('reference','EN 10217-3 manufacturer material reference'),jsonb_build_object('grade_reference','primary_manufacturer'))
on conflict do nothing;

with mapping(standard_code, grade, material_number, process, source_id, meta) as (
  values
    ('EN 10217-1','P195TR2','1.0108','welded','10217000-0000-4000-8000-000000000022'::uuid,jsonb_build_object('quality','TR2')),
    ('EN 10217-1','P235TR2','1.0255','welded','10217000-0000-4000-8000-000000000022'::uuid,jsonb_build_object('quality','TR2')),
    ('EN 10217-1','P265TR2','1.0259','welded','10217000-0000-4000-8000-000000000022'::uuid,jsonb_build_object('quality','TR2')),
    ('EN 10217-2','P195GH','1.0348','electric_welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('test_classes',jsonb_build_array('TC1','TC2'))),
    ('EN 10217-2','P235GH','1.0345','electric_welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('test_classes',jsonb_build_array('TC1','TC2'))),
    ('EN 10217-2','P265GH','1.0425','electric_welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('test_classes',jsonb_build_array('TC1','TC2'))),
    ('EN 10217-3','P275NL1','1.0488','welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('range_source','ArcelorMittal')),
    ('EN 10217-3','P355N','1.0562','welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('range_source','ArcelorMittal')),
    ('EN 10217-3','P355NH','1.0565','welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('range_source','ArcelorMittal')),
    ('EN 10217-3','P355NL1','1.0566','welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('range_source','ArcelorMittal'))
)
insert into public.steel_standard_grades (standard_id, grade, material_number, notes, metadata, material_grade_id)
select s.id,g.designation,g.material_number,
  'Source-backed manufacturer grade applicability; not a normative equivalence statement.',
  m.meta || jsonb_build_object('not_normative_complete',true,'reference_database_v2',true),g.id
from mapping m
join public.steel_standards s on s.code_key=public.canonical_steel_token(m.standard_code) and s.status='active'
join public.steel_material_grades g on g.standard_system_key=public.canonical_steel_token('EN')
  and g.designation_key=public.canonical_steel_token(m.grade)
  and g.material_number_key=public.canonical_steel_token(m.material_number)
on conflict do nothing;

with mapping(standard_code, grade, material_number, process, source_id, meta) as (
  values
    ('EN 10217-1','P195TR2','1.0108','welded','10217000-0000-4000-8000-000000000022'::uuid,jsonb_build_object('quality','TR2')),
    ('EN 10217-1','P235TR2','1.0255','welded','10217000-0000-4000-8000-000000000022'::uuid,jsonb_build_object('quality','TR2')),
    ('EN 10217-1','P265TR2','1.0259','welded','10217000-0000-4000-8000-000000000022'::uuid,jsonb_build_object('quality','TR2')),
    ('EN 10217-2','P195GH','1.0348','electric_welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('test_classes',jsonb_build_array('TC1','TC2'))),
    ('EN 10217-2','P235GH','1.0345','electric_welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('test_classes',jsonb_build_array('TC1','TC2'))),
    ('EN 10217-2','P265GH','1.0425','electric_welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('test_classes',jsonb_build_array('TC1','TC2'))),
    ('EN 10217-3','P275NL1','1.0488','welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('range_source','ArcelorMittal')),
    ('EN 10217-3','P355N','1.0562','welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('range_source','ArcelorMittal')),
    ('EN 10217-3','P355NH','1.0565','welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('range_source','ArcelorMittal')),
    ('EN 10217-3','P355NL1','1.0566','welded','10217000-0000-4000-8000-000000000021'::uuid,jsonb_build_object('range_source','ArcelorMittal'))
)
insert into public.steel_standard_grade_applicability (
  standard_id, material_grade_id, product_family, manufacturing_process,
  applicability_type, notes, knowledge_source_id, source_locator, metadata
)
select s.id,g.id,'round_tube',m.process,'manufacturer_range',
  'Grade/process combination listed in manufacturer product range; not normative-complete.',
  m.source_id,jsonb_build_object('reference','public manufacturer range'),
  m.meta || jsonb_build_object('not_normative_complete',true,'reference_database_v2',true)
from mapping m
join public.steel_standards s on s.code_key=public.canonical_steel_token(m.standard_code) and s.status='active'
join public.steel_material_grades g on g.standard_system_key=public.canonical_steel_token('EN')
  and g.designation_key=public.canonical_steel_token(m.grade)
  and g.material_number_key=public.canonical_steel_token(m.material_number)
on conflict do nothing;

-- Manufacturer range envelopes. combination_complete=false is deliberate: a
-- min/max envelope is not a claim that every OD×wall pair exists.
insert into public.steel_product_range_envelopes (
  standard_series_id, standard_id, product_family, manufacturing_process, range_type,
  outer_diameter_min_mm, outer_diameter_max_mm, thickness_min_mm, thickness_max_mm,
  combination_complete, knowledge_source_id, source_locator, metadata
)
select s.standard_series_id,s.id,'round_tube','welded','manufacturer_range',
  60.3,219.1,2.0,10.0,false,'10217000-0000-4000-8000-000000000021'::uuid,
  jsonb_build_object('catalog_row','EN 10217-1'),
  jsonb_build_object('grades',jsonb_build_array('P235TR1','P235TR2'),'not_normative_complete',true,'envelope_only',true)
from public.steel_standards s where s.code_key=public.canonical_steel_token('EN 10217-1') and s.status='active'
on conflict do nothing;

insert into public.steel_product_range_envelopes (
  standard_series_id, standard_id, product_family, manufacturing_process, range_type,
  outer_diameter_min_mm, outer_diameter_max_mm, thickness_min_mm, thickness_max_mm,
  combination_complete, knowledge_source_id, source_locator, metadata
)
select s.standard_series_id,s.id,'round_tube','electric_welded','manufacturer_range',
  114.3,219.1,3.2,6.3,false,'10217000-0000-4000-8000-000000000021'::uuid,
  jsonb_build_object('catalog_row','EN 10217-2'),
  jsonb_build_object('grades',jsonb_build_array('P195GH','P235GH','P265GH'),'test_classes',jsonb_build_array('TC1','TC2'),'not_normative_complete',true,'envelope_only',true)
from public.steel_standards s where s.code_key=public.canonical_steel_token('EN 10217-2') and s.status='active'
on conflict do nothing;

insert into public.steel_product_range_envelopes (
  standard_series_id, standard_id, product_family, manufacturing_process, range_type,
  outer_diameter_min_mm, outer_diameter_max_mm, thickness_min_mm, thickness_max_mm,
  combination_complete, knowledge_source_id, source_locator, metadata
)
select s.standard_series_id,s.id,'round_tube','welded','manufacturer_range',
  17.2,168.3,1.8,8.0,false,'10217000-0000-4000-8000-000000000021'::uuid,
  jsonb_build_object('catalog_row','EN 10217-1,2,3 combined production range'),
  jsonb_build_object('grades',jsonb_build_array('P275NL1','P355N','P355NH','P355NL1'),'not_normative_complete',true,'envelope_only',true)
from public.steel_standards s where s.code_key=public.canonical_steel_token('EN 10217-3') and s.status='active'
on conflict do nothing;

insert into public.steel_product_range_envelopes (
  standard_series_id, product_family, range_type,
  outer_diameter_min_mm, outer_diameter_max_mm, thickness_min_mm, thickness_max_mm,
  combination_complete, knowledge_source_id, source_locator, metadata
)
select ss.id,'round_tube','manufacturer_range',17.2,219.1,1.8,8.0,false,
  '10217000-0000-4000-8000-000000000020'::uuid,
  jsonb_build_object('page',1,'matrix','OD × wall thickness'),
  jsonb_build_object('matrix_available',true,'not_all_cells_implied',true,'not_normative_complete',true,'envelope_only',true)
from public.steel_standard_series ss where ss.code_key=public.canonical_steel_token('EN 10217')
on conflict do nothing;
