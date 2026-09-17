-- P1.15 / SK3 — First controlled Shared Steel Knowledge seed.
--
-- This seed deliberately separates:
--   1) official standard metadata/status provenance (UNI), from
--   2) a public manufacturer's commercial dimensional range (Metalcondotte).
--
-- IMPORTANT: manufacturer rows below are NOT asserted to be the complete normative
-- dimensional table of EN 10224. They exist to validate the end-to-end shared
-- reference workflow with explicit provenance.

insert into public.knowledge_sources (
  id,
  owner_id,
  access_scope,
  source_key,
  source_type,
  source_class,
  name,
  provider,
  source_uri,
  country_code,
  language_code,
  license_name,
  trust_score,
  metadata,
  organization_id
) values
  (
    '10224000-0000-4000-8000-000000000001'::uuid,
    null,
    'global',
    'official:uni:en-10224:2006',
    'standards_registry',
    'official',
    'UNI EN 10224:2006 — official metadata',
    'UNI — Ente Italiano di Normazione',
    'https://store.uni.com/uni-en-10224-2006',
    'IT',
    'it',
    null,
    1.00,
    jsonb_build_object(
      'reference_purpose', 'standard_metadata_status_scope_only',
      'reuse_basis', 'public_metadata_reference_only',
      'content_policy', 'no_normative_full_text_or_paid_tables_redistributed',
      'national_adoption', 'UNI EN 10224:2006',
      'european_basis', 'EN 10224:2002 + A1:2005',
      'verified_on', '2026-09-17'
    ),
    null
  ),
  (
    '10224000-0000-4000-8000-000000000002'::uuid,
    null,
    'global',
    'primary:metalcondotte:uni-en-10224-product-range',
    'manufacturer_product_page',
    'primary',
    'Metalcondotte — Tubi per condotte acqua UNI EN 10224',
    'Metalcondotte',
    'https://www.metalcondotte.it/prodotti/tubi-per-condotte-acqua-e-gas/tubi-per-condotte-acqua-uni-en-10224-1',
    'IT',
    'it',
    null,
    0.85,
    jsonb_build_object(
      'reference_purpose', 'manufacturer_commercial_dimensional_range',
      'reuse_basis', 'public_product_page_factual_subset',
      'dataset_scope', 'manufacturer_product_range',
      'not_normative_complete', true,
      'verified_on', '2026-09-17'
    ),
    null
  )
on conflict do nothing;

insert into public.steel_standards (
  id,
  code,
  title,
  short_explanation,
  scope_summary,
  issuing_body,
  edition,
  valid_from,
  status,
  knowledge_source_id,
  source_locator,
  metadata
) values (
  '10224000-0000-4000-8000-000000000100'::uuid,
  'EN 10224',
  'Tubi e raccordi di acciaio non legato per il trasporto di acqua e altri liquidi acquosi',
  'Norma di riferimento per tubi e raccordi in acciaio non legato destinati al trasporto di acqua e altri liquidi acquosi, inclusa l’acqua per consumo umano.',
  'Comprende requisiti tecnici per tubi senza saldatura e saldati, preparazione delle estremità e raccordi. La pagina UNI della versione italiana indica un campo dimensionale da 26,9 mm a 2 743 mm.',
  'CEN; national adoption referenced via UNI',
  'EN 10224:2002 + A1:2005 / UNI EN 10224:2006',
  '2006-03-23',
  'active',
  '10224000-0000-4000-8000-000000000001'::uuid,
  jsonb_build_object('page', 'UNI EN 10224:2006 product metadata'),
  jsonb_build_object(
    'canonical_scope', 'european_standard',
    'national_adoption', 'UNI EN 10224:2006',
    'official_status_at_verification', 'IN VIGORE',
    'verified_on', '2026-09-17',
    'copyright_rule', 'summary_and_metadata_only'
  )
)
on conflict do nothing;

insert into public.steel_standard_product_families (
  standard_id,
  product_family,
  notes,
  metadata
) values (
  '10224000-0000-4000-8000-000000000100'::uuid,
  'round_tube',
  'Initial MVP family. Additional shapes/products require separate validated modelling.',
  jsonb_build_object('seed_contract', 'p1.15-sk3-v1')
)
on conflict do nothing;

-- Controlled manufacturer-range subset used only to prove the reference workflow.
-- theoretical_weight_kg_m refers to Metalcondotte's published black-tube weight.
insert into public.steel_dimensional_rows (
  id,
  standard_id,
  product_family,
  outer_diameter_mm,
  thickness_mm,
  theoretical_weight_kg_m,
  weight_method,
  knowledge_source_id,
  source_locator,
  metadata
) values
  (
    '10224000-0000-4000-8000-000000000301'::uuid,
    '10224000-0000-4000-8000-000000000100'::uuid,
    'round_tube',
    323.9,
    5.9,
    46.3,
    'published',
    '10224000-0000-4000-8000-000000000002'::uuid,
    jsonb_build_object('section', 'GAMMA DIMENSIONALE', 'dn_mm', 300),
    jsonb_build_object(
      'dataset_scope', 'manufacturer_product_range',
      'manufacturer', 'Metalcondotte',
      'not_normative_complete', true,
      'dn_mm', 300,
      'coated_weight_kg_m', 48.8,
      'joint_type', 'sferico'
    )
  ),
  (
    '10224000-0000-4000-8000-000000000302'::uuid,
    '10224000-0000-4000-8000-000000000100'::uuid,
    'round_tube',
    355.6,
    6.3,
    54.3,
    'published',
    '10224000-0000-4000-8000-000000000002'::uuid,
    jsonb_build_object('section', 'GAMMA DIMENSIONALE', 'dn_mm', 350),
    jsonb_build_object(
      'dataset_scope', 'manufacturer_product_range',
      'manufacturer', 'Metalcondotte',
      'not_normative_complete', true,
      'dn_mm', 350,
      'coated_weight_kg_m', 57.3,
      'joint_type', 'sferico'
    )
  ),
  (
    '10224000-0000-4000-8000-000000000303'::uuid,
    '10224000-0000-4000-8000-000000000100'::uuid,
    'round_tube',
    406.4,
    6.3,
    62.2,
    'published',
    '10224000-0000-4000-8000-000000000002'::uuid,
    jsonb_build_object('section', 'GAMMA DIMENSIONALE', 'dn_mm', 400),
    jsonb_build_object(
      'dataset_scope', 'manufacturer_product_range',
      'manufacturer', 'Metalcondotte',
      'not_normative_complete', true,
      'dn_mm', 400,
      'coated_weight_kg_m', 65.6,
      'joint_type', 'sferico'
    )
  )
on conflict do nothing;
