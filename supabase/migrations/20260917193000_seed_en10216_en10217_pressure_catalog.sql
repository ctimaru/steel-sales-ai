-- P1.15 / SK4.3 — EU pressure/process tube catalog tranche 1.
--
-- Scope:
--   * register EN 10216 and EN 10217 multipart pressure-tube families;
--   * seed current public metadata for core parts;
--   * seed source-backed EN pressure grades/material numbers;
--   * promote a controlled P265GH EN 10216-2 supplier range with OD, wall, NPS
--     supplier designation and published kg/m;
--   * preserve normative metadata, supplier availability and calculated/commercial
--     semantics as distinct concepts.
--
-- IMPORTANT:
--   No paid normative dimensional tables are copied. The detailed P265GH rows below
--   are a public supplier product-range table from Metal Service Zwevegem (MSZ), not
--   a claim that these are the complete normative dimensions of EN 10216-2.

insert into public.knowledge_sources (
  id, owner_id, access_scope, source_key, source_type, source_class,
  name, provider, source_uri, country_code, language_code,
  license_name, trust_score, metadata, organization_id
) values
  (
    '10216000-0000-4000-8000-000000000001'::uuid, null, 'global',
    'official:bsi:en-10216-2:2024', 'standards_registry', 'official',
    'BS EN 10216-2:2024 — official metadata', 'BSI',
    'https://knowledge.bsigroup.com/products/seamless-steel-tubes-for-pressure-purposes-technical-delivery-conditions-non-alloy-and-alloy-steel-tubes-with-specified-elevated-temperature-properties-3',
    'GB', 'en', null, 1.00,
    jsonb_build_object('reference_purpose','standard_metadata_status_scope_only','standard_status','current','en_edition','EN 10216-2:2024','reuse_basis','public_metadata_reference_only','content_policy','no_normative_full_text_or_paid_tables_redistributed','verified_on','2026-09-17'), null
  ),
  (
    '10216000-0000-4000-8000-000000000002'::uuid, null, 'global',
    'official:din:en-10216-1:2013', 'standards_registry', 'official',
    'DIN EN 10216-1:2014-03 — official metadata', 'DIN Media',
    'https://www.dinmedia.de/en/standard/din-en-10216-1/171905669',
    'DE', 'en', null, 1.00,
    jsonb_build_object('reference_purpose','standard_metadata_status_scope_only','standard_status','current','en_edition','EN 10216-1:2013','reuse_basis','public_metadata_reference_only','verified_on','2026-09-17'), null
  ),
  (
    '10216000-0000-4000-8000-000000000003'::uuid, null, 'global',
    'official:bsi:en-10216-3:2013', 'standards_registry', 'official',
    'BS EN 10216-3:2013 — official metadata', 'BSI',
    'https://knowledge.bsigroup.com/products/seamless-steel-tubes-for-pressure-purposes-technical-delivery-conditions-alloy-fine-grain-steel-tubes',
    'GB', 'en', null, 1.00,
    jsonb_build_object('reference_purpose','standard_metadata_status_scope_only','standard_status','current','en_edition','EN 10216-3:2013','reuse_basis','public_metadata_reference_only','verified_on','2026-09-17'), null
  ),
  (
    '10216000-0000-4000-8000-000000000004'::uuid, null, 'global',
    'official:bsi:en-10216-4:2013', 'standards_registry', 'official',
    'BS EN 10216-4:2013 — official metadata', 'BSI',
    'https://landingpage.bsigroup.com/LandingPage/Undated?UPI=000000000030113322',
    'GB', 'en', null, 1.00,
    jsonb_build_object('reference_purpose','standard_metadata_status_scope_only','standard_status','current','en_edition','EN 10216-4:2013','reuse_basis','public_metadata_reference_only','verified_on','2026-09-17'), null
  ),
  (
    '10217000-0000-4000-8000-000000000001'::uuid, null, 'global',
    'official:din:en-10217-1:2019', 'standards_registry', 'official',
    'DIN EN 10217-1:2019-08 — official metadata', 'DIN Media',
    'https://www.dinmedia.de/en/standard/din-en-10217-1/255819965',
    'DE', 'en', null, 1.00,
    jsonb_build_object('reference_purpose','standard_metadata_status_scope_only','standard_status','current','en_edition','EN 10217-1:2019','reuse_basis','public_metadata_reference_only','verified_on','2026-09-17'), null
  ),
  (
    '10217000-0000-4000-8000-000000000002'::uuid, null, 'global',
    'official:uni:en-10217-2:2019', 'standards_registry', 'official',
    'UNI EN 10217-2:2019 — official metadata', 'UNI',
    'https://store.uni.com/en/uni-en-10217-2-2019',
    'IT', 'en', null, 1.00,
    jsonb_build_object('reference_purpose','standard_metadata_status_scope_only','standard_status','current','effective_date','2019-06-13','en_edition','EN 10217-2:2019','reuse_basis','public_metadata_reference_only','verified_on','2026-09-17'), null
  ),
  (
    '10216000-0000-4000-8000-000000000010'::uuid, null, 'global',
    'primary:tenaris:en10216-power-generation-grades', 'manufacturer_product_page', 'primary',
    'Tenaris — EN 10216-2 pressure tube grades', 'Tenaris',
    'https://www.tenaris.com/en/products-and-services/power-generation',
    null, 'en', null, 0.95,
    jsonb_build_object('reference_purpose','manufacturer_grade_applicability','dataset_scope','manufacturer_product_range','not_normative_complete',true,'verified_on','2026-09-17'), null
  ),
  (
    '10216000-0000-4000-8000-000000000011'::uuid, null, 'global',
    'primary:buhlmann:en-pressure-grade-material-numbers', 'supplier_product_page', 'primary',
    'BUHLMANN — EN pressure pipe grades and material numbers', 'BUHLMANN GROUP',
    'https://buhlmann-group.com/en/products/',
    'DE', 'en', null, 0.95,
    jsonb_build_object('reference_purpose','supplier_grade_material_number_reference','dataset_scope','supplier_product_range','not_normative_complete',true,'verified_on','2026-09-17'), null
  ),
  (
    '10216000-0000-4000-8000-000000000012'::uuid, null, 'global',
    'primary:msz:en10216-pressure-overview', 'supplier_catalog', 'primary',
    'Metal Service Zwevegem — EN 10216 pressure tube overview', 'Metal Service Zwevegem',
    'https://www.msz.be/upload/file/10216fr.pdf',
    'BE', 'fr', null, 0.90,
    jsonb_build_object('reference_purpose','supplier_standard_grade_range','dataset_scope','supplier_product_range','not_normative_complete',true,'verified_on','2026-09-17'), null
  ),
  (
    '10216000-0000-4000-8000-000000000013'::uuid, null, 'global',
    'primary:msz:en10216-2-p265gh-dimensions', 'supplier_catalog', 'primary',
    'Metal Service Zwevegem — EN 10216-2 P265GH dimensional range', 'Metal Service Zwevegem',
    'https://www.msz.be/upload/file/P265GH_FR_2.pdf',
    'BE', 'fr', null, 0.90,
    jsonb_build_object('reference_purpose','supplier_dimension_weight_range','dataset_scope','supplier_product_range','grade','P265GH','product_family','round_tube','not_normative_complete',true,'verified_on','2026-09-17'), null
  ),
  (
    '10217000-0000-4000-8000-000000000010'::uuid, null, 'global',
    'primary:msz:en10217-pressure-overview', 'supplier_catalog', 'primary',
    'Metal Service Zwevegem — EN 10217 welded pressure tube overview', 'Metal Service Zwevegem',
    'https://www.msz.be/upload/file/10217fr.pdf',
    'BE', 'fr', null, 0.90,
    jsonb_build_object('reference_purpose','supplier_standard_grade_range','dataset_scope','supplier_product_range','not_normative_complete',true,'verified_on','2026-09-17'), null
  )
