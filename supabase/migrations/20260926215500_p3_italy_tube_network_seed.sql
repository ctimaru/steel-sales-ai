-- P3.1 — Italy Tube Network Seed & Claimable Directory
-- Curated first production cohort sourced from public web evidence.
-- Published != verified. All seeded profiles remain unclaimed + unverified.

insert into public.network_seed_batches (
  id, batch_key, description, source_policy, seed_status
)
values (
  '50000000-0000-5000-8000-000000000002'::uuid,
  'p3-1-italy-tube-public-web-2026-09-26',
  'P3.1 Italy tube-network seed: first claimable producer, distributor, stockholder and tube-processing profiles.',
  'Prefer official company-controlled sources. Current public registry/secondary sources may support legal identity only. No tenant-private Commercial Memory and no personal contacts are imported. Published profiles remain unverified until an explicit platform verification. Claim and verification remain separate.',
  'applied'
);

-- Existing M5 identities become useful Network profiles only after P3.1 gives them
-- explicit market-role/product evidence.
update public.network_companies
set
  publication_status = 'published',
  claimed_status = 'unclaimed',
  verification_status = 'unverified',
  description = case id
    when '51000000-0000-5000-8000-000000000001'::uuid
      then 'Italian steel company with a dedicated welded-tube division within Marcegaglia Carbon Steel.'
    when '51000000-0000-5000-8000-000000000002'::uuid
      then 'Italian stainless-steel producer with welded stainless tube production.'
    when '51000000-0000-5000-8000-000000000003'::uuid
      then 'Italian seamless steel pipe manufacturing company within the Tenaris industrial system.'
    else description
  end
where id in (
  '51000000-0000-5000-8000-000000000001'::uuid,
  '51000000-0000-5000-8000-000000000002'::uuid,
  '51000000-0000-5000-8000-000000000003'::uuid
);

insert into public.network_companies (
  id, legal_name, country_code, vat_id,
  website_url, website_domain, description,
  publication_status, claimed_status, verification_status
)
values
(
  '51100000-0000-5000-8000-000000000001'::uuid,
  'Acciaitubi S.p.A. a socio unico',
  'IT',
  '00799590153',
  'https://acciaitubi.it/',
  'acciaitubi.it',
  'Italian producer of welded steel tubes for industrial, construction, plant and infrastructure applications.',
  'published','unclaimed','unverified'
),
(
  '51100000-0000-5000-8000-000000000002'::uuid,
  'Alessio Tubi S.p.A.',
  'IT',
  '00504870015',
  'https://alessiotubi.it/it/',
  'alessiotubi.it',
  'Italian producer of welded round, square and rectangular steel tubes for pressure, structural, water, oil & gas and industrial applications.',
  'published','unclaimed','unverified'
),
(
  '51100000-0000-5000-8000-000000000003'::uuid,
  'Padana Tubi e Profilati Acciaio S.p.A.',
  'IT',
  '00323370353',
  'https://www.padanatubi.it/',
  'padanatubi.it',
  'Italian producer of carbon and stainless welded tubes, structural hollow sections and related steel products.',
  'published','unclaimed','unverified'
),
(
  '51100000-0000-5000-8000-000000000004'::uuid,
  'Generaltubi S.p.A.',
  'IT',
  '04746610015',
  'https://www.generaltubi.com/',
  'generaltubi.com',
  'Italian steel-tube distributor and producer of cold-drawn precision welded and seamless tubes.',
  'published','unclaimed','unverified'
),
(
  '51100000-0000-5000-8000-000000000005'::uuid,
  'Morandi S.p.A.',
  'IT',
  '01213810177',
  'https://www.morandispa.it/',
  'morandispa.it',
  'Italian distributor and service center for carbon-steel structural tubes with stockholding, logistics and custom tube processing.',
  'published','unclaimed','unverified'
),
(
  '51100000-0000-5000-8000-000000000006'::uuid,
  'Copromet S.r.l.',
  'IT',
  '13167660961',
  'https://www.copromet.it/',
  'copromet.it',
  'Italian stockholder and distributor of welded and seamless carbon-steel tubes, including heavy-wall products.',
  'published','unclaimed','unverified'
),
(
  '51100000-0000-5000-8000-000000000007'::uuid,
  'ILT PROCESS TUBE S.r.l.',
  'IT',
  '01920740501',
  'https://www.iltsrl.it/',
  'iltsrl.it',
  'Italian tube-processing and fabrication company focused on tube and sheet processing, welding, bending, carpentry and prototyping.',
  'published','unclaimed','unverified'
);

