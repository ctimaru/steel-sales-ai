-- P1.15 / SK4.2 — EU structural hollow-section catalog tranche 1.
--
-- Purpose:
--   * seed EN 10210 / EN 10219 standard families and current dimensional-part metadata;
--   * seed manufacturer-backed grade applicability;
--   * load canonical CHS / SHS / RHS geometries;
--   * load published kg/m for a controlled EN 10219 cold-formed manufacturer range;
--   * load EN 10210 hot-finished manufacturer availability separately from normative data;
--   * keep published and calculated weights semantically distinct.
--
-- IMPORTANT:
--   Manufacturer catalog rows are NOT asserted to be the complete normative dimensional
--   universe of EN 10210 / EN 10219. Normative metadata and manufacturer product ranges
--   remain separate provenance classes.

insert into public.knowledge_sources (
  id, owner_id, access_scope, source_key, source_type, source_class,
  name, provider, source_uri, country_code, language_code,
  license_name, trust_score, metadata, organization_id
) values
  (
    '10210000-0000-4000-8000-000000000001'::uuid, null, 'global',
    'official:bsi:en-10210-2:2019', 'standards_registry', 'official',
    'BS EN 10210-2:2019 — official metadata', 'BSI',
    'https://knowledge.bsigroup.com/products/hot-finished-steel-structural-hollow-sections-tolerances-dimensions-and-sectional-properties',
    'GB', 'en', null, 1.00,
    jsonb_build_object(
      'reference_purpose','standard_metadata_status_scope_only',
      'reuse_basis','public_metadata_reference_only',
      'content_policy','no_normative_full_text_or_paid_tables_redistributed',
      'verified_on','2026-09-17'
    ), null
  ),
  (
    '10219000-0000-4000-8000-000000000001'::uuid, null, 'global',
    'official:bsi:en-10219-2:2019', 'standards_registry', 'official',
    'BS EN 10219-2:2019 — official metadata', 'BSI',
    'https://knowledge.bsigroup.com/products/cold-formed-welded-steel-structural-hollow-sections-tolerances-dimensions-and-sectional-properties',
    'GB', 'en', null, 1.00,
    jsonb_build_object(
      'reference_purpose','standard_metadata_status_scope_only',
      'reuse_basis','public_metadata_reference_only',
      'content_policy','no_normative_full_text_or_paid_tables_redistributed',
      'verified_on','2026-09-17'
    ), null
  ),
  (
    '1021a000-0000-4000-8000-000000000001'::uuid, null, 'global',
    'primary:arcelormittal:hollow-sections-product-range', 'manufacturer_product_page', 'primary',
    'ArcelorMittal — Steel Hollow Sections product range', 'ArcelorMittal',
    'https://projects.arcelormittal.com/energy/products-services/product-range/hollow-sections',
    null, 'en', null, 0.95,
    jsonb_build_object(
      'reference_purpose','manufacturer_standard_process_grade_scope',
      'dataset_scope','manufacturer_product_range',
      'not_normative_complete',true,
      'verified_on','2026-09-17'
    ), null
  ),
  (
    '10219000-0000-4000-8000-000000000010'::uuid, null, 'global',
    'primary:arcelormittal:distribution:shs-cold', 'manufacturer_product_page', 'primary',
    'ArcelorMittal Distribution UK — Square Hollow Section COLD', 'ArcelorMittal',
    'https://distribution.arcelormittal.com/en-GB/products/41',
    'GB', 'en', null, 0.95,
    jsonb_build_object(
      'reference_purpose','manufacturer_dimension_weight_range',
      'dataset_scope','manufacturer_product_range',
      'product_family','square_tube',
      'forming','cold_formed',
      'not_normative_complete',true,
      'verified_on','2026-09-17'
    ), null
  ),
  (
    '10219000-0000-4000-8000-000000000011'::uuid, null, 'global',
    'primary:arcelormittal:distribution:rhs-cold', 'manufacturer_product_page', 'primary',
    'ArcelorMittal Distribution UK — Rectangular Hollow Section COLD', 'ArcelorMittal',
    'https://distribution.arcelormittal.com/en-GB/products/42',
    'GB', 'en', null, 0.95,
    jsonb_build_object(
      'reference_purpose','manufacturer_dimension_weight_range',
      'dataset_scope','manufacturer_product_range',
      'product_family','rectangular_tube',
      'forming','cold_formed',
      'not_normative_complete',true,
      'verified_on','2026-09-17'
    ), null
  ),
  (
    '10210000-0000-4000-8000-000000000010'::uuid, null, 'global',
    'primary:arcelormittal:distribution:shs-hot', 'manufacturer_product_page', 'primary',
    'ArcelorMittal Distribution UK — Square Hollow Section HOT', 'ArcelorMittal',
    'https://distribution.arcelormittal.com/en-GB/products/121',
    'GB', 'en', null, 0.90,
    jsonb_build_object(
      'reference_purpose','manufacturer_dimension_availability',
      'dataset_scope','manufacturer_product_range',
      'product_family','square_tube',
      'forming','hot_finished',
      'not_normative_complete',true,
      'verified_on','2026-09-17'
    ), null
  ),
  (
    '10210000-0000-4000-8000-000000000011'::uuid, null, 'global',
    'primary:arcelormittal:distribution:chs-hot', 'manufacturer_product_page', 'primary',
    'ArcelorMittal Distribution UK — Circular Hollow Sections HOT', 'ArcelorMittal',
    'https://distribution.arcelormittal.com/en-GB/products/109',
    'GB', 'en', null, 0.90,
    jsonb_build_object(
      'reference_purpose','manufacturer_dimension_availability',
      'dataset_scope','manufacturer_product_range',
      'product_family','round_tube',
      'forming','hot_finished',
      'not_normative_complete',true,
      'verified_on','2026-09-17'
    ), null
  ),
  (
    '1021a000-0000-4000-8000-000000000020'::uuid, null, 'global',
    'primary:mannesmann:structural-dop', 'manufacturer_reference', 'primary',
    'Mannesmann — structural hollow sections declarations of performance / grade list',
    'Mannesmann',
    'https://www.mannesmann.com/en/download-center/declarations-of-performance.html?tab=267060',
    'DE', 'en', null, 0.95,
    jsonb_build_object(
      'reference_purpose','manufacturer_grade_applicability',
      'standards',jsonb_build_array('EN 10210-1','EN 10219-1'),
      'verified_on','2026-09-17'
    ), null
  )