on conflict do nothing;

insert into public.steel_standard_series (
  id, standard_system, code, title, issuing_body, application_category,
  short_explanation, knowledge_source_id, source_locator, metadata
) values
  ('10216000-0000-4000-8000-000000000100'::uuid,'EN','EN 10216','Seamless steel tubes for pressure purposes','CEN','pressure_tubes','European multipart family for seamless steel tubes used for pressure purposes.','10216000-0000-4000-8000-000000000001'::uuid,jsonb_build_object('reference','EN 10216 family'),jsonb_build_object('reference_database_v2',true,'not_full_normative_text',true)),
  ('10217000-0000-4000-8000-000000000100'::uuid,'EN','EN 10217','Welded steel tubes for pressure purposes','CEN','pressure_tubes','European multipart family for welded steel tubes used for pressure purposes.','10217000-0000-4000-8000-000000000001'::uuid,jsonb_build_object('reference','EN 10217 family'),jsonb_build_object('reference_database_v2',true,'not_full_normative_text',true))
on conflict do nothing;

insert into public.steel_standards (
  id, code, title, short_explanation, scope_summary, issuing_body, edition, status,
  knowledge_source_id, source_locator, metadata, standard_series_id, standard_system,
  part_number, application_category, manufacturing_processes, dimensional_basis
) values
  ('10216000-0000-4000-8000-000000000110'::uuid,'EN 10216-1','Seamless steel tubes for pressure purposes — Part 1','Non-alloy seamless pressure tubes with specified room-temperature properties.','Technical delivery conditions for seamless non-alloy steel tubes for pressure purposes with specified room-temperature properties.','CEN; national adoption metadata via DIN','EN 10216-1:2013 / DIN EN 10216-1:2014-03','active','10216000-0000-4000-8000-000000000002'::uuid,jsonb_build_object('page','DIN EN 10216-1 current metadata'),jsonb_build_object('copyright_rule','metadata_and_original_summary_only'),'10216000-0000-4000-8000-000000000100'::uuid,'EN','1','pressure_tubes',array['seamless']::text[],'metric_od_t'),
  ('10216000-0000-4000-8000-000000000120'::uuid,'EN 10216-2','Seamless steel tubes for pressure purposes — Part 2','Non-alloy and alloy seamless pressure tubes with specified elevated-temperature properties.','Technical delivery conditions for seamless circular tubes with elevated-temperature properties; public metadata only, not the paid normative tables.','CEN; national adoption metadata via BSI','EN 10216-2:2024 / BS EN 10216-2:2024','active','10216000-0000-4000-8000-000000000001'::uuid,jsonb_build_object('page','BS EN 10216-2:2024 current metadata'),jsonb_build_object('copyright_rule','metadata_and_original_summary_only'),'10216000-0000-4000-8000-000000000100'::uuid,'EN','2','pressure_tubes',array['seamless']::text[],'metric_od_t'),
  ('10216000-0000-4000-8000-000000000130'::uuid,'EN 10216-3','Seamless steel tubes for pressure purposes — Part 3','Seamless pressure tubes made from weldable alloy fine-grain steels.','Technical delivery conditions for seamless circular tubes made of weldable alloyed fine-grain steel.','CEN; national adoption metadata via BSI','EN 10216-3:2013 / BS EN 10216-3:2013','active','10216000-0000-4000-8000-000000000003'::uuid,jsonb_build_object('page','BS EN 10216-3:2013 current metadata'),jsonb_build_object('copyright_rule','metadata_and_original_summary_only'),'10216000-0000-4000-8000-000000000100'::uuid,'EN','3','pressure_tubes',array['seamless']::text[],'metric_od_t'),
  ('10216000-0000-4000-8000-000000000140'::uuid,'EN 10216-4','Seamless steel tubes for pressure purposes — Part 4','Non-alloy and alloy seamless pressure tubes with specified low-temperature properties.','Technical delivery conditions for seamless circular tubes with specified low-temperature properties.','CEN; national adoption metadata via BSI','EN 10216-4:2013 / BS EN 10216-4:2013','active','10216000-0000-4000-8000-000000000004'::uuid,jsonb_build_object('page','BS EN 10216-4:2013 current metadata'),jsonb_build_object('copyright_rule','metadata_and_original_summary_only'),'10216000-0000-4000-8000-000000000100'::uuid,'EN','4','pressure_tubes',array['seamless']::text[],'metric_od_t'),
  ('10217000-0000-4000-8000-000000000110'::uuid,'EN 10217-1','Welded steel tubes for pressure purposes — Part 1','Electric-welded and submerged-arc-welded non-alloy pressure tubes with specified room-temperature properties.','Technical delivery conditions for welded non-alloy steel tubes for pressure purposes with specified room-temperature properties.','CEN; national adoption metadata via DIN','EN 10217-1:2019 / DIN EN 10217-1:2019-08','active','10217000-0000-4000-8000-000000000001'::uuid,jsonb_build_object('page','DIN EN 10217-1 current metadata'),jsonb_build_object('copyright_rule','metadata_and_original_summary_only'),'10217000-0000-4000-8000-000000000100'::uuid,'EN','1','pressure_tubes',array['electric_welded','submerged_arc_welded']::text[],'metric_od_t'),
  ('10217000-0000-4000-8000-000000000120'::uuid,'EN 10217-2','Welded steel tubes for pressure purposes — Part 2','Electric-welded non-alloy and alloy pressure tubes with specified elevated-temperature properties.','Technical delivery conditions for electric-welded circular pressure tubes with elevated-temperature properties.','CEN; national adoption metadata via UNI','EN 10217-2:2019 / UNI EN 10217-2:2019','active','10217000-0000-4000-8000-000000000002'::uuid,jsonb_build_object('page','UNI EN 10217-2:2019 current metadata'),jsonb_build_object('copyright_rule','metadata_and_original_summary_only'),'10217000-0000-4000-8000-000000000100'::uuid,'EN','2','pressure_tubes',array['electric_welded']::text[],'metric_od_t')
