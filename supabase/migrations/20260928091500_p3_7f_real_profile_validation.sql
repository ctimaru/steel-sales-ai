-- P3.7F — Real Profile Validation & Commercial UX Polish
-- Curated public-web facts for three representative Italian tube-market companies.
-- Governance: public facts remain platform_curated + unverified. No company claim is created.

-- Company-level public-web assertions and commercial summaries.
insert into public.network_data_assertions(
  id,entity_type,entity_id,field_path,asserted_value,
  source_type,source_reference,ownership_type,confidence,review_state
) values
(
  '37f10000-0000-4000-8000-000000000101',
  'company','51100000-0000-5000-8000-000000000001',
  'p3_7f_real_profile_validation',
  jsonb_build_object(
    'trading_name','Acciaitubi',
    'description','Produttore italiano di tubi in acciaio saldati e senza saldatura per applicazioni industriali, impiantistiche e strutturali, con produzione, finiture e controllo qualità integrati.',
    'source_urls',jsonb_build_array(
      'https://acciaitubi.it/',
      'https://acciaitubi.it/chi-siamo/qualita/',
      'https://acciaitubi.it/applicazioni/'
    )
  ),
  'public_web','https://acciaitubi.it/','platform_curated',0.99,'accepted'
),
(
  '37f10000-0000-4000-8000-000000000102',
  'company','51100000-0000-5000-8000-000000000005',
  'p3_7f_real_profile_validation',
  jsonb_build_object(
    'trading_name','Morandi Steel',
    'description','Distributore e centro servizi specializzato in tubi strutturali in acciaio al carbonio, con stock, taglio a misura, lavorazioni laser 3D e servizi su commessa.',
    'source_urls',jsonb_build_array(
      'https://www.morandispa.it/azienda/chi-siamo/',
      'https://www.morandispa.it/servizi/',
      'https://www.morandispa.it/prodotti/'
    )
  ),
  'public_web','https://www.morandispa.it/azienda/chi-siamo/','platform_curated',0.99,'accepted'
),
(
  '37f10000-0000-4000-8000-000000000103',
  'company','51100000-0000-5000-8000-000000000006',
  'p3_7f_real_profile_validation',
  jsonb_build_object(
    'trading_name','COPROMET',
    'description','Stockholder e distributore italiano di tubi in acciaio al carbonio saldati e senza saldatura, con oltre 16.000 tonnellate di stock e gamma da 21,3 a 1.560 mm di diametro.',
    'source_urls',jsonb_build_array(
      'https://www.copromet.it/',
      'https://www.copromet.it/servizi.php'
    )
  ),
  'public_web','https://www.copromet.it/','platform_curated',0.99,'accepted'
)
on conflict (id) do nothing;

update public.network_companies
set trading_name='Acciaitubi',
    description='Produttore italiano di tubi in acciaio saldati e senza saldatura per applicazioni industriali, impiantistiche e strutturali, con produzione, finiture e controllo qualità integrati.'
where id='51100000-0000-5000-8000-000000000001';

update public.network_companies
set trading_name='Morandi Steel',
    description='Distributore e centro servizi specializzato in tubi strutturali in acciaio al carbonio, con stock, taglio a misura, lavorazioni laser 3D e servizi su commessa.'
where id='51100000-0000-5000-8000-000000000005';

update public.network_companies
set trading_name='COPROMET',
    description='Stockholder e distributore italiano di tubi in acciaio al carbonio saldati e senza saldatura, con oltre 16.000 tonnellate di stock e gamma da 21,3 a 1.560 mm di diametro.'
where id='51100000-0000-5000-8000-000000000006';