-- One accepted evidence snapshot per profile. The snapshot backs the role/subtype/product
-- assignments below while preserving the source URL and seed batch.
insert into public.network_data_assertions (
  id, entity_type, entity_id, field_path, asserted_value,
  source_type, source_reference, ownership_type,
  asserted_by, confidence, review_state, seed_batch_id
)
values
(
  '53000000-0000-5000-8000-000000000001'::uuid,
  'company','51000000-0000-5000-8000-000000000001'::uuid,
  'p3_1_profile_snapshot',
  '{"roles":["producer"],"subtypes":["tube_pipe_producer"],"products":[{"key":"tubes_pipes","relationship":"produces"},{"key":"hollow_sections","relationship":"produces"}]}'::jsonb,
  'imported_seed','https://www.marcegaglia.com/officialwebsite/about/',
  'platform_curated',null,0.9500,'accepted',
  '50000000-0000-5000-8000-000000000002'::uuid
),
(
  '53000000-0000-5000-8000-000000000002'::uuid,
  'company','51000000-0000-5000-8000-000000000002'::uuid,
  'p3_1_profile_snapshot',
  '{"roles":["producer"],"subtypes":["tube_pipe_producer","stainless_producer"],"products":[{"key":"tubes_pipes","relationship":"produces"},{"key":"hollow_sections","relationship":"produces"}]}'::jsonb,
  'imported_seed','https://specialties.marcegaglia.com/it/tubi-saldati-in-acciaio-inossidabile/',
  'platform_curated',null,0.9800,'accepted',
  '50000000-0000-5000-8000-000000000002'::uuid
),
(
  '53000000-0000-5000-8000-000000000003'::uuid,
  'company','51000000-0000-5000-8000-000000000003'::uuid,
  'p3_1_profile_snapshot',
  '{"roles":["producer"],"subtypes":["tube_pipe_producer"],"products":[{"key":"tubes_pipes","relationship":"produces"}]}'::jsonb,
  'imported_seed','https://www.tenaris.com/en/about-us',
  'platform_curated',null,0.9500,'accepted',
  '50000000-0000-5000-8000-000000000002'::uuid
),
(
  '53000000-0000-5000-8000-000000000011'::uuid,
  'company','51100000-0000-5000-8000-000000000001'::uuid,
  'p3_1_profile_snapshot',
  '{"roles":["producer"],"subtypes":["tube_pipe_producer"],"products":[{"key":"tubes_pipes","relationship":"produces"}]}'::jsonb,
  'imported_seed','https://acciaitubi.it/',
  'platform_curated',null,0.9900,'accepted',
  '50000000-0000-5000-8000-000000000002'::uuid
),
(
  '53000000-0000-5000-8000-000000000012'::uuid,
  'company','51100000-0000-5000-8000-000000000002'::uuid,
  'p3_1_profile_snapshot',
  '{"roles":["producer"],"subtypes":["tube_pipe_producer"],"products":[{"key":"tubes_pipes","relationship":"produces"},{"key":"hollow_sections","relationship":"produces"}]}'::jsonb,
  'imported_seed','https://alessiotubi.it/it/',
  'platform_curated',null,0.9500,'accepted',
  '50000000-0000-5000-8000-000000000002'::uuid
),
(
  '53000000-0000-5000-8000-000000000013'::uuid,
  'company','51100000-0000-5000-8000-000000000003'::uuid,
  'p3_1_profile_snapshot',
  '{"roles":["producer"],"subtypes":["tube_pipe_producer"],"products":[{"key":"tubes_pipes","relationship":"produces"},{"key":"hollow_sections","relationship":"produces"}]}'::jsonb,
  'imported_seed','https://www.padanatubi.it/',
  'platform_curated',null,0.9900,'accepted',
  '50000000-0000-5000-8000-000000000002'::uuid
),
(
  '53000000-0000-5000-8000-000000000014'::uuid,
  'company','51100000-0000-5000-8000-000000000004'::uuid,
  'p3_1_profile_snapshot',
  '{"roles":["trader_distributor","producer"],"subtypes":["distributor","tube_pipe_producer"],"products":[{"key":"tubes_pipes","relationship":"distributes"},{"key":"tubes_pipes","relationship":"produces"},{"key":"hollow_sections","relationship":"distributes"}]}'::jsonb,
  'imported_seed','https://www.generaltubi.com/',
  'platform_curated',null,0.9900,'accepted',
  '50000000-0000-5000-8000-000000000002'::uuid
),
(
  '53000000-0000-5000-8000-000000000015'::uuid,
  'company','51100000-0000-5000-8000-000000000005'::uuid,
  'p3_1_profile_snapshot',
  '{"roles":["trader_distributor","processor_service_provider"],"subtypes":["stockholder","steel_service_center","cutting_specialist"],"products":[{"key":"tubes_pipes","relationship":"stocks"},{"key":"tubes_pipes","relationship":"distributes"},{"key":"tubes_pipes","relationship":"processes"},{"key":"hollow_sections","relationship":"stocks"},{"key":"hollow_sections","relationship":"distributes"},{"key":"hollow_sections","relationship":"processes"}]}'::jsonb,
  'imported_seed','https://www.morandispa.it/azienda/chi-siamo/',
  'platform_curated',null,0.9900,'accepted',
  '50000000-0000-5000-8000-000000000002'::uuid
),
(
  '53000000-0000-5000-8000-000000000016'::uuid,
  'company','51100000-0000-5000-8000-000000000006'::uuid,
  'p3_1_profile_snapshot',
  '{"roles":["trader_distributor"],"subtypes":["stockholder","distributor"],"products":[{"key":"tubes_pipes","relationship":"stocks"},{"key":"tubes_pipes","relationship":"distributes"}]}'::jsonb,
  'imported_seed','https://www.copromet.it/',
  'platform_curated',null,0.9900,'accepted',
  '50000000-0000-5000-8000-000000000002'::uuid
),
(
  '53000000-0000-5000-8000-000000000017'::uuid,
  'company','51100000-0000-5000-8000-000000000007'::uuid,
  'p3_1_profile_snapshot',
  '{"roles":["processor_service_provider"],"subtypes":["fabricator","cutting_specialist"],"products":[{"key":"tubes_pipes","relationship":"processes"}]}'::jsonb,
  'imported_seed','https://www.iltsrl.it/about/',
  'platform_curated',null,0.9900,'accepted',
  '50000000-0000-5000-8000-000000000002'::uuid
);