on conflict do nothing;

insert into public.steel_standard_product_families (standard_id, product_family, notes, metadata)
select s.id,'round_tube','Pressure-tube family reference; detailed supplier rows are not asserted to be normative-complete.',jsonb_build_object('reference_database_v2',true)
from public.steel_standards s
where s.code_key in (public.canonical_steel_token('EN 10216-1'),public.canonical_steel_token('EN 10216-2'),public.canonical_steel_token('EN 10216-3'),public.canonical_steel_token('EN 10216-4'),public.canonical_steel_token('EN 10217-1'),public.canonical_steel_token('EN 10217-2'))
on conflict do nothing;

insert into public.steel_material_grades (
  standard_system, designation, material_number, material_family, density_kg_m3,
  short_description, knowledge_source_id, source_locator, metadata
) values
  ('EN','P195TR1','1.0107','pressure_carbon_steel',7850,'Non-alloy pressure-tube grade for room-temperature service.','10216000-0000-4000-8000-000000000012'::uuid,jsonb_build_object('reference','MSZ EN 10216 overview'),jsonb_build_object('grade_reference','primary_supplier')),
  ('EN','P235TR1','1.0254','pressure_carbon_steel',7850,'Non-alloy pressure-tube grade for room-temperature service.','10216000-0000-4000-8000-000000000012'::uuid,jsonb_build_object('reference','MSZ EN 10216 overview'),jsonb_build_object('grade_reference','primary_supplier')),
  ('EN','P265TR1','1.0258','pressure_carbon_steel',7850,'Non-alloy pressure-tube grade for room-temperature service.','10216000-0000-4000-8000-000000000012'::uuid,jsonb_build_object('reference','MSZ EN 10216 overview'),jsonb_build_object('grade_reference','primary_supplier')),
  ('EN','P195GH','1.0348','pressure_carbon_steel',7850,'Pressure-tube grade for elevated-temperature service.','10216000-0000-4000-8000-000000000012'::uuid,jsonb_build_object('reference','MSZ EN 10216 overview'),jsonb_build_object('grade_reference','primary_supplier')),
  ('EN','P235GH','1.0345','pressure_carbon_steel',7850,'Pressure-tube grade for elevated-temperature service.','10216000-0000-4000-8000-000000000011'::uuid,jsonb_build_object('reference','BUHLMANN EN product list'),jsonb_build_object('grade_reference','primary_supplier')),
  ('EN','P265GH','1.0425','pressure_carbon_steel',7850,'Pressure-tube grade for elevated-temperature service.','10216000-0000-4000-8000-000000000011'::uuid,jsonb_build_object('reference','BUHLMANN EN product list'),jsonb_build_object('grade_reference','primary_supplier')),
  ('EN','16Mo3','1.5415','pressure_alloy_steel',7850,'Molybdenum-alloy pressure-tube grade for elevated-temperature service.','10216000-0000-4000-8000-000000000011'::uuid,jsonb_build_object('reference','BUHLMANN EN product list'),jsonb_build_object('grade_reference','primary_supplier')),
  ('EN','13CrMo4-5','1.7335','pressure_alloy_steel',7850,'Cr-Mo pressure-tube grade for elevated-temperature service.','10216000-0000-4000-8000-000000000011'::uuid,jsonb_build_object('reference','BUHLMANN EN product list'),jsonb_build_object('grade_reference','primary_supplier')),
  ('EN','10CrMo9-10','1.7380','pressure_alloy_steel',7850,'Cr-Mo pressure-tube grade for elevated-temperature service.','10216000-0000-4000-8000-000000000011'::uuid,jsonb_build_object('reference','BUHLMANN EN product list'),jsonb_build_object('grade_reference','primary_supplier')),
  ('EN','P355N','1.0562','fine_grain_pressure_steel',7850,'Fine-grain pressure-tube grade.','10216000-0000-4000-8000-000000000012'::uuid,jsonb_build_object('reference','MSZ EN 10216 overview'),jsonb_build_object('grade_reference','primary_supplier')),
  ('EN','P215NL','1.0451','low_temperature_pressure_steel',7850,'Pressure-tube grade for low-temperature service.','10216000-0000-4000-8000-000000000011'::uuid,jsonb_build_object('reference','BUHLMANN EN product list'),jsonb_build_object('grade_reference','primary_supplier')),
  ('EN','P255QL','1.0452','low_temperature_pressure_steel',7850,'Pressure-tube grade for low-temperature service.','10216000-0000-4000-8000-000000000011'::uuid,jsonb_build_object('reference','BUHLMANN EN product list'),jsonb_build_object('grade_reference','primary_supplier')),
  ('EN','P265NL','1.0453','low_temperature_pressure_steel',7850,'Pressure-tube grade for low-temperature service.','10216000-0000-4000-8000-000000000011'::uuid,jsonb_build_object('reference','BUHLMANN EN product list'),jsonb_build_object('grade_reference','primary_supplier'))