-- Facilities.
insert into public.network_data_assertions(
  id,entity_type,entity_id,field_path,asserted_value,
  source_type,source_reference,ownership_type,confidence,review_state
) values
(
  '37f10000-0000-4000-8000-000000000111',
  'facility','37f10000-0000-4000-8000-000000000201',
  'p3_7f_public_web_location',
  jsonb_build_object(
    'name','Direzione e stabilimento — Terno d''Isola',
    'address_line_1','Via Valtrighe 2',
    'postal_code','24030',
    'city','Terno d''Isola',
    'region','Lombardia',
    'country_code','IT'
  ),
  'public_web','https://acciaitubi.it/chi-siamo/qualita/','platform_curated',0.99,'accepted'
),
(
  '37f10000-0000-4000-8000-000000000112',
  'facility','37f10000-0000-4000-8000-000000000202',
  'p3_7f_public_web_location',
  jsonb_build_object(
    'name','Sede e centro servizi — Flero',
    'address_line_1','Via Don Lorenzo Milani, 3',
    'postal_code','25020',
    'city','Flero',
    'region','Lombardia',
    'country_code','IT'
  ),
  'public_web','https://www.morandispa.it/contattaci/','platform_curated',0.99,'accepted'
),
(
  '37f10000-0000-4000-8000-000000000113',
  'facility','3518c835-d809-4b0e-b6d0-b6bdcfd86fbc',
  'p3_7f_public_web_location',
  jsonb_build_object(
    'name','Sede e magazzino — Fiorenzuola d''Arda',
    'address_line_1','Via Paullo Barabasca, 489/b',
    'postal_code','29017',
    'city','Fiorenzuola d''Arda',
    'region','Emilia-Romagna',
    'country_code','IT'
  ),
  'public_web','https://www.copromet.it/','platform_curated',0.99,'accepted'
)
on conflict (id) do nothing;

insert into public.network_facilities(
  id,company_id,name,facility_type,address_line_1,postal_code,city,region,country_code,
  website_url,publication_status,verification_status
) values
(
  '37f10000-0000-4000-8000-000000000201',
  '51100000-0000-5000-8000-000000000001',
  'Direzione e stabilimento — Terno d''Isola',
  'public_business_location','Via Valtrighe 2','24030','Terno d''Isola','Lombardia','IT',
  'https://acciaitubi.it/','published','unverified'
),
(
  '37f10000-0000-4000-8000-000000000202',
  '51100000-0000-5000-8000-000000000005',
  'Sede e centro servizi — Flero',
  'public_business_location','Via Don Lorenzo Milani, 3','25020','Flero','Lombardia','IT',
  'https://www.morandispa.it/','published','unverified'
)
on conflict (id) do update
set name=excluded.name,
    address_line_1=excluded.address_line_1,
    postal_code=excluded.postal_code,
    city=excluded.city,
    region=excluded.region,
    website_url=excluded.website_url,
    publication_status='published',
    updated_at=now();

update public.network_facilities
set name='Sede e magazzino — Fiorenzuola d''Arda',
    address_line_1='Via Paullo Barabasca, 489/b',
    postal_code='29017',
    city='Fiorenzuola d''Arda',
    region='Emilia-Romagna',
    country_code='IT',
    website_url='https://www.copromet.it/',
    publication_status='published',
    updated_at=now()
where id='3518c835-d809-4b0e-b6d0-b6bdcfd86fbc';

-- Public contacts.
insert into public.network_data_assertions(
  id,entity_type,entity_id,field_path,asserted_value,
  source_type,source_reference,ownership_type,confidence,review_state
) values
(
  '37f10000-0000-4000-8000-000000000121',
  'contact','37f10000-0000-4000-8000-000000000301',
  'p3_7f_public_contact',
  jsonb_build_object('contact_type','general','display_name','Contatti','phone','+39 035 904004'),
  'public_web','https://acciaitubi.it/','platform_curated',0.99,'accepted'
),
(
  '37f10000-0000-4000-8000-000000000122',
  'contact','37f10000-0000-4000-8000-000000000302',
  'p3_7f_public_contact',
  jsonb_build_object('contact_type','sales','display_name','Commerciale','email','commerciale@morandispa.it','phone','+39 030 2640551'),
  'public_web','https://www.morandispa.it/contattaci/','platform_curated',0.99,'accepted'
),
(
  '37f10000-0000-4000-8000-000000000123',
  'contact','37f10000-0000-4000-8000-000000000303',
  'p3_7f_public_contact',
  jsonb_build_object('contact_type','general','display_name','Contatti','email','info@copromet.it','phone','+39 0523 98 37 11'),
  'public_web','https://www.copromet.it/','platform_curated',0.99,'accepted'
)
on conflict (id) do nothing;