on conflict do nothing;

-- Standard series.
insert into public.steel_standard_series (
  id, standard_system, code, title, issuing_body, application_category,
  short_explanation, knowledge_source_id, source_locator, metadata
) values
  (
    '10210000-0000-4000-8000-000000000100'::uuid, 'EN', 'EN 10210',
    'Hot finished steel structural hollow sections', 'CEN', 'structural_hollow_sections',
    'European structural hollow-section family for hot-finished circular, square and rectangular sections.',
    '10210000-0000-4000-8000-000000000001'::uuid,
    jsonb_build_object('reference','BS EN 10210-2:2019'),
    jsonb_build_object('reference_database_v2',true,'not_full_normative_text',true)
  ),
  (
    '10219000-0000-4000-8000-000000000100'::uuid, 'EN', 'EN 10219',
    'Cold formed welded steel structural hollow sections', 'CEN', 'structural_hollow_sections',
    'European structural hollow-section family for cold-formed welded circular, square and rectangular sections.',
    '10219000-0000-4000-8000-000000000001'::uuid,
    jsonb_build_object('reference','BS EN 10219-2:2019'),
    jsonb_build_object('reference_database_v2',true,'not_full_normative_text',true)
  )
on conflict do nothing;

-- Umbrella product-reference records keep manufacturer ranges separate from the paid normative parts.
insert into public.steel_standards (
  id, code, title, short_explanation, scope_summary, issuing_body, edition, status,
  knowledge_source_id, source_locator, metadata, standard_series_id, standard_system,
  part_number, application_category, manufacturing_processes, dimensional_basis
) values
  (
    '10210000-0000-4000-8000-000000000110'::uuid, 'EN 10210',
    'EN 10210 — hot finished structural hollow sections',
    'Commercial reference umbrella for hot-finished structural hollow sections; normative parts are tracked separately.',
    'Used here to attach manufacturer product ranges without asserting a complete normative dimensional table.',
    'CEN', 'manufacturer-reference umbrella; normative parts tracked separately', 'active',
    '1021a000-0000-4000-8000-000000000001'::uuid,
    jsonb_build_object('page','ArcelorMittal hollow sections product range'),
    jsonb_build_object('dataset_role','manufacturer_range_umbrella','not_normative_complete',true),
    '10210000-0000-4000-8000-000000000100'::uuid, 'EN', null,
    'structural_hollow_sections', array['hot_finished','welded','seamless']::text[], 'metric_geometry'
  ),
  (
    '10219000-0000-4000-8000-000000000110'::uuid, 'EN 10219',
    'EN 10219 — cold formed welded structural hollow sections',
    'Commercial reference umbrella for cold-formed welded structural hollow sections; normative parts are tracked separately.',
    'Used here to attach manufacturer product ranges without asserting a complete normative dimensional table.',
    'CEN', 'manufacturer-reference umbrella; normative parts tracked separately', 'active',
    '1021a000-0000-4000-8000-000000000001'::uuid,
    jsonb_build_object('page','ArcelorMittal hollow sections product range'),
    jsonb_build_object('dataset_role','manufacturer_range_umbrella','not_normative_complete',true),
    '10219000-0000-4000-8000-000000000100'::uuid, 'EN', null,
    'structural_hollow_sections', array['cold_formed','welded']::text[], 'metric_geometry'
  ),
  (
    '10210000-0000-4000-8000-000000000120'::uuid, 'EN 10210-2',
    'Hot finished steel structural hollow sections — tolerances, dimensions and sectional properties',
    'Dimensional part of the EN 10210 series for hot-finished structural hollow sections.',
    'Public BSI metadata confirms circular, square and rectangular coverage; full paid normative tables are not copied.',
    'CEN; national adoption metadata via BSI', '2019', 'active',
    '10210000-0000-4000-8000-000000000001'::uuid,
    jsonb_build_object('page','BS EN 10210-2:2019 metadata'),
    jsonb_build_object('copyright_rule','metadata_and_original_summary_only'),
    '10210000-0000-4000-8000-000000000100'::uuid, 'EN', '2',
    'structural_hollow_sections', array['hot_finished']::text[], 'metric_geometry'
  ),
  (
    '10219000-0000-4000-8000-000000000120'::uuid, 'EN 10219-2',
    'Cold formed welded steel structural hollow sections — tolerances, dimensions and sectional properties',
    'Dimensional part of the EN 10219 series for cold-formed welded structural hollow sections.',
    'Public BSI metadata confirms circular, square and rectangular coverage; full paid normative tables are not copied.',
    'CEN; national adoption metadata via BSI', '2019', 'active',
    '10219000-0000-4000-8000-000000000001'::uuid,
    jsonb_build_object('page','BS EN 10219-2:2019 metadata'),
    jsonb_build_object('copyright_rule','metadata_and_original_summary_only'),
    '10219000-0000-4000-8000-000000000100'::uuid, 'EN', '2',
    'structural_hollow_sections', array['cold_formed','welded']::text[], 'metric_geometry'
  )