on conflict do nothing;

with mapping(standard_code,grade,material_number) as (
  values
    ('EN 10216-1','P195TR1','1.0107'),('EN 10216-1','P235TR1','1.0254'),('EN 10216-1','P265TR1','1.0258'),
    ('EN 10216-2','P195GH','1.0348'),('EN 10216-2','P235GH','1.0345'),('EN 10216-2','P265GH','1.0425'),('EN 10216-2','16Mo3','1.5415'),('EN 10216-2','13CrMo4-5','1.7335'),('EN 10216-2','10CrMo9-10','1.7380'),
    ('EN 10216-3','P355N','1.0562'),('EN 10216-4','P215NL','1.0451'),('EN 10216-4','P255QL','1.0452'),('EN 10216-4','P265NL','1.0453'),
    ('EN 10217-1','P195TR1','1.0107'),('EN 10217-1','P235TR1','1.0254'),('EN 10217-1','P265TR1','1.0258'),('EN 10217-2','P235GH','1.0345')
)
insert into public.steel_standard_grades (standard_id,grade,material_number,notes,metadata,material_grade_id)
select s.id,g.designation,g.material_number,'Source-backed supplier/manufacturer grade applicability; not an equivalence claim.',jsonb_build_object('reference_database_v2',true,'not_normative_complete',true),g.id
from mapping m
join public.steel_standards s on s.code_key=public.canonical_steel_token(m.standard_code) and s.status='active'
join public.steel_material_grades g on g.standard_system_key=public.canonical_steel_token('EN') and g.designation_key=public.canonical_steel_token(m.grade) and g.material_number_key=public.canonical_steel_token(m.material_number)
on conflict do nothing;