insert into public.network_contacts(
  id,company_id,facility_id,contact_type,display_name,email,phone,website_url,
  publication_status,consent_basis,source_reference,source_assertion_id,verification_status
) values
(
  '37f10000-0000-4000-8000-000000000301',
  '51100000-0000-5000-8000-000000000001',
  '37f10000-0000-4000-8000-000000000201',
  'general','Contatti',null,'+39 035 904004','https://acciaitubi.it/',
  'published','public_business_contact','https://acciaitubi.it/',
  '37f10000-0000-4000-8000-000000000121','unverified'
),
(
  '37f10000-0000-4000-8000-000000000302',
  '51100000-0000-5000-8000-000000000005',
  '37f10000-0000-4000-8000-000000000202',
  'sales','Commerciale','commerciale@morandispa.it','+39 030 2640551','https://www.morandispa.it/contattaci/',
  'published','public_business_contact','https://www.morandispa.it/contattaci/',
  '37f10000-0000-4000-8000-000000000122','unverified'
),
(
  '37f10000-0000-4000-8000-000000000303',
  '51100000-0000-5000-8000-000000000006',
  '3518c835-d809-4b0e-b6d0-b6bdcfd86fbc',
  'general','Contatti','info@copromet.it','+39 0523 98 37 11','https://www.copromet.it/',
  'published','public_business_contact','https://www.copromet.it/',
  '37f10000-0000-4000-8000-000000000123','unverified'
)
on conflict (id) do update
set display_name=excluded.display_name,
    email=excluded.email,
    phone=excluded.phone,
    website_url=excluded.website_url,
    publication_status='published',
    source_assertion_id=excluded.source_assertion_id,
    updated_at=now();

-- Facility capabilities.
with capability_seed(relation_id,assertion_id,facility_id,capability_key,source_url) as (
  values
    ('37f10000-0000-4000-8000-000000000401'::uuid,'37f10000-0000-4000-8000-000000000131'::uuid,'37f10000-0000-4000-8000-000000000201'::uuid,'galvanizing','https://acciaitubi.it/'),
    ('37f10000-0000-4000-8000-000000000402'::uuid,'37f10000-0000-4000-8000-000000000132'::uuid,'37f10000-0000-4000-8000-000000000201'::uuid,'painting_coating','https://acciaitubi.it/'),
    ('37f10000-0000-4000-8000-000000000403'::uuid,'37f10000-0000-4000-8000-000000000133'::uuid,'37f10000-0000-4000-8000-000000000201'::uuid,'testing_ndt','https://acciaitubi.it/chi-siamo/qualita/'),
    ('37f10000-0000-4000-8000-000000000404'::uuid,'37f10000-0000-4000-8000-000000000134'::uuid,'37f10000-0000-4000-8000-000000000202'::uuid,'stockholding','https://www.morandispa.it/servizi/'),
    ('37f10000-0000-4000-8000-000000000405'::uuid,'37f10000-0000-4000-8000-000000000135'::uuid,'37f10000-0000-4000-8000-000000000202'::uuid,'cut_to_length','https://www.morandispa.it/servizi/'),
    ('37f10000-0000-4000-8000-000000000406'::uuid,'37f10000-0000-4000-8000-000000000136'::uuid,'37f10000-0000-4000-8000-000000000202'::uuid,'laser_cutting','https://www.morandispa.it/servizi/'),
    ('37f10000-0000-4000-8000-000000000407'::uuid,'37f10000-0000-4000-8000-000000000137'::uuid,'3518c835-d809-4b0e-b6d0-b6bdcfd86fbc'::uuid,'stockholding','https://www.copromet.it/servizi.php'),
    ('37f10000-0000-4000-8000-000000000408'::uuid,'37f10000-0000-4000-8000-000000000138'::uuid,'3518c835-d809-4b0e-b6d0-b6bdcfd86fbc'::uuid,'export_capability','https://www.copromet.it/servizi.php')
),
assertions as (
  insert into public.network_data_assertions(
    id,entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,confidence,review_state
  )
  select
    s.assertion_id,'facility_capability',s.relation_id,
    'p3_7f_public_web_capability',
    jsonb_build_object('capability_key',s.capability_key),
    'public_web',s.source_url,'platform_curated',0.98,'accepted'
  from capability_seed s
  on conflict (id) do nothing
  returning id
)
insert into public.network_facility_capabilities(
  id,facility_id,capability_id,source_assertion_id,verification_status
)
select s.relation_id,s.facility_id,c.id,s.assertion_id,'unverified'
from capability_seed s
join public.network_capabilities c on c.canonical_key=s.capability_key
on conflict (facility_id,capability_id) do nothing;

