-- P3.7C — Public Company Profile Composition & Trust Presentation acceptance.
-- Disposable CI only. Everything rolls back.

begin;

create or replace function pg_temp.p37c_assert(ok boolean,message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'P3.7C assertion failed: %',message;
  end if;
end;
$$;

insert into public.network_companies(
  id,legal_name,trading_name,country_code,website_url,website_domain,description,
  publication_status,claimed_status,verification_status
) values (
  '00000000-0000-0000-0000-0000000037c1',
  'P3.7C Public Profile S.r.l.',
  'P3.7C Tubes',
  'IT',
  'https://p37c.example.test',
  'p37c.example.test',
  'Public profile acceptance company',
  'published','claimed','unverified'
);

insert into public.network_data_assertions(
  id,entity_type,entity_id,field_path,asserted_value,
  source_type,source_reference,ownership_type,confidence,review_state
) values (
  '00000000-0000-0000-0000-0000000037c2',
  'company',
  '00000000-0000-0000-0000-0000000037c1',
  'description',
  '"Public profile acceptance company"'::jsonb,
  'company_declared',
  'p3.7c acceptance',
  'company_managed',
  1.0000,
  'accepted'
);

insert into public.network_company_role_assignments(
  id,company_id,role_id,is_primary,source_assertion_id
)
select
  '00000000-0000-0000-0000-0000000037c3',
  '00000000-0000-0000-0000-0000000037c1',
  r.id,true,
  '00000000-0000-0000-0000-0000000037c2'
from public.network_company_roles r
where r.canonical_key='producer';

insert into public.network_company_products(
  id,company_id,product_family_id,relationship_type,facility_id,source_assertion_id
)
select
  '00000000-0000-0000-0000-0000000037c4',
  '00000000-0000-0000-0000-0000000037c1',
  p.id,'produces',null,
  '00000000-0000-0000-0000-0000000037c2'
from public.network_product_families p
where p.canonical_key='tubes_pipes';

insert into public.network_facilities(
  id,company_id,name,facility_type,city,region,country_code,
  publication_status,verification_status
) values (
  '00000000-0000-0000-0000-0000000037c5',
  '00000000-0000-0000-0000-0000000037c1',
  'P3.7C Torino Plant','plant','Torino','Piemonte','IT',
  'published','unverified'
);

insert into public.network_data_assertions(
  id,entity_type,entity_id,field_path,asserted_value,
  source_type,source_reference,ownership_type,confidence,review_state
) values (
  '00000000-0000-0000-0000-0000000037c6',
  'facility',
  '00000000-0000-0000-0000-0000000037c5',
  'profile_snapshot',
  '{"city":"Torino"}'::jsonb,
  'company_declared',
  'p3.7c acceptance',
  'company_managed',
  1.0000,
  'accepted'
);

insert into public.network_facility_capabilities(
  id,facility_id,capability_id,source_assertion_id,verification_status
)
select
  '00000000-0000-0000-0000-0000000037c7',
  '00000000-0000-0000-0000-0000000037c5',
  cap.id,
  '00000000-0000-0000-0000-0000000037c2',
  'unverified'
from public.network_capabilities cap
where cap.canonical_key='stockholding';

insert into public.network_company_markets(
  id,company_id,market_id,source_assertion_id
)
select
  '00000000-0000-0000-0000-0000000037c8',
  '00000000-0000-0000-0000-0000000037c1',
  m.id,
  '00000000-0000-0000-0000-0000000037c2'
from public.network_markets m
where m.canonical_key='automotive';

insert into public.network_company_certifications(
  id,company_id,facility_id,certification_type_id,issuer,certificate_identifier,
  valid_from,valid_to,scope_text,verification_status,evidence_reference,source_assertion_id
)
select
  '00000000-0000-0000-0000-0000000037c9',
  '00000000-0000-0000-0000-0000000037c1',
  '00000000-0000-0000-0000-0000000037c5',
  ct.id,
  'P3.7C Certification Body',
  'P37C-ISO9001',
  current_date - interval '30 days',
  current_date + interval '330 days',
  'Tube manufacturing',
  'unverified',
  'company declaration',
  '00000000-0000-0000-0000-0000000037c2'
from public.network_certification_types ct
where ct.canonical_key='iso_9001';

set local role authenticated;
select public.p3_7c_public_company_profile(
  '00000000-0000-0000-0000-0000000037c1'
) as profile
\gset
reset role;

select pg_temp.p37c_assert(
  :'profile'::jsonb->>'contract'='P3.7C-v1',
  'public profile contract must be P3.7C-v1'
);

select pg_temp.p37c_assert(
  :'profile'::jsonb->'company'->>'provenance_kind'='company_declared',
  'company-managed public profile must expose safe company_declared provenance'
);

select pg_temp.p37c_assert(
  (:'profile'::jsonb->'trust'->>'claimed')::boolean
  and not (:'profile'::jsonb->'trust'->>'verified')::boolean,
  'claim and verification must remain distinct public trust states'
);

select pg_temp.p37c_assert(
  (:'profile'::jsonb->'completeness'->>'percentage')::integer=100,
  'all seven public sections must produce 100 percent completeness'
);

select pg_temp.p37c_assert(
  jsonb_array_length(:'profile'::jsonb->'products')=1
  and jsonb_array_length(:'profile'::jsonb->'facilities')=1
  and jsonb_array_length(:'profile'::jsonb->'markets')=1
  and jsonb_array_length(:'profile'::jsonb->'certifications')=1,
  'public profile must compose structured P3.7B data'
);

select pg_temp.p37c_assert(
  :'profile'::jsonb->'certifications'->0->>'validity_state'='valid',
  'certification validity state must be server-derived'
);

select pg_temp.p37c_assert(
  position('source_assertion_id' in :'profile')=0
  and position('asserted_by' in :'profile')=0
  and position('source_reference' in :'profile')=0,
  'public profile must not expose assertion/governance identifiers'
);

select pg_temp.p37c_assert(
  not has_table_privilege('authenticated','public.network_data_assertions','SELECT'),
  'authenticated users must not get direct assertion-table access'
);

select pg_temp.p37c_assert(
  not has_function_privilege('anon','public.p3_7c_public_company_profile(uuid)','EXECUTE'),
  'P3.7C profile is authenticated SaaS surface, not anonymous Data API'
);

rollback;