with mapping(standard_code,grade,material_number,process,source_id) as (
  values
    ('EN 10216-1','P195TR1','1.0107','seamless','10216000-0000-4000-8000-000000000012'::uuid),('EN 10216-1','P235TR1','1.0254','seamless','10216000-0000-4000-8000-000000000012'::uuid),('EN 10216-1','P265TR1','1.0258','seamless','10216000-0000-4000-8000-000000000012'::uuid),
    ('EN 10216-2','P195GH','1.0348','seamless','10216000-0000-4000-8000-000000000012'::uuid),('EN 10216-2','P235GH','1.0345','seamless','10216000-0000-4000-8000-000000000010'::uuid),('EN 10216-2','P265GH','1.0425','seamless','10216000-0000-4000-8000-000000000010'::uuid),('EN 10216-2','16Mo3','1.5415','seamless','10216000-0000-4000-8000-000000000010'::uuid),('EN 10216-2','13CrMo4-5','1.7335','seamless','10216000-0000-4000-8000-000000000010'::uuid),('EN 10216-2','10CrMo9-10','1.7380','seamless','10216000-0000-4000-8000-000000000010'::uuid),
    ('EN 10216-3','P355N','1.0562','seamless','10216000-0000-4000-8000-000000000012'::uuid),('EN 10216-4','P215NL','1.0451','seamless','10216000-0000-4000-8000-000000000011'::uuid),('EN 10216-4','P255QL','1.0452','seamless','10216000-0000-4000-8000-000000000011'::uuid),('EN 10216-4','P265NL','1.0453','seamless','10216000-0000-4000-8000-000000000011'::uuid),
    ('EN 10217-1','P195TR1','1.0107','welded','10217000-0000-4000-8000-000000000010'::uuid),('EN 10217-1','P235TR1','1.0254','welded','10217000-0000-4000-8000-000000000010'::uuid),('EN 10217-1','P265TR1','1.0258','welded','10217000-0000-4000-8000-000000000010'::uuid),('EN 10217-2','P235GH','1.0345','electric_welded','10217000-0000-4000-8000-000000000010'::uuid)
)
insert into public.steel_standard_grade_applicability (standard_id,material_grade_id,product_family,manufacturing_process,applicability_type,notes,knowledge_source_id,source_locator,metadata)
select s.id,g.id,'round_tube',m.process,'supplier_range','Grade/process combination published by a primary manufacturer or specialist tube supplier.',m.source_id,jsonb_build_object('reference','public product/catalog range'),jsonb_build_object('not_normative_complete',true,'reference_database_v2',true)
from mapping m
join public.steel_standards s on s.code_key=public.canonical_steel_token(m.standard_code) and s.status='active'
join public.steel_material_grades g on g.standard_system_key=public.canonical_steel_token('EN') and g.designation_key=public.canonical_steel_token(m.grade) and g.material_number_key=public.canonical_steel_token(m.material_number)
on conflict do nothing;