-- Markets.
with market_seed(relation_id,assertion_id,company_id,market_key,source_url) as (
  values
    ('37f10000-0000-4000-8000-000000000501'::uuid,'37f10000-0000-4000-8000-000000000141'::uuid,'51100000-0000-5000-8000-000000000001'::uuid,'hvac','https://acciaitubi.it/applicazioni/'),
    ('37f10000-0000-4000-8000-000000000502'::uuid,'37f10000-0000-4000-8000-000000000142'::uuid,'51100000-0000-5000-8000-000000000001'::uuid,'construction_infrastructure','https://acciaitubi.it/applicazioni/'),
    ('37f10000-0000-4000-8000-000000000503'::uuid,'37f10000-0000-4000-8000-000000000143'::uuid,'51100000-0000-5000-8000-000000000005'::uuid,'construction_infrastructure','https://www.morandispa.it/azienda/chi-siamo/'),
    ('37f10000-0000-4000-8000-000000000504'::uuid,'37f10000-0000-4000-8000-000000000144'::uuid,'51100000-0000-5000-8000-000000000005'::uuid,'mechanical_engineering_market','https://www.morandispa.it/azienda/chi-siamo/'),
    ('37f10000-0000-4000-8000-000000000505'::uuid,'37f10000-0000-4000-8000-000000000145'::uuid,'51100000-0000-5000-8000-000000000005'::uuid,'energy','https://www.morandispa.it/azienda/chi-siamo/')
),
assertions as (
  insert into public.network_data_assertions(
    id,entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,confidence,review_state
  )
  select
    s.assertion_id,'company_market',s.relation_id,
    'p3_7f_public_web_market',
    jsonb_build_object('market_key',s.market_key),
    'public_web',s.source_url,'platform_curated',0.97,'accepted'
  from market_seed s
  on conflict (id) do nothing
  returning id
)
insert into public.network_company_markets(
  id,company_id,market_id,source_assertion_id
)
select s.relation_id,s.company_id,m.id,s.assertion_id
from market_seed s
join public.network_markets m on m.canonical_key=s.market_key
on conflict (company_id,market_id) do nothing;

-- Certifications.
with cert_seed(
  relation_id,assertion_id,company_id,facility_id,certification_key,
  issuer,scope_text,evidence_reference
) as (
  values
    ('37f10000-0000-4000-8000-000000000601'::uuid,'37f10000-0000-4000-8000-000000000151'::uuid,'51100000-0000-5000-8000-000000000001'::uuid,'37f10000-0000-4000-8000-000000000201'::uuid,'iso_9001','Kiwa Cermet Italia','Sistema di gestione per la qualità','https://acciaitubi.it/chi-siamo/qualita/'),
    ('37f10000-0000-4000-8000-000000000602'::uuid,'37f10000-0000-4000-8000-000000000152'::uuid,'51100000-0000-5000-8000-000000000001'::uuid,'37f10000-0000-4000-8000-000000000201'::uuid,'iso_14001','Kiwa Cermet Italia','Sistema di gestione ambientale','https://acciaitubi.it/chi-siamo/qualita/'),
    ('37f10000-0000-4000-8000-000000000603'::uuid,'37f10000-0000-4000-8000-000000000153'::uuid,'51100000-0000-5000-8000-000000000001'::uuid,'37f10000-0000-4000-8000-000000000201'::uuid,'iso_45001','Kiwa Cermet Italia','Sistema di gestione salute e sicurezza sul lavoro','https://acciaitubi.it/chi-siamo/qualita/'),
    ('37f10000-0000-4000-8000-000000000604'::uuid,'37f10000-0000-4000-8000-000000000154'::uuid,'51100000-0000-5000-8000-000000000005'::uuid,'37f10000-0000-4000-8000-000000000202'::uuid,'iso_9001','SQS','Commercializzazione di tubi di acciaio al carbonio','https://www.morandispa.it/certificazioni/'),
    ('37f10000-0000-4000-8000-000000000605'::uuid,'37f10000-0000-4000-8000-000000000155'::uuid,'51100000-0000-5000-8000-000000000005'::uuid,'37f10000-0000-4000-8000-000000000202'::uuid,'en_1090','RINA','Componenti strutturali in acciaio; tubi strutturali tagliati a misura','https://www.morandispa.it/certificazioni/')
),
assertions as (
  insert into public.network_data_assertions(
    id,entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,confidence,review_state
  )
  select
    s.assertion_id,'company_certification',s.relation_id,
    'p3_7f_public_web_certification',
    jsonb_build_object(
      'certification_key',s.certification_key,
      'issuer',s.issuer,
      'scope_text',s.scope_text
    ),
    'public_web',s.evidence_reference,'platform_curated',0.98,'accepted'
  from cert_seed s
  on conflict (id) do nothing
  returning id
)
insert into public.network_company_certifications(
  id,company_id,facility_id,certification_type_id,issuer,scope_text,
  verification_status,evidence_reference,source_assertion_id
)
select
  s.relation_id,s.company_id,s.facility_id,ct.id,s.issuer,s.scope_text,
  'unverified',s.evidence_reference,s.assertion_id