on conflict do nothing;

insert into public.steel_standard_product_families (standard_id, product_family, notes, metadata)
select s.id, f.product_family,
       'Manufacturer-range product family; not a statement of complete normative availability.',
       jsonb_build_object('dataset_scope','manufacturer_product_range','not_normative_complete',true)
from public.steel_standards s
cross join (values ('round_tube'),('square_tube'),('rectangular_tube')) as f(product_family)
where s.code_key in (public.canonical_steel_token('EN 10210'), public.canonical_steel_token('EN 10219'))
on conflict do nothing;

-- Canonical grade identities. Material numbers are filled only where backed by a primary manufacturer reference.
insert into public.steel_material_grades (
  standard_system, designation, material_number, material_family, density_kg_m3,
  short_description, knowledge_source_id, source_locator, metadata
) values
  ('EN','S355J2H','1.0576','structural_carbon_steel',7850,
   'Structural hollow-section grade used in EN 10210 / EN 10219 manufacturer ranges.',
   '1021a000-0000-4000-8000-000000000020'::uuid,
   jsonb_build_object('reference','Mannesmann structural DoP / material pages'),
   jsonb_build_object('grade_reference','primary_manufacturer')),
  ('EN','S355NH','1.0539','fine_grain_structural_steel',7850,
   'Normalized fine-grain structural hollow-section grade.',
   '1021a000-0000-4000-8000-000000000020'::uuid,
   jsonb_build_object('reference','Mannesmann structural DoP / material pages'),
   jsonb_build_object('grade_reference','primary_manufacturer')),
  ('EN','S355NLH','1.0549','fine_grain_structural_steel',7850,
   'Normalized fine-grain structural hollow-section grade for lower-temperature toughness.',
   '1021a000-0000-4000-8000-000000000020'::uuid,
   jsonb_build_object('reference','Mannesmann structural DoP / material pages'),
   jsonb_build_object('grade_reference','primary_manufacturer'))