create temporary table sk43_p265gh_rows (nps_label text not null,nps numeric not null,od_mm numeric not null,schedule text not null,thickness_mm numeric not null,weight_kg_m numeric not null) on commit preserve rows;
insert into sk43_p265gh_rows (nps_label,nps,od_mm,schedule,thickness_mm,weight_kg_m) values
  ('1/2"',0.5,21.30,'STD',2.77,1.27),('1/2"',0.5,21.30,'XS',3.73,1.62),('1/2"',0.5,21.30,'XXS',7.47,2.55),
  ('3/4"',0.75,26.70,'STD',2.87,1.69),('3/4"',0.75,26.70,'XS',3.91,2.20),('3/4"',0.75,26.70,'XXS',7.82,3.64),
  ('1"',1,33.40,'STD',3.38,2.50),('1"',1,33.40,'XS',4.55,3.24),('1"',1,33.40,'XXS',9.09,5.45),
  ('1 1/4"',1.25,42.20,'STD',3.56,3.39),('1 1/4"',1.25,42.20,'XS',4.85,4.47),('1 1/4"',1.25,42.20,'XXS',9.70,7.77),
  ('1 1/2"',1.5,48.30,'STD',3.68,4.05),('1 1/2"',1.5,48.30,'XS',5.08,5.41),('1 1/2"',1.5,48.30,'XXS',10.15,9.56),
  ('2"',2,60.30,'STD',3.91,5.44),('2"',2,60.30,'XS',5.54,7.48),('2"',2,60.30,'XXS',11.07,13.44),
  ('2 1/2"',2.5,73.00,'STD',5.16,8.63),('2 1/2"',2.5,73.00,'XS',7.01,11.41),('2 1/2"',2.5,73.00,'XXS',14.02,20.39),
  ('3"',3,88.90,'STD',5.49,11.29),('3"',3,88.90,'XS',7.62,15.27),('3"',3,88.90,'XXS',15.24,27.68),
  ('3 1/2"',3.5,101.60,'STD',5.74,13.57),('3 1/2"',3.5,101.60,'XS',8.08,18.63),
  ('4"',4,114.30,'STD',6.02,16.07),('4"',4,114.30,'XS',8.56,22.32),('4"',4,114.30,'XXS',17.12,41.03),
  ('5"',5,141.30,'STD',6.55,21.77),('5"',5,141.30,'XS',9.53,30.97),('5"',5,141.30,'XXS',19.05,57.43),
  ('6"',6,168.30,'STD',7.11,28.26),('6"',6,168.30,'XS',10.97,42.56),('6"',6,168.30,'XXS',21.95,79.22),
  ('8"',8,219.10,'STD',8.18,42.55),('8"',8,219.10,'XS',12.70,64.64),('8"',8,219.10,'XXS',22.23,107.90),
  ('10"',10,273.00,'STD',9.27,60.31),('10"',10,273.00,'XS',12.70,81.55),('10"',10,273.00,'XXS',25.40,155.10),
  ('12"',12,323.90,'STD',9.53,73.88),('12"',12,323.90,'XS',12.70,97.46),('12"',12,323.90,'XXS',25.40,186.90),
  ('14"',14,355.60,'STD',9.53,81.33),('14"',14,355.60,'XS',12.70,107.30),
  ('16"',16,406.40,'STD',9.53,93.27),('16"',16,406.40,'XS',12.70,123.30),
  ('18"',18,457.20,'STD',9.53,105.10),('18"',18,457.20,'XS',12.70,139.10),
  ('20"',20,508.00,'STD',9.53,117.10),('20"',20,508.00,'XS',12.70,155.10),
  ('22"',22,558.80,'STD',9.53,129.10),('22"',22,558.80,'XS',12.70,171.00),
  ('24"',24,610.00,'STD',9.53,141.10),('24"',24,610.00,'XS',12.70,187.00);