from cert_seed s
join public.network_certification_types ct on ct.canonical_key=s.certification_key
on conflict (id) do nothing;

-- Technical scope: standards.
with standard_seed(scope_id,assertion_id,company_product_id,standard_code,source_url) as (
  values
    ('37f10000-0000-4000-8000-000000000701'::uuid,'37f10000-0000-4000-8000-000000000161'::uuid,'18bf74bf-f34c-4080-8e55-1f0ee2d91122'::uuid,'EN 10217-1','https://acciaitubi.it/en/tubes/welded-boiler-tubes-en-10217-1/'),
    ('37f10000-0000-4000-8000-000000000702'::uuid,'37f10000-0000-4000-8000-000000000162'::uuid,'107b4a40-d955-4a71-a87b-305eb0f954ee'::uuid,'EN 10219','https://www.morandispa.it/prodotti/tubi-per-impieghi-strutturali/'),
    ('37f10000-0000-4000-8000-000000000703'::uuid,'37f10000-0000-4000-8000-000000000163'::uuid,'107b4a40-d955-4a71-a87b-305eb0f954ee'::uuid,'EN 10210','https://www.morandispa.it/prodotti/tubi-per-impieghi-strutturali/')
),
assertions as (
  insert into public.network_data_assertions(
    id,entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,confidence,review_state
  )
  select
    s.assertion_id,'company_product',s.company_product_id,
    'p3_7f_public_web_technical_standard',
    jsonb_build_object('standard_code',s.standard_code),
    'public_web',s.source_url,'platform_curated',0.99,'accepted'
  from standard_seed s
  on conflict (id) do nothing
  returning id
)
insert into public.network_company_product_standard_scopes(
  id,company_product_id,standard_id,source_assertion_id,verification_status
)
select s.scope_id,s.company_product_id,st.id,s.assertion_id,'unverified'
from standard_seed s
join public.steel_standards st on st.code=s.standard_code
on conflict (company_product_id,standard_id) do nothing;

-- Technical scope: grades/materials.
with grade_seed(scope_id,assertion_id,company_product_id,standard_code,designation,source_url) as (
  values
    ('37f10000-0000-4000-8000-000000000801'::uuid,'37f10000-0000-4000-8000-000000000171'::uuid,'18bf74bf-f34c-4080-8e55-1f0ee2d91122'::uuid,'EN 10217-1','P235TR1','https://acciaitubi.it/en/tubes/welded-boiler-tubes-en-10217-1/'),
    ('37f10000-0000-4000-8000-000000000802'::uuid,'37f10000-0000-4000-8000-000000000172'::uuid,'107b4a40-d955-4a71-a87b-305eb0f954ee'::uuid,'EN 10219','S355J2H','https://www.morandispa.it/prodotti/tubi-per-impieghi-strutturali/'),
    ('37f10000-0000-4000-8000-000000000803'::uuid,'37f10000-0000-4000-8000-000000000173'::uuid,'107b4a40-d955-4a71-a87b-305eb0f954ee'::uuid,'EN 10210','S355J2H','https://www.morandispa.it/prodotti/tubi-per-impieghi-strutturali/')
),
assertions as (
  insert into public.network_data_assertions(
    id,entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,confidence,review_state
  )
  select
    s.assertion_id,'company_product',s.company_product_id,
    'p3_7f_public_web_technical_grade',
    jsonb_build_object('standard_code',s.standard_code,'designation',s.designation),
    'public_web',s.source_url,'platform_curated',0.99,'accepted'
  from grade_seed s
  on conflict (id) do nothing
  returning id
)
insert into public.network_company_product_grade_scopes(
  id,company_product_id,standard_id,material_grade_id,source_assertion_id,verification_status
)
select s.scope_id,s.company_product_id,st.id,mg.id,s.assertion_id,'unverified'
from grade_seed s
join public.steel_standards st on st.code=s.standard_code
join public.steel_material_grades mg on mg.designation=s.designation
on conflict (company_product_id,standard_id,material_grade_id) do nothing;