with role_seed(company_id, assertion_id, role_key, is_primary) as (
  values
  ('51000000-0000-5000-8000-000000000001'::uuid,'53000000-0000-5000-8000-000000000001'::uuid,'producer',true),
  ('51000000-0000-5000-8000-000000000002'::uuid,'53000000-0000-5000-8000-000000000002'::uuid,'producer',true),
  ('51000000-0000-5000-8000-000000000003'::uuid,'53000000-0000-5000-8000-000000000003'::uuid,'producer',true),
  ('51100000-0000-5000-8000-000000000001'::uuid,'53000000-0000-5000-8000-000000000011'::uuid,'producer',true),
  ('51100000-0000-5000-8000-000000000002'::uuid,'53000000-0000-5000-8000-000000000012'::uuid,'producer',true),
  ('51100000-0000-5000-8000-000000000003'::uuid,'53000000-0000-5000-8000-000000000013'::uuid,'producer',true),
  ('51100000-0000-5000-8000-000000000004'::uuid,'53000000-0000-5000-8000-000000000014'::uuid,'trader_distributor',true),
  ('51100000-0000-5000-8000-000000000004'::uuid,'53000000-0000-5000-8000-000000000014'::uuid,'producer',false),
  ('51100000-0000-5000-8000-000000000005'::uuid,'53000000-0000-5000-8000-000000000015'::uuid,'trader_distributor',true),
  ('51100000-0000-5000-8000-000000000005'::uuid,'53000000-0000-5000-8000-000000000015'::uuid,'processor_service_provider',false),
  ('51100000-0000-5000-8000-000000000006'::uuid,'53000000-0000-5000-8000-000000000016'::uuid,'trader_distributor',true),
  ('51100000-0000-5000-8000-000000000007'::uuid,'53000000-0000-5000-8000-000000000017'::uuid,'processor_service_provider',true)
)
insert into public.network_company_role_assignments (
  company_id, role_id, is_primary, source_assertion_id
)
select s.company_id,r.id,s.is_primary,s.assertion_id
from role_seed s
join public.network_company_roles r on r.canonical_key=s.role_key
on conflict (company_id,role_id)
do update set
  is_primary=excluded.is_primary,
  source_assertion_id=excluded.source_assertion_id;