insert into public.steel_geometries (product_family,outer_diameter_mm,thickness_mm,metadata)
select 'round_tube',r.od_mm,r.thickness_mm,jsonb_build_object('seed','sk4.3-en10216-2-p265gh','source_class','supplier_product_range') from sk43_p265gh_rows r
on conflict (geometry_key) do nothing;

insert into public.steel_dimension_designations (geometry_id,dimensional_system_id,nominal_designation,nps,schedule,metadata)
select g.id,'a1100000-0000-4000-8000-000000000001'::uuid,r.nps_label,r.nps,r.schedule,jsonb_build_object('source','Metal Service Zwevegem P265GH table','supplier_designation_only',true,'not_asme_normative_mapping',true)
from sk43_p265gh_rows r join public.steel_geometries g on g.geometry_key='round|od='||public.canonical_mm_value(r.od_mm)||'|t='||public.canonical_mm_value(r.thickness_mm)
on conflict do nothing;

with std as (select id from public.steel_standards where code_key=public.canonical_steel_token('EN 10216-2') and status='active' limit 1), grade as (select id from public.steel_material_grades where standard_system_key=public.canonical_steel_token('EN') and designation_key=public.canonical_steel_token('P265GH') and material_number_key=public.canonical_steel_token('1.0425') limit 1)
insert into public.steel_standard_dimension_applicability (standard_id,geometry_id,material_grade_id,dimensional_system_id,manufacturing_process,applicability_type,is_normative_complete,knowledge_source_id,source_locator,metadata)
select std.id,g.id,grade.id,'a1100000-0000-4000-8000-000000000001'::uuid,'seamless','supplier_range',false,'10216000-0000-4000-8000-000000000013'::uuid,jsonb_build_object('table','NPS / OD / STD-XS-XXS / thickness / kg per m'),jsonb_build_object('seed','sk4.3-en10216-2-p265gh','grade','P265GH','nps',r.nps,'nps_label',r.nps_label,'supplier_designation',r.schedule,'not_normative_complete',true)
from sk43_p265gh_rows r join public.steel_geometries g on g.geometry_key='round|od='||public.canonical_mm_value(r.od_mm)||'|t='||public.canonical_mm_value(r.thickness_mm) cross join std cross join grade
on conflict do nothing;