on conflict do nothing;

-- Grade applicability from ArcelorMittal product range. This is manufacturer availability, not normative equivalence.
insert into public.steel_standard_grade_applicability (
  standard_id, material_grade_id, product_family, manufacturing_process,
  applicability_type, notes, knowledge_source_id, source_locator, metadata
)
select s.id, g.id, f.product_family, p.process, 'manufacturer_range',
       'Grade/process combination published in ArcelorMittal hollow-section product range.',
       '1021a000-0000-4000-8000-000000000001'::uuid,
       jsonb_build_object('page','Steel Hollow Sections product range'),
       jsonb_build_object('not_normative_complete',true)
from (values
  ('EN 10219','S355J2H','square_tube','cold_formed'),
  ('EN 10219','S355J2H','rectangular_tube','cold_formed'),
  ('EN 10219','S355J2H','round_tube','cold_formed'),
  ('EN 10210','S355J2H','square_tube','hot_finished'),
  ('EN 10210','S355J2H','rectangular_tube','hot_finished'),
  ('EN 10210','S355J2H','round_tube','hot_finished'),
  ('EN 10210','S355NH','square_tube','hot_finished'),
  ('EN 10210','S355NH','rectangular_tube','hot_finished'),
  ('EN 10210','S355NH','round_tube','hot_finished'),
  ('EN 10210','S355NLH','square_tube','hot_finished'),
  ('EN 10210','S355NLH','rectangular_tube','hot_finished'),
  ('EN 10210','S355NLH','round_tube','hot_finished')
) as p(standard_code, grade, product_family, process)
join public.steel_standards s on s.code_key = public.canonical_steel_token(p.standard_code) and s.status='active'
join public.steel_material_grades g on g.designation_key = public.canonical_steel_token(p.grade) and g.standard_system_key=public.canonical_steel_token('EN')
join (values ('square_tube'),('rectangular_tube'),('round_tube')) f(product_family) on f.product_family=p.product_family
on conflict do nothing;

