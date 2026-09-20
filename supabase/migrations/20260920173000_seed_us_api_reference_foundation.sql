-- P1.15 / SK4.4a — US/API reference foundation.
--
-- Establishes current public metadata for API 5L, ASTM A53/A53M,
-- ASTM A106/A106M and ASME B36.10, plus source-backed material-grade
-- identities and a real NPS/DN/Schedule dimensional-system identity.
--
-- Copyright / provenance rule:
--   * official sources below are metadata/scope references only;
--   * no paid normative dimensional table is redistributed;
--   * manufacturer grade/capability references are not normative-complete;
--   * no ASTM <-> ASME normative equivalence is asserted here.

insert into public.knowledge_sources (
  id, owner_id, access_scope, source_key, source_type, source_class,
  name, provider, source_uri, country_code, language_code,
  trust_score, metadata, organization_id
) values
  (
    'a5440000-0000-4000-8000-000000000001'::uuid,
    null,'global','official:api:spec-5l-47:2026',
    'standards_registry','official',
    'API Specification 5L — 47th Edition official announcement',
    'American Petroleum Institute',
    'https://www.api.org/news-policy-and-issues/news/2026/06/02/api-announces-47th-edition-of-api-specification-5l',
    'US','en',1.00,
    jsonb_build_object(
      'reference_purpose','standard_metadata_status_scope_only',
      'reuse_basis','public_metadata_reference_only',
      'edition','47',
      'published_on','2026-06-02',
      'content_policy','no_paid_normative_tables_redistributed',
      'verified_on','2026-09-20'
    ),null
  ),
  (
    'a5440000-0000-4000-8000-000000000002'::uuid,
    null,'global','official:astm:a53-a53m-24',
    'standards_registry','official',
    'ASTM A53/A53M-24 official metadata',
    'ASTM International',
    'https://store.astm.org/standards/a53',
    'US','en',1.00,
    jsonb_build_object(
      'reference_purpose','standard_metadata_status_scope_only',
      'reuse_basis','public_metadata_reference_only',
      'active_version','A53/A53M-24',
      'content_policy','no_paid_normative_tables_redistributed',
      'verified_on','2026-09-20'
    ),null
  ),
  (
    'a5440000-0000-4000-8000-000000000003'::uuid,
    null,'global','official:astm:a106-a106m-26',
    'standards_registry','official',
    'ASTM A106/A106M-26 official metadata',
    'ASTM International',
    'https://store.astm.org/standards/a106',
    'US','en',1.00,
    jsonb_build_object(
      'reference_purpose','standard_metadata_status_scope_only',
      'reuse_basis','public_metadata_reference_only',
      'active_version','A106/A106M-26',
      'content_policy','no_paid_normative_tables_redistributed',
      'verified_on','2026-09-20'
    ),null
  ),
  (
    'a5440000-0000-4000-8000-000000000004'::uuid,
    null,'global','official:asme:b36-10:2022',
    'standards_registry','official',
    'ASME B36.10 — Welded and Seamless Wrought Steel Pipe',
    'ASME',
    'https://www.asme.org/codes-standards/find-codes-standards/welded-and-seamless-wrought-steel-pipe',
    'US','en',1.00,
    jsonb_build_object(
      'reference_purpose','standard_metadata_status_scope_only',
      'reuse_basis','public_metadata_reference_only',
      'edition','2022',
      'content_policy','no_paid_normative_tables_redistributed',
      'verified_on','2026-09-20'
    ),null
  ),
  (
    'a5440000-0000-4000-8000-000000000005'::uuid,
    null,'global','primary:ussteel:standard-line-pipe-catalog',
    'manufacturer_catalog','primary',
    'U. S. Steel — Standard and Line Pipe catalog',
    'United States Steel',
    'https://www.ussteel.com/customers/products/tubular/standard-and-line-pipe',
    'US','en',0.90,
    jsonb_build_object(
      'reference_purpose','manufacturer_grade_and_multispec_capability',
      'dataset_scope','manufacturer_product_range',
      'not_normative_complete',true,
      'edition_context','API 5L 46th Edition manufacturer catalog',
      'verified_on','2026-09-20'
    ),null
  ),
  (
    'a5440000-0000-4000-8000-000000000006'::uuid,
    null,'global','primary:vallourec:forge-grade-portfolio-2024',
    'manufacturer_catalog','primary',
    'Vallourec Forges — Grade Portfolio',
    'Vallourec',
    'https://www.vallourec.com/app/uploads/sites/2/2024/06/2024-Vallourec-Forge-Grade-Dimensions.pdf',
    'FR','en',0.90,
    jsonb_build_object(
      'reference_purpose','manufacturer_grade_portfolio',
      'dataset_scope','manufacturer_grade_portfolio',
      'not_normative_complete',true,
      'verified_on','2026-09-20'
    ),null
  )