with grade as (select id from public.steel_material_grades where standard_system_key=public.canonical_steel_token('EN') and designation_key=public.canonical_steel_token('P265GH') and material_number_key=public.canonical_steel_token('1.0425') limit 1)
insert into public.steel_weight_references (geometry_id,material_grade_id,weight_kg_m,weight_method,density_kg_m3,is_canonical,knowledge_source_id,source_locator,metadata)
select g.id,grade.id,r.weight_kg_m,'published',7850,true,'10216000-0000-4000-8000-000000000013'::uuid,jsonb_build_object('table','NPS / OD / STD-XS-XXS / thickness / kg per m'),jsonb_build_object('dataset_scope','supplier_product_range','not_normative_complete',true,'grade','P265GH','nps',r.nps,'supplier_designation',r.schedule,'seed','sk4.3-en10216-2-p265gh')
from sk43_p265gh_rows r join public.steel_geometries g on g.geometry_key='round|od='||public.canonical_mm_value(r.od_mm)||'|t='||public.canonical_mm_value(r.thickness_mm) cross join grade
on conflict do nothing;

with std as (select id from public.steel_standards where code_key=public.canonical_steel_token('EN 10216-2') and status='active' limit 1)
insert into public.steel_dimensional_rows (standard_id,product_family,outer_diameter_mm,thickness_mm,theoretical_weight_kg_m,weight_method,knowledge_source_id,source_locator,metadata,geometry_id)
select std.id,'round_tube',r.od_mm,r.thickness_mm,r.weight_kg_m,'published','10216000-0000-4000-8000-000000000013'::uuid,jsonb_build_object('table','NPS / OD / STD-XS-XXS / thickness / kg per m'),jsonb_build_object('dataset_scope','supplier_product_range','not_normative_complete',true,'projection_of_reference_v2',true,'grade','P265GH','nps',r.nps,'nps_label',r.nps_label,'supplier_designation',r.schedule),g.id
from sk43_p265gh_rows r join public.steel_geometries g on g.geometry_key='round|od='||public.canonical_mm_value(r.od_mm)||'|t='||public.canonical_mm_value(r.thickness_mm) cross join std
on conflict do nothing;

insert into public.steel_reference_observations (knowledge_source_id,source_locator,observation_type,observed_standard_code,observed_grade,observed_product_family,normalized_standard_id,normalized_material_grade_id,normalized_geometry_id,raw_payload,content_checksum,promotion_status,reviewed_at,metadata)
select '10216000-0000-4000-8000-000000000013'::uuid,jsonb_build_object('table','P265GH dimensional range'),'product_range','EN 10216-2','P265GH','round_tube',s.id,ggrade.id,geom.id,jsonb_build_object('nps',r.nps,'nps_label',r.nps_label,'od_mm',r.od_mm,'schedule',r.schedule,'thickness_mm',r.thickness_mm,'weight_kg_m',r.weight_kg_m),md5(concat_ws('|','EN10216-2','P265GH',r.nps::text,r.od_mm::text,r.schedule,r.thickness_mm::text,r.weight_kg_m::text)),'promoted',now(),jsonb_build_object('seed','sk4.3-en10216-2-p265gh','human_reviewed_seed',true)
from sk43_p265gh_rows r join public.steel_standards s on s.code_key=public.canonical_steel_token('EN 10216-2') and s.status='active' join public.steel_material_grades ggrade on ggrade.standard_system_key=public.canonical_steel_token('EN') and ggrade.designation_key=public.canonical_steel_token('P265GH') and ggrade.material_number_key=public.canonical_steel_token('1.0425') join public.steel_geometries geom on geom.geometry_key='round|od='||public.canonical_mm_value(r.od_mm)||'|t='||public.canonical_mm_value(r.thickness_mm)
on conflict do nothing;

drop table sk43_p265gh_rows;