-- EN 10219 cold-formed SHS/RHS published manufacturer weights.
with published_rows(product_family,width_mm,height_mm,thickness_mm,weight_kg_m,source_id) as (
  values
  -- Square Hollow Section - COLD (ArcelorMittal Distribution UK)
  ('square_tube',100::numeric,100::numeric,4::numeric,11.7::numeric,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',100,100,5,14.4,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',100,100,6,17.0,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',100,100,8,21.4,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',100,100,10,25.6,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',120,120,5,17.5,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',120,120,6,20.7,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',120,120,8,26.4,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',120,120,10,31.8,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',140,140,5,20.7,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',140,140,6,24.5,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',140,140,8,31.4,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',140,140,10,38.1,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',150,150,5,22.3,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',150,150,6,26.4,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',150,150,8,33.9,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',150,150,10,41.3,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',180,180,6,32.1,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',180,180,8,41.5,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',180,180,10,50.7,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',200,200,5,30.1,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',200,200,6,35.8,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',200,200,8,46.5,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',200,200,10,57.0,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',250,250,6,45.2,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',250,250,8,59.1,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',250,250,10,72.7,'10219000-0000-4000-8000-000000000010'::uuid),
  -- Rectangular Hollow Section - COLD (ArcelorMittal Distribution UK)
  ('rectangular_tube',120,60,5,12.8,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',120,80,5,14.4,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',120,80,6,17.0,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',120,80,8,21.4,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',150,100,5,18.3,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',150,100,6,21.7,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',150,100,8,27.7,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',150,100,10,33.4,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',160,80,5,17.5,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',160,80,6,20.7,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',160,80,8,26.4,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',160,80,10,31.8,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',200,100,5,22.3,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',200,100,6,26.4,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',200,100,8,33.9,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',200,100,10,41.3,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',250,150,5,30.1,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',250,150,6,35.8,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',250,150,8,46.5,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',250,150,10,57.0,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',300,200,6,45.2,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',300,200,8,59.1,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',300,200,10,72.7,'10219000-0000-4000-8000-000000000011'::uuid)
), inserted_geometries as (
  insert into public.steel_geometries (product_family,width_mm,height_mm,thickness_mm,metadata)
  select product_family,width_mm,height_mm,thickness_mm,
         jsonb_build_object('seed','sk4.2-en10219','source_class','manufacturer_product_range')
  from published_rows
  on conflict (geometry_key) do nothing
  returning id
)
insert into public.steel_weight_references (
  geometry_id, weight_kg_m, weight_method, is_canonical,
  knowledge_source_id, source_locator, metadata
)
select g.id, p.weight_kg_m, 'published', true,
       p.source_id,
       jsonb_build_object('table','Section Size / Thickness / Kg per m'),
       jsonb_build_object('dataset_scope','manufacturer_product_range','not_normative_complete',true,'seed','sk4.2-en10219')
from published_rows p
join public.steel_geometries g
  on g.geometry_key = case
    when p.product_family='square_tube' then
      'square|' || public.canonical_mm_value(p.width_mm) || 'x' || public.canonical_mm_value(p.height_mm) || '|t=' || public.canonical_mm_value(p.thickness_mm)
    else
      'rect|' || public.canonical_mm_value(greatest(p.width_mm,p.height_mm)) || 'x' || public.canonical_mm_value(least(p.width_mm,p.height_mm)) || '|t=' || public.canonical_mm_value(p.thickness_mm)
  end
on conflict do nothing;

-- Manufacturer-range applicability and legacy projection for existing SK4 RPCs.
with published_rows(product_family,width_mm,height_mm,thickness_mm,weight_kg_m,source_id) as (
  values
  ('square_tube',100::numeric,100::numeric,4::numeric,11.7::numeric,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',100,100,5,14.4,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',100,100,6,17.0,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',100,100,8,21.4,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',100,100,10,25.6,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',120,120,5,17.5,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',120,120,6,20.7,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',120,120,8,26.4,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',120,120,10,31.8,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',140,140,5,20.7,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',140,140,6,24.5,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',140,140,8,31.4,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',140,140,10,38.1,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',150,150,5,22.3,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',150,150,6,26.4,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',150,150,8,33.9,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',150,150,10,41.3,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',180,180,6,32.1,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',180,180,8,41.5,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',180,180,10,50.7,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',200,200,5,30.1,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',200,200,6,35.8,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',200,200,8,46.5,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',200,200,10,57.0,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',250,250,6,45.2,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',250,250,8,59.1,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',250,250,10,72.7,'10219000-0000-4000-8000-000000000010'::uuid),
  ('rectangular_tube',120,60,5,12.8,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',120,80,5,14.4,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',120,80,6,17.0,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',120,80,8,21.4,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',150,100,5,18.3,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',150,100,6,21.7,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',150,100,8,27.7,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',150,100,10,33.4,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',160,80,5,17.5,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',160,80,6,20.7,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',160,80,8,26.4,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',160,80,10,31.8,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',200,100,5,22.3,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',200,100,6,26.4,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',200,100,8,33.9,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',200,100,10,41.3,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',250,150,5,30.1,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',250,150,6,35.8,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',250,150,8,46.5,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',250,150,10,57.0,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',300,200,6,45.2,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',300,200,8,59.1,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',300,200,10,72.7,'10219000-0000-4000-8000-000000000011'::uuid)
), resolved as (
  select p.*, g.id as geometry_id
  from published_rows p
  join public.steel_geometries g on g.geometry_key = case
    when p.product_family='square_tube' then 'square|' || public.canonical_mm_value(p.width_mm) || 'x' || public.canonical_mm_value(p.height_mm) || '|t=' || public.canonical_mm_value(p.thickness_mm)
    else 'rect|' || public.canonical_mm_value(greatest(p.width_mm,p.height_mm)) || 'x' || public.canonical_mm_value(least(p.width_mm,p.height_mm)) || '|t=' || public.canonical_mm_value(p.thickness_mm)
  end
), std as (
  select id from public.steel_standards where code_key=public.canonical_steel_token('EN 10219') and status='active' limit 1
)
insert into public.steel_standard_dimension_applicability (
  standard_id, geometry_id, dimensional_system_id, manufacturing_process,
  applicability_type, is_normative_complete, knowledge_source_id, source_locator, metadata
)
select std.id, r.geometry_id, 'a1100000-0000-4000-8000-000000000002'::uuid, 'cold_formed',
       'manufacturer_range', false, r.source_id,
       jsonb_build_object('table','Section Size / Thickness / Kg per m'),
       jsonb_build_object('seed','sk4.2-en10219','published_weight_kg_m',r.weight_kg_m)