on conflict do nothing;

insert into public.steel_standards (
  id, code, title, short_explanation, scope_summary, issuing_body,
  edition, valid_from, status, knowledge_source_id, source_locator, metadata,
  standard_system, application_category, manufacturing_processes, dimensional_basis
) values
  (
    'a5440000-0000-4000-8000-000000000101'::uuid,
    'API Spec 5L',
    'Specification for Line Pipe',
    'API line-pipe product specification for seamless and welded steel pipe used in energy transportation.',
    'Current public API metadata states that the 47th edition covers manufacture of seamless and welded steel line pipe, including material, process, inspection, testing, marking and traceability requirements.',
    'American Petroleum Institute','47th Edition (2026)','2026-06-02','active',
    'a5440000-0000-4000-8000-000000000001'::uuid,
    jsonb_build_object('official_announcement','2026-06-02'),
    jsonb_build_object(
      'copyright_rule','summary_and_metadata_only',
      'not_normative_complete',true,
      'current_edition_verified_on','2026-09-20'
    ),
    'API','line_pipe',array['seamless','welded']::text[],
    'source-scoped API line-pipe dimensions; NPS/OD mapping kept separate'
  ),
  (
    'a5440000-0000-4000-8000-000000000102'::uuid,
    'ASTM A53/A53M',
    'Standard Specification for Pipe, Steel, Black and Hot-Dipped, Zinc-Coated, Welded and Seamless',
    'ASTM specification for black and hot-dipped zinc-coated welded and seamless steel pipe.',
    'Official ASTM metadata identifies A53/A53M-24 as the active version.',
    'ASTM International','A53/A53M-24',null,'active',
    'a5440000-0000-4000-8000-000000000002'::uuid,
    jsonb_build_object('page','ASTM A53 standard store metadata'),
    jsonb_build_object(
      'copyright_rule','summary_and_metadata_only',
      'not_normative_complete',true,
      'active_version_verified_on','2026-09-20'
    ),
    'ASTM','standard_pipe',array['seamless','welded']::text[],
    'ASME B36.10 dimensional family where applicable'
  ),
  (
    'a5440000-0000-4000-8000-000000000103'::uuid,
    'ASTM A106/A106M',
    'Standard Specification for Seamless Carbon Steel Pipe for High-Temperature Service',
    'ASTM specification for seamless carbon-steel pipe for high-temperature service.',
    'Official ASTM metadata identifies A106/A106M-26 as active and the public scope references NPS/DN sizes with wall thicknesses given in ASME B36.10M.',
    'ASTM International','A106/A106M-26',null,'active',
    'a5440000-0000-4000-8000-000000000003'::uuid,
    jsonb_build_object('page','ASTM A106 standard store metadata'),
    jsonb_build_object(
      'copyright_rule','summary_and_metadata_only',
      'not_normative_complete',true,
      'active_version_verified_on','2026-09-20'
    ),
    'ASTM','high_temperature_pressure_pipe',array['seamless']::text[],
    'ASME B36.10 / NPS-DN nominal pipe-size family'
  ),
  (
    'a5440000-0000-4000-8000-000000000104'::uuid,
    'ASME B36.10',
    'Welded and Seamless Wrought Steel Pipe',
    'ASME dimensional standard for welded and seamless wrought steel pipe.',
    'Official ASME metadata describes the standardization of pipe dimensions for high- or low-temperature and pressure service.',
    'ASME','B36.10-2022',null,'active',
    'a5440000-0000-4000-8000-000000000004'::uuid,
    jsonb_build_object('page','ASME B36.10 official product metadata'),
    jsonb_build_object(
      'copyright_rule','metadata_only_no_normative_table_copy',
      'not_normative_complete',true,
      'edition_verified_on','2026-09-20'
    ),
    'ASME','pipe_dimensions',array[]::text[],
    'NPS / DN / Schedule'
  )