with subtype_seed(company_id, assertion_id, subtype_key) as (
  values
  ('51000000-0000-5000-8000-000000000001'::uuid,'53000000-0000-5000-8000-000000000001'::uuid,'tube_pipe_producer'),
  ('51000000-0000-5000-8000-000000000002'::uuid,'53000000-0000-5000-8000-000000000002'::uuid,'tube_pipe_producer'),
  ('51000000-0000-5000-8000-000000000002'::uuid,'53000000-0000-5000-8000-000000000002'::uuid,'stainless_producer'),
  ('51000000-0000-5000-8000-000000000003'::uuid,'53000000-0000-5000-8000-000000000003'::uuid,'tube_pipe_producer'),
  ('51100000-0000-5000-8000-000000000001'::uuid,'53000000-0000-5000-8000-000000000011'::uuid,'tube_pipe_producer'),
  ('51100000-0000-5000-8000-000000000002'::uuid,'53000000-0000-5000-8000-000000000012'::uuid,'tube_pipe_producer'),
  ('51100000-0000-5000-8000-000000000003'::uuid,'53000000-0000-5000-8000-000000000013'::uuid,'tube_pipe_producer'),
  ('51100000-0000-5000-8000-000000000004'::uuid,'53000000-0000-5000-8000-000000000014'::uuid,'distributor'),
  ('51100000-0000-5000-8000-000000000004'::uuid,'53000000-0000-5000-8000-000000000014'::uuid,'tube_pipe_producer'),
  ('51100000-0000-5000-8000-000000000005'::uuid,'53000000-0000-5000-8000-000000000015'::uuid,'stockholder'),
  ('51100000-0000-5000-8000-000000000005'::uuid,'53000000-0000-5000-8000-000000000015'::uuid,'steel_service_center'),
  ('51100000-0000-5000-8000-000000000005'::uuid,'53000000-0000-5000-8000-000000000015'::uuid,'cutting_specialist'),
  ('51100000-0000-5000-8000-000000000006'::uuid,'53000000-0000-5000-8000-000000000016'::uuid,'stockholder'),
  ('51100000-0000-5000-8000-000000000006'::uuid,'53000000-0000-5000-8000-000000000016'::uuid,'distributor'),
  ('51100000-0000-5000-8000-000000000007'::uuid,'53000000-0000-5000-8000-000000000017'::uuid,'fabricator'),
  ('51100000-0000-5000-8000-000000000007'::uuid,'53000000-0000-5000-8000-000000000017'::uuid,'cutting_specialist')
)
insert into public.network_company_subtype_assignments (
  company_id, subtype_id, source_assertion_id
)
select s.company_id,st.id,s.assertion_id
from subtype_seed s
join public.network_company_subtypes st on st.canonical_key=s.subtype_key
on conflict (company_id,subtype_id)
do update set source_assertion_id=excluded.source_assertion_id;