from resolved r cross join std
on conflict do nothing;

with published_rows(product_family,width_mm,height_mm,thickness_mm,weight_kg_m,source_id) as (
  values
  ('square_tube',100::numeric,100::numeric,4::numeric,11.7::numeric,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',100,100,5,14.4,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',100,100,6,17.0,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',100,100,8,21.4,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',100,100,10,25.6,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',120,120,5,17.5,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',120,120,6,20.7,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',120,120,8,26.4,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',120,120,10,31.8,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',140,140,5,20.7,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',140,140,6,24.5,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',140,140,8,31.4,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',140,140,10,38.1,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',150,150,5,22.3,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',150,150,6,26.4,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',150,150,8,33.9,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',150,150,10,41.3,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',180,180,6,32.1,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',180,180,8,41.5,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',180,180,10,50.7,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',200,200,5,30.1,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',200,200,6,35.8,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',200,200,8,46.5,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',200,200,10,57.0,'10219000-0000-4000-8000-000000000010'::uuid),
  ('square_tube',250,250,6,45.2,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',250,250,8,59.1,'10219000-0000-4000-8000-000000000010'::uuid),('square_tube',250,250,10,72.7,'10219000-0000-4000-8000-000000000010'::uuid),
  ('rectangular_tube',120,60,5,12.8,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',120,80,5,14.4,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',120,80,6,17.0,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',120,80,8,21.4,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',150,100,5,18.3,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',150,100,6,21.7,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',150,100,8,27.7,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',150,100,10,33.4,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',160,80,5,17.5,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',160,80,6,20.7,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',160,80,8,26.4,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',160,80,10,31.8,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',200,100,5,22.3,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',200,100,6,26.4,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',200,100,8,33.9,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',200,100,10,41.3,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',250,150,5,30.1,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',250,150,6,35.8,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',250,150,8,46.5,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',250,150,10,57.0,'10219000-0000-4000-8000-000000000011'::uuid),
  ('rectangular_tube',300,200,6,45.2,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',300,200,8,59.1,'10219000-0000-4000-8000-000000000011'::uuid),('rectangular_tube',300,200,10,72.7,'10219000-0000-4000-8000-000000000011'::uuid)
), std as (
  select id from public.steel_standards where code_key=public.canonical_steel_token('EN 10219') and status='active' limit 1
)
insert into public.steel_dimensional_rows (
  standard_id, product_family, width_mm, height_mm, thickness_mm,
  theoretical_weight_kg_m, weight_method, knowledge_source_id,
  source_locator, metadata, geometry_id
)
select std.id, p.product_family, p.width_mm, p.height_mm, p.thickness_mm,
       p.weight_kg_m, 'published', p.source_id,
       jsonb_build_object('table','Section Size / Thickness / Kg per m'),
       jsonb_build_object('dataset_scope','manufacturer_product_range','not_normative_complete',true,'projection_of_reference_v2',true),
       g.id
from published_rows p cross join std
join public.steel_geometries g on g.geometry_key = case
  when p.product_family='square_tube' then 'square|' || public.canonical_mm_value(p.width_mm) || 'x' || public.canonical_mm_value(p.height_mm) || '|t=' || public.canonical_mm_value(p.thickness_mm)
  else 'rect|' || public.canonical_mm_value(greatest(p.width_mm,p.height_mm)) || 'x' || public.canonical_mm_value(least(p.width_mm,p.height_mm)) || '|t=' || public.canonical_mm_value(p.thickness_mm)
end
on conflict do nothing;

-- EN 10210 manufacturer hot-finished availability. These rows intentionally carry no
-- published kg/m unless we have a source value. CHS gets an explicit calculated reference
-- using carbon-steel density 7850 kg/m3; SHS remains geometry-only in this tranche.
with hot_chs(od_mm,thickness_mm) as (
  values
  (76.1::numeric,3::numeric),(76.1,5),(88.9,3),(88.9,4),(88.9,5),
  (114.3,3.6),(114.3,5),(114.3,6),(139.7,5),(139.7,6),(139.7,8),(139.7,10),
  (168.3,5),(168.3,6),(168.3,8),(168.3,10)
)
insert into public.steel_geometries (product_family,outer_diameter_mm,thickness_mm,metadata)
select 'round_tube',od_mm,thickness_mm,
       jsonb_build_object('seed','sk4.2-en10210','source_class','manufacturer_product_range')
from hot_chs
on conflict (geometry_key) do nothing;

with hot_shs(side_mm,thickness_mm) as (
  values
  (100::numeric,5::numeric),(100,6),(100,8),(100,10),
  (120,5),(120,6),(120,8),(120,10),
  (150,5),(150,6),(150,8),(150,10),
  (200,5),(200,6),(200,8),(200,10)
)
insert into public.steel_geometries (product_family,width_mm,height_mm,thickness_mm,metadata)
select 'square_tube',side_mm,side_mm,thickness_mm,
       jsonb_build_object('seed','sk4.2-en10210','source_class','manufacturer_product_range')
from hot_shs
on conflict (geometry_key) do nothing;

with std as (
  select id from public.steel_standards where code_key=public.canonical_steel_token('EN 10210') and status='active' limit 1
), hot as (
  select g.id geometry_id, g.product_family,
         case when g.product_family='round_tube' then '10210000-0000-4000-8000-000000000011'::uuid else '10210000-0000-4000-8000-000000000010'::uuid end source_id
  from public.steel_geometries g
  where (g.metadata->>'seed')='sk4.2-en10210'
)
insert into public.steel_standard_dimension_applicability (
  standard_id, geometry_id, dimensional_system_id, manufacturing_process,
  applicability_type, is_normative_complete, knowledge_source_id, source_locator, metadata
)
select std.id, hot.geometry_id,
       case when hot.product_family='round_tube' then 'a1100000-0000-4000-8000-000000000001'::uuid else 'a1100000-0000-4000-8000-000000000002'::uuid end,
       'hot_finished','manufacturer_range',false,hot.source_id,
       jsonb_build_object('page','ArcelorMittal Distribution HOT range'),
       jsonb_build_object('seed','sk4.2-en10210','weight_status',case when hot.product_family='round_tube' then 'calculated_reference_available' else 'published_weight_pending' end)
from hot cross join std
on conflict do nothing;

-- Calculated CHS reference weights only. Formula is explicit and never presented as a published manufacturer mass.
insert into public.steel_weight_references (
  geometry_id, weight_kg_m, weight_method, density_kg_m3, formula_version,
  is_canonical, knowledge_source_id, source_locator, metadata
)
select g.id,
       round((pi()/4 * (power(g.outer_diameter_mm,2) - power(g.outer_diameter_mm - 2*g.thickness_mm,2)) * 1e-6 * 7850)::numeric, 4),
       'calculated',7850,'round-annulus-density-7850-v1',false,
       '10210000-0000-4000-8000-000000000011'::uuid,
       jsonb_build_object('formula','pi/4*(D^2-(D-2t)^2)*1e-6*density'),
       jsonb_build_object('price_safe_reference',true,'not_published_mass',true,'seed','sk4.2-en10210')
from public.steel_geometries g
where g.product_family='round_tube' and (g.metadata->>'seed')='sk4.2-en10210'
on conflict do nothing;