-- Technical scope: dimensional envelopes.
with dimension_seed(
  scope_id,assertion_id,company_product_id,dimension_type,min_mm,max_mm,source_url
) as (
  values
    ('37f10000-0000-4000-8000-000000000901'::uuid,'37f10000-0000-4000-8000-000000000181'::uuid,'18bf74bf-f34c-4080-8e55-1f0ee2d91122'::uuid,'outer_diameter',21.3::numeric,219.1::numeric,'https://acciaitubi.it/en/tubes/welded-boiler-tubes-en-10217-1/'),
    ('37f10000-0000-4000-8000-000000000902'::uuid,'37f10000-0000-4000-8000-000000000182'::uuid,'18bf74bf-f34c-4080-8e55-1f0ee2d91122'::uuid,'wall_thickness',1.6::numeric,6.3::numeric,'https://www.acciaitubi.it/files/pages/12/Acciaitubi-catalogo-2024-it.pdf'),
    ('37f10000-0000-4000-8000-000000000903'::uuid,'37f10000-0000-4000-8000-000000000183'::uuid,'107b4a40-d955-4a71-a87b-305eb0f954ee'::uuid,'outer_diameter',33.7::numeric,610::numeric,'https://www.morandispa.it/prodotti/tubi-per-impieghi-strutturali/strutturale-laminato-a-freddo-en-10219/'),
    ('37f10000-0000-4000-8000-000000000904'::uuid,'37f10000-0000-4000-8000-000000000184'::uuid,'107b4a40-d955-4a71-a87b-305eb0f954ee'::uuid,'width',30::numeric,500::numeric,'https://www.morandispa.it/prodotti/tubi-per-impieghi-strutturali/strutturale-laminato-a-freddo-en-10219/'),
    ('37f10000-0000-4000-8000-000000000905'::uuid,'37f10000-0000-4000-8000-000000000185'::uuid,'107b4a40-d955-4a71-a87b-305eb0f954ee'::uuid,'height',30::numeric,500::numeric,'https://www.morandispa.it/prodotti/tubi-per-impieghi-strutturali/strutturale-laminato-a-freddo-en-10219/'),
    ('37f10000-0000-4000-8000-000000000906'::uuid,'37f10000-0000-4000-8000-000000000186'::uuid,'107b4a40-d955-4a71-a87b-305eb0f954ee'::uuid,'wall_thickness',3::numeric,20::numeric,'https://www.morandispa.it/prodotti/tubi-per-impieghi-strutturali/strutturale-laminato-a-freddo-en-10219/'),
    ('37f10000-0000-4000-8000-000000000907'::uuid,'37f10000-0000-4000-8000-000000000187'::uuid,'76c3e9a7-ed65-4e6b-93a6-1bf7842f1a5a'::uuid,'outer_diameter',21.3::numeric,1560::numeric,'https://www.copromet.it/')
),
assertions as (
  insert into public.network_data_assertions(
    id,entity_type,entity_id,field_path,asserted_value,
    source_type,source_reference,ownership_type,confidence,review_state
  )
  select
    s.assertion_id,'company_product',s.company_product_id,
    'p3_7f_public_web_dimension.'||s.dimension_type,
    jsonb_build_object('dimension_type',s.dimension_type,'min_mm',s.min_mm,'max_mm',s.max_mm),
    'public_web',s.source_url,'platform_curated',0.98,'accepted'
  from dimension_seed s
  on conflict (id) do nothing
  returning id
)
insert into public.network_company_product_dimension_scopes(
  id,company_product_id,dimension_type,min_mm,max_mm,source_assertion_id,verification_status
)
select
  s.scope_id,s.company_product_id,s.dimension_type,s.min_mm,s.max_mm,s.assertion_id,'unverified'
from dimension_seed s
on conflict (company_product_id,dimension_type) do update
set min_mm=excluded.min_mm,
    max_mm=excluded.max_mm,
    source_assertion_id=excluded.source_assertion_id,
    verification_status='unverified',
    updated_at=now();

comment on table public.network_company_product_dimension_scopes is
  'P3.7E/P3.7F declared or public-web supplier dimensional envelopes for Network product relationships; provenance controls trust presentation.';