with product_seed(company_id, assertion_id, product_key, relationship_type) as (
  values
  ('51000000-0000-5000-8000-000000000001'::uuid,'53000000-0000-5000-8000-000000000001'::uuid,'tubes_pipes','produces'),
  ('51000000-0000-5000-8000-000000000001'::uuid,'53000000-0000-5000-8000-000000000001'::uuid,'hollow_sections','produces'),
  ('51000000-0000-5000-8000-000000000002'::uuid,'53000000-0000-5000-8000-000000000002'::uuid,'tubes_pipes','produces'),
  ('51000000-0000-5000-8000-000000000002'::uuid,'53000000-0000-5000-8000-000000000002'::uuid,'hollow_sections','produces'),
  ('51000000-0000-5000-8000-000000000003'::uuid,'53000000-0000-5000-8000-000000000003'::uuid,'tubes_pipes','produces'),
  ('51100000-0000-5000-8000-000000000001'::uuid,'53000000-0000-5000-8000-000000000011'::uuid,'tubes_pipes','produces'),
  ('51100000-0000-5000-8000-000000000002'::uuid,'53000000-0000-5000-8000-000000000012'::uuid,'tubes_pipes','produces'),
  ('51100000-0000-5000-8000-000000000002'::uuid,'53000000-0000-5000-8000-000000000012'::uuid,'hollow_sections','produces'),
  ('51100000-0000-5000-8000-000000000003'::uuid,'53000000-0000-5000-8000-000000000013'::uuid,'tubes_pipes','produces'),
  ('51100000-0000-5000-8000-000000000003'::uuid,'53000000-0000-5000-8000-000000000013'::uuid,'hollow_sections','produces'),
  ('51100000-0000-5000-8000-000000000004'::uuid,'53000000-0000-5000-8000-000000000014'::uuid,'tubes_pipes','distributes'),
  ('51100000-0000-5000-8000-000000000004'::uuid,'53000000-0000-5000-8000-000000000014'::uuid,'tubes_pipes','produces'),
  ('51100000-0000-5000-8000-000000000004'::uuid,'53000000-0000-5000-8000-000000000014'::uuid,'hollow_sections','distributes'),
  ('51100000-0000-5000-8000-000000000005'::uuid,'53000000-0000-5000-8000-000000000015'::uuid,'tubes_pipes','stocks'),
  ('51100000-0000-5000-8000-000000000005'::uuid,'53000000-0000-5000-8000-000000000015'::uuid,'tubes_pipes','distributes'),
  ('51100000-0000-5000-8000-000000000005'::uuid,'53000000-0000-5000-8000-000000000015'::uuid,'tubes_pipes','processes'),
  ('51100000-0000-5000-8000-000000000005'::uuid,'53000000-0000-5000-8000-000000000015'::uuid,'hollow_sections','stocks'),
  ('51100000-0000-5000-8000-000000000005'::uuid,'53000000-0000-5000-8000-000000000015'::uuid,'hollow_sections','distributes'),
  ('51100000-0000-5000-8000-000000000005'::uuid,'53000000-0000-5000-8000-000000000015'::uuid,'hollow_sections','processes'),
  ('51100000-0000-5000-8000-000000000006'::uuid,'53000000-0000-5000-8000-000000000016'::uuid,'tubes_pipes','stocks'),
  ('51100000-0000-5000-8000-000000000006'::uuid,'53000000-0000-5000-8000-000000000016'::uuid,'tubes_pipes','distributes'),
  ('51100000-0000-5000-8000-000000000007'::uuid,'53000000-0000-5000-8000-000000000017'::uuid,'tubes_pipes','processes')
)
insert into public.network_company_products (
  company_id, product_family_id, relationship_type, source_assertion_id
)
select s.company_id,p.id,s.relationship_type,s.assertion_id
from product_seed s
join public.network_product_families p on p.canonical_key=s.product_key
on conflict (company_id,product_family_id,relationship_type)
where facility_id is null
do update set source_assertion_id=excluded.source_assertion_id;

comment on table public.network_seed_batches is
  'Controlled Network seed batches. P3.1 introduces curated public-web company population; seed acceptance never implies verification.';
