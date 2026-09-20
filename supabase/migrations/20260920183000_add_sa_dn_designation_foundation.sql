-- P1.15 / SK4.4d — ASME SA-family identities + source-backed NPS/DN mapping.
--
-- Sources:
-- 1) Tenaris Dalmine / TUV SUD BABT certificate dated 2025-05-28:
--    manufacturer scope explicitly lists ASME SA-106 alongside ASTM A106
--    for Grade B/C and ASME SA-53 alongside ASTM A53 for Grade B.
-- 2) Victaulic 17.09 public performance data:
--    explicitly pairs NPS 6/8/10/12 with DN150/200/250/300.
--
-- Policy:
-- * SA/A pairing is manufacturer-certified evidence only, not a general
--   normative equivalence or substitution rule.
-- * DN is a designation mapping from a separate manufacturer source.
-- * No weight/reference row is mutated and no canonical flag is changed.

insert into public.knowledge_sources (
  id, owner_id, access_scope, source_key, source_type, source_class,
  name, provider, source_uri, country_code, language_code,
  trust_score, metadata, organization_id
) values
  (
    'a5440000-0000-4000-8000-000000000007'::uuid,
    null,'global','primary:tenaris:tuv-per-sa-a-scope-2025',
    'manufacturer_certificate','primary',
    'Tenaris Dalmine / TUV SUD BABT — PER material manufacturer scope 2025',
    'Tenaris / TUV SUD BABT Unlimited',
    'https://www.tenaris.com/media/ckbboped/per_plusscope_per_dalmine_2025.pdf',
    'IT','en',0.95,
    jsonb_build_object(
      'reference_purpose','manufacturer_certified_sa_astm_pairing',
      'certificate','PER-0168-QS-M 3232243/2022/MUC-02',
      'certificate_date','2025-05-28',
      'valid_through','2028-06-30',
      'not_normative_equivalence',true,
      'verified_on','2026-09-20'
    ),null
  ),
  (
    'a5440000-0000-4000-8000-000000000008'::uuid,
    null,'global','primary:victaulic:17.09-nps-dn-map-2026',
    'manufacturer_catalog','primary',
    'Victaulic 17.09 — NPS / DN designation mapping',
    'Victaulic Company',
    'https://assets.victaulic.com/assets/uploads/literature/17.09.pdf',
    'US','en',0.90,
    jsonb_build_object(
      'reference_purpose','nps_dn_designation_mapping',
      'document','17.09',
      'updated','2026',
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
    'a5440000-0000-4000-8000-000000000105'::uuid,
    'ASME SA-106/SA-106M',
    'ASME SA-106 / SA-106M material specification family',
    'ASME SA-106 material-specification identity for seamless carbon-steel pressure pipe; this catalog entry is manufacturer-scope backed and does not assert a specific BPVC edition.',
    'Tenaris/TUV 2025 manufacturer approval lists Grade B and C under ASME SA-106 alongside ASTM A106 for seamless pipe.',
    'ASME',null,null,'active',
    'a5440000-0000-4000-8000-000000000007'::uuid,
    jsonb_build_object('certificate_page',2,'row',16),
    jsonb_build_object(
      'catalog_scope','manufacturer_certified_identity',
      'exact_current_bpvc_edition_not_asserted',true,
      'not_normative_complete',true,
      'astm_pairing_is_not_global_equivalence',true,
      'microblock','SK4.4d'
    ),
    'ASME','high_temperature_pressure_pipe',array['seamless']::text[],
    'NPS / DN / Schedule family; dimensions remain independently sourced'
  ),
  (
    'a5440000-0000-4000-8000-000000000106'::uuid,
    'ASME SA-53/SA-53M',
    'ASME SA-53 / SA-53M material specification family',
    'ASME SA-53 material-specification identity for carbon-steel pipe; this catalog entry is manufacturer-scope backed and does not assert a specific BPVC edition.',
    'Tenaris/TUV 2025 manufacturer approval lists Grade B under ASME SA-53 alongside ASTM A53 for seamless pipe.',
    'ASME',null,null,'active',
    'a5440000-0000-4000-8000-000000000007'::uuid,
    jsonb_build_object('certificate_page',2,'row',18),
    jsonb_build_object(
      'catalog_scope','manufacturer_certified_identity',
      'exact_current_bpvc_edition_not_asserted',true,
      'not_normative_complete',true,
      'astm_pairing_is_not_global_equivalence',true,
      'microblock','SK4.4d'
    ),
    'ASME','standard_pipe',array['seamless']::text[],
    'NPS / DN / Schedule family; dimensions remain independently sourced'
  )
on conflict do nothing;

insert into public.steel_standard_product_families (
  standard_id,product_family,notes,metadata
) values
  (
    'a5440000-0000-4000-8000-000000000105'::uuid,
    'round_tube',
    'Manufacturer-certified seamless pipe scope only.',
    jsonb_build_object('not_normative_complete',true,'microblock','SK4.4d')
  ),
  (
    'a5440000-0000-4000-8000-000000000106'::uuid,
    'round_tube',
    'Manufacturer-certified seamless pipe scope only.',
    jsonb_build_object('not_normative_complete',true,'microblock','SK4.4d')
  )
on conflict do nothing;

insert into public.steel_material_grades (
  id,standard_system,designation,material_number,material_family,density_kg_m3,
  short_description,knowledge_source_id,source_locator,metadata
) values
  (
    'a5440000-0000-4000-8000-000000000321','ASME','SA-106 Gr B',null,
    'high_temperature_carbon_steel_pipe',7850,
    'ASME SA-106 Grade B manufacturer-certified identity.',
    'a5440000-0000-4000-8000-000000000007',
    jsonb_build_object('certificate_page',2,'row',16),
    jsonb_build_object(
      'not_normative_complete',true,
      'manufacturer_certified_scope',true,
      'astm_pairing_is_not_global_equivalence',true,
      'microblock','SK4.4d'
    )
  ),
  (
    'a5440000-0000-4000-8000-000000000322','ASME','SA-106 Gr C',null,
    'high_temperature_carbon_steel_pipe',7850,
    'ASME SA-106 Grade C manufacturer-certified identity.',
    'a5440000-0000-4000-8000-000000000007',
    jsonb_build_object('certificate_page',2,'row',16),
    jsonb_build_object(
      'not_normative_complete',true,
      'manufacturer_certified_scope',true,
      'astm_pairing_is_not_global_equivalence',true,
      'microblock','SK4.4d'
    )
  ),
  (
    'a5440000-0000-4000-8000-000000000323','ASME','SA-53 Gr B',null,
    'carbon_steel_pipe',7850,
    'ASME SA-53 Grade B manufacturer-certified identity.',
    'a5440000-0000-4000-8000-000000000007',
    jsonb_build_object('certificate_page',2,'row',18),
    jsonb_build_object(
      'not_normative_complete',true,
      'manufacturer_certified_scope',true,
      'astm_pairing_is_not_global_equivalence',true,
      'microblock','SK4.4d'
    )
  )
on conflict do nothing;

insert into public.steel_standard_grade_applicability (
  standard_id,material_grade_id,product_family,manufacturing_process,
  applicability_type,notes,knowledge_source_id,source_locator,metadata
) values
  (
    'a5440000-0000-4000-8000-000000000105',
    'a5440000-0000-4000-8000-000000000321',
    'round_tube','seamless','manufacturer_range',
    'Tenaris/TUV certified manufacturer scope; not a normative-complete ASME grade table.',
    'a5440000-0000-4000-8000-000000000007',
    jsonb_build_object('certificate_page',2,'row',16),
    jsonb_build_object('not_normative_complete',true,'microblock','SK4.4d')
  ),
  (
    'a5440000-0000-4000-8000-000000000105',
    'a5440000-0000-4000-8000-000000000322',
    'round_tube','seamless','manufacturer_range',
    'Tenaris/TUV certified manufacturer scope; not a normative-complete ASME grade table.',
    'a5440000-0000-4000-8000-000000000007',
    jsonb_build_object('certificate_page',2,'row',16),
    jsonb_build_object('not_normative_complete',true,'microblock','SK4.4d')
  ),
  (
    'a5440000-0000-4000-8000-000000000106',
    'a5440000-0000-4000-8000-000000000323',
    'round_tube','seamless','manufacturer_range',
    'Tenaris/TUV certified manufacturer scope; not a normative-complete ASME grade table.',
    'a5440000-0000-4000-8000-000000000007',
    jsonb_build_object('certificate_page',2,'row',18),
    jsonb_build_object('not_normative_complete',true,'microblock','SK4.4d')
  )
on conflict do nothing;

-- Manufacturer-certified ASTM/ASME pairing only.
-- This deliberately uses supplier_cross_reference, never normative_equivalent.
insert into public.steel_grade_cross_references (
  from_material_grade_id,to_material_grade_id,relation_type,evidence_class,
  notes,knowledge_source_id,source_locator,metadata
)
select
  astm.id,
  asme.id,
  'supplier_cross_reference',
  'manufacturer_reference',
  'Tenaris/TUV manufacturer scope lists the ASTM and ASME specification pair for this grade. This does not establish general normative equivalence or authorize substitution.',
  'a5440000-0000-4000-8000-000000000007'::uuid,
  jsonb_build_object('certificate_page',2),
  jsonb_build_object(
    'normative_substitution_allowed',false,
    'manufacturer_scope_only',true,
    'microblock','SK4.4d'
  )
from public.steel_material_grades astm
join public.steel_material_grades asme
  on (
    (astm.designation_key=public.canonical_steel_token('A106 Gr B')
      and asme.designation_key=public.canonical_steel_token('SA-106 Gr B'))
    or
    (astm.designation_key=public.canonical_steel_token('A106 Gr C')
      and asme.designation_key=public.canonical_steel_token('SA-106 Gr C'))
    or
    (astm.designation_key=public.canonical_steel_token('A53 Gr B')
      and asme.designation_key=public.canonical_steel_token('SA-53 Gr B'))
  )
where astm.standard_system_key=public.canonical_steel_token('ASTM')
  and asme.standard_system_key=public.canonical_steel_token('ASME')
on conflict do nothing;

-- Add DN to the existing NPS designation rows from SK4.4b/c using a separate,
-- explicit Victaulic designation source. Weight/source evidence is untouched.
update public.steel_dimension_designations dd
set
  dn = case dd.nps
    when 6 then 150
    when 8 then 200
    when 10 then 250
    when 12 then 300
    else dd.dn
  end,
  metadata = coalesce(dd.metadata,'{}'::jsonb) || jsonb_build_object(
    'dn_mapping_source_key','primary:victaulic:17.09-nps-dn-map-2026',
    'dn_mapping_source_uri','https://assets.victaulic.com/assets/uploads/literature/17.09.pdf',
    'dn_mapping_source_scope','manufacturer_designation_mapping',
    'dn_mapping_not_normative_equivalence',true,
    'dn_mapping_verified_on','2026-09-20'
  )
where dd.dimensional_system_id='a5440000-0000-4000-8000-000000000201'::uuid
  and dd.nps in (6,8,10,12)
  and dd.dn is null
  and dd.metadata->>'microblock' in ('SK4.4b','SK4.4c');

-- Preserve explicit source metadata on the dimensional-system identity.
update public.steel_dimensional_systems
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
  'dn_mapping_source_key','primary:victaulic:17.09-nps-dn-map-2026',
  'dn_mapping_scope_nps',jsonb_build_array(6,8,10,12),
  'dn_mapping_values',jsonb_build_object(
    '6',150,'8',200,'10',250,'12',300
  ),
  'dn_mapping_not_normative_complete',true,
  'microblock_dn_mapping','SK4.4d'
)
where id='a5440000-0000-4000-8000-000000000201'::uuid;