on conflict do nothing;

insert into public.steel_standard_product_families (
  standard_id,product_family,notes,metadata
) values
  ('a5440000-0000-4000-8000-000000000101','round_tube','Line pipe; geometry data must be source-backed.',jsonb_build_object('microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000102','round_tube','Welded/seamless standard pipe family.',jsonb_build_object('microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000103','round_tube','Seamless high-temperature pipe family.',jsonb_build_object('microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000104','round_tube','Nominal pipe dimensional system.',jsonb_build_object('microblock','SK4.4a'))
on conflict do nothing;

insert into public.steel_dimensional_systems (
  id,code,title,unit_system,issuing_body,standard_id,knowledge_source_id,
  source_locator,metadata
) values (
  'a5440000-0000-4000-8000-000000000201'::uuid,
  'nps-dn-schedule',
  'NPS / DN / Schedule pipe dimensional designations',
  'mixed','ASME',
  'a5440000-0000-4000-8000-000000000104'::uuid,
  'a5440000-0000-4000-8000-000000000004'::uuid,
  jsonb_build_object('standard','ASME B36.10-2022'),
  jsonb_build_object(
    'geometry_family','round_tube',
    'designation_axes',jsonb_build_array('NPS','DN','Schedule'),
    'normative_table_seeded',false,
    'not_normative_complete',true,
    'microblock','SK4.4a'
  )
)
on conflict do nothing;

insert into public.steel_material_grades (
  id,standard_system,designation,material_number,material_family,density_kg_m3,
  short_description,knowledge_source_id,source_locator,metadata
) values
  ('a5440000-0000-4000-8000-000000000301','API','B',null,'line_pipe_carbon_steel',7850,'API line-pipe grade identity.','a5440000-0000-4000-8000-000000000005',jsonb_build_object('catalog','U. S. Steel Standard and Line Pipe'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000302','API','X42',null,'line_pipe_carbon_steel',7850,'API line-pipe grade identity.','a5440000-0000-4000-8000-000000000005',jsonb_build_object('catalog','U. S. Steel Standard and Line Pipe'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000303','API','X46',null,'line_pipe_carbon_steel',7850,'API line-pipe grade identity.','a5440000-0000-4000-8000-000000000005',jsonb_build_object('catalog','U. S. Steel Standard and Line Pipe'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000304','API','X52',null,'line_pipe_carbon_steel',7850,'API line-pipe grade identity.','a5440000-0000-4000-8000-000000000005',jsonb_build_object('catalog','U. S. Steel Standard and Line Pipe'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000305','API','X56',null,'line_pipe_carbon_steel',7850,'API line-pipe grade identity.','a5440000-0000-4000-8000-000000000005',jsonb_build_object('catalog','U. S. Steel Standard and Line Pipe'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000306','API','X60',null,'line_pipe_carbon_steel',7850,'API line-pipe grade identity.','a5440000-0000-4000-8000-000000000005',jsonb_build_object('catalog','U. S. Steel Standard and Line Pipe'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000307','API','X65',null,'line_pipe_carbon_steel',7850,'API line-pipe grade identity.','a5440000-0000-4000-8000-000000000005',jsonb_build_object('catalog','U. S. Steel Standard and Line Pipe'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000308','API','X70',null,'line_pipe_carbon_steel',7850,'API line-pipe grade identity.','a5440000-0000-4000-8000-000000000005',jsonb_build_object('catalog','U. S. Steel Standard and Line Pipe'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000309','API','X80',null,'line_pipe_carbon_steel',7850,'API line-pipe grade identity.','a5440000-0000-4000-8000-000000000005',jsonb_build_object('catalog','U. S. Steel Standard and Line Pipe'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000311','ASTM','A53 Gr B',null,'carbon_steel_pipe',7850,'ASTM A53 Grade B manufacturer-backed identity.','a5440000-0000-4000-8000-000000000005',jsonb_build_object('catalog','U. S. Steel multi-spec capability'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000312','ASTM','A106 Gr A',null,'high_temperature_carbon_steel_pipe',7850,'ASTM A106 Grade A manufacturer-backed identity.','a5440000-0000-4000-8000-000000000006',jsonb_build_object('portfolio','Vallourec Forges Grade Portfolio'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000313','ASTM','A106 Gr B',null,'high_temperature_carbon_steel_pipe',7850,'ASTM A106 Grade B manufacturer-backed identity.','a5440000-0000-4000-8000-000000000006',jsonb_build_object('portfolio','Vallourec Forges Grade Portfolio'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')),
  ('a5440000-0000-4000-8000-000000000314','ASTM','A106 Gr C',null,'high_temperature_carbon_steel_pipe',7850,'ASTM A106 Grade C manufacturer-backed identity.','a5440000-0000-4000-8000-000000000006',jsonb_build_object('portfolio','Vallourec Forges Grade Portfolio'),jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a'))
on conflict do nothing;

insert into public.steel_standard_grade_applicability (
  standard_id,material_grade_id,product_family,manufacturing_process,
  applicability_type,notes,knowledge_source_id,source_locator,metadata
)
select
  'a5440000-0000-4000-8000-000000000101'::uuid,
  g.id,'round_tube','seamless_or_welded','manufacturer_range',
  'Manufacturer-published API 5L grade capability; not asserted as a complete 47th-edition normative grade table.',
  'a5440000-0000-4000-8000-000000000005'::uuid,
  jsonb_build_object('catalog','U. S. Steel Standard and Line Pipe'),
  jsonb_build_object('not_normative_complete',true,'edition_context','manufacturer catalog / API 5L 46th','microblock','SK4.4a')
from public.steel_material_grades g
where g.standard_system_key=public.canonical_steel_token('API')
  and g.designation_key in (
    public.canonical_steel_token('B'),public.canonical_steel_token('X42'),
    public.canonical_steel_token('X46'),public.canonical_steel_token('X52'),
    public.canonical_steel_token('X56'),public.canonical_steel_token('X60'),
    public.canonical_steel_token('X65'),public.canonical_steel_token('X70'),
    public.canonical_steel_token('X80')
  )
on conflict do nothing;

insert into public.steel_standard_grade_applicability (
  standard_id,material_grade_id,product_family,manufacturing_process,
  applicability_type,notes,knowledge_source_id,source_locator,metadata
)
select
  case
    when g.designation_key=public.canonical_steel_token('A53 Gr B')
      then 'a5440000-0000-4000-8000-000000000102'::uuid
    else 'a5440000-0000-4000-8000-000000000103'::uuid
  end,
  g.id,'round_tube',
  case
    when g.designation_key=public.canonical_steel_token('A53 Gr B') then 'seamless_or_welded'
    else 'seamless'
  end,
  'manufacturer_range',
  'Manufacturer grade portfolio / multi-spec capability; not a normative-complete grade table.',
  g.knowledge_source_id,
  g.source_locator,
  jsonb_build_object('not_normative_complete',true,'microblock','SK4.4a')
from public.steel_material_grades g
where g.standard_system_key=public.canonical_steel_token('ASTM')
  and g.designation_key in (
    public.canonical_steel_token('A53 Gr B'),
    public.canonical_steel_token('A106 Gr A'),
    public.canonical_steel_token('A106 Gr B'),
    public.canonical_steel_token('A106 Gr C')
  )
on conflict do nothing;

-- Explicitly preserve the commercial multi-stencil relationship as weak,
-- source-backed comparability only. This is not normative equivalence.
insert into public.steel_grade_cross_references (
  from_material_grade_id,to_material_grade_id,relation_type,evidence_class,
  notes,knowledge_source_id,source_locator,metadata
)
select
  a53.id,a106.id,
  'commercially_comparable','manufacturer_reference',
  'U. S. Steel publishes multi-spec combinations including ASTM A53 Gr B / A106 Gr B / API 5L Gr B. This relation is commercial/manufacturer context only and does not authorize normative substitution.',
  'a5440000-0000-4000-8000-000000000005'::uuid,
  jsonb_build_object('section','MULTI-SPEC/MULTI-STENCIL'),
  jsonb_build_object('normative_substitution_allowed',false,'microblock','SK4.4a')
from public.steel_material_grades a53
join public.steel_material_grades a106 on true
where a53.standard_system_key=public.canonical_steel_token('ASTM')
  and a53.designation_key=public.canonical_steel_token('A53 Gr B')
  and a106.standard_system_key=public.canonical_steel_token('ASTM')
  and a106.designation_key=public.canonical_steel_token('A106 Gr B')
on conflict do nothing;
