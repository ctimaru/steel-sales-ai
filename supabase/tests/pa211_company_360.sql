-- PA2.11 Company 360 acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.11 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000036a1','pa211@example.com'),
('00000000-0000-0000-0000-0000000036a2','pa211-other@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values
('00000000-0000-0000-0000-0000000036f1','PA211 Org','pa211-org','00000000-0000-0000-0000-0000000036a1','completed'),
('00000000-0000-0000-0000-0000000036f2','PA211 Other','pa211-other','00000000-0000-0000-0000-0000000036a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values
(
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-0000000036a1',
'admin','sales_director','active',true
),
(
'00000000-0000-0000-0000-0000000036f2',
'00000000-0000-0000-0000-0000000036a2',
'admin','sales_director','active',true
);

insert into public.companies(
id,owner_id,organization_id,name,company_type,country,vat_number
) values
('00000000-0000-0000-0000-000000003601','00000000-0000-0000-0000-0000000036a1','00000000-0000-0000-0000-0000000036f1','PA211 Customer','customer','IT','IT11111111111'),
('00000000-0000-0000-0000-000000003602','00000000-0000-0000-0000-0000000036a2','00000000-0000-0000-0000-0000000036f2','Other Tenant Co','customer','IT','IT22222222222');

insert into public.commercial_company_identity_verifications(
organization_id,company_id,identity_type,identity_value,verification_basis,verified_by
) values(
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003601',
'vat_number','IT11111111111','vat_document',
'00000000-0000-0000-0000-0000000036a1'
);

insert into public.contacts(
id,owner_id,organization_id,company_id,full_name,email,role
) values(
'00000000-0000-0000-0000-000000003603',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003601',
'Buyer One','buyer@pa211.example','Purchasing'
);

insert into public.conversations(
id,owner_id,organization_id,company_id,subject,external_thread_id,status,started_at,last_activity_at
) values(
'00000000-0000-0000-0000-000000003604',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003601',
'PA211 Request','pa211-thread','open',
'2026-09-20T08:00:00Z','2026-09-22T08:00:00Z'
);

insert into public.messages(
id,owner_id,organization_id,conversation_id,external_message_id,direction,
sender_email,recipient_emails,sent_at,subject,sender_contact_id,sender_company_id
) values(
'00000000-0000-0000-0000-000000003605',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003604',
'<pa211@example.com>','inbound','buyer@pa211.example',
array['sales@steel.example'],'2026-09-20T08:00:00Z','PA211 Request',
'00000000-0000-0000-0000-000000003603',
'00000000-0000-0000-0000-000000003601'
);

insert into public.rfqs(
id,owner_id,organization_id,conversation_id,company_id,contact_id,
source_message_id,assigned_to_user_id,created_by_user_id,requested_at,status,priority
) values(
'00000000-0000-0000-0000-000000003606',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003604',
'00000000-0000-0000-0000-000000003601',
'00000000-0000-0000-0000-000000003603',
'00000000-0000-0000-0000-000000003605',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036a1',
'2026-09-20T08:00:00Z','quoted','high'
);

insert into public.rfq_lines(
id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,
requested_grade,requested_standard,min_length_mm,max_length_mm,
canonical_product_id,canonical_product_key,raw_spec_text
) values(
'00000000-0000-0000-0000-000000003607',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003606',
10,'PZ','S355J2H','EN10219',12000,12000,
'33333333-3333-3333-3333-333333333333',
'tube:v1|family=round_tube|grade=s355j2h|geom=od:273|t=8',
'S355J2H EN10219 273x8x12000 - 10 PZ'
);

insert into public.offers(
id,owner_id,organization_id,conversation_id,company_id,rfq_id,
created_by_user_id,assigned_to_user_id,source_message_id,
offered_at,status,currency
) values(
'00000000-0000-0000-0000-000000003608',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003604',
'00000000-0000-0000-0000-000000003601',
'00000000-0000-0000-0000-000000003606',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-000000003605',
'2026-09-21T08:00:00Z','sent','EUR'
);

insert into public.offer_lines(
id,owner_id,organization_id,offer_id,rfq_line_id,quantity,quantity_unit,
price_value,price_unit,canonical_product_id,canonical_product_key,raw_spec_text
) values(
'00000000-0000-0000-0000-000000003609',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003608',
'00000000-0000-0000-0000-000000003607',
10,'PZ',68.38,'M',
'33333333-3333-3333-3333-333333333333',
'tube:v1|family=round_tube|grade=s355j2h|geom=od:273|t=8',
'Offer 273x8x12000 - 68.38 EUR/M'
);

insert into public.orders(
id,owner_id,organization_id,conversation_id,company_id,rfq_id,offer_id,
created_by_user_id,assigned_to_user_id,source_message_id,ordered_at,status
) values(
'00000000-0000-0000-0000-000000003610',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003604',
'00000000-0000-0000-0000-000000003601',
'00000000-0000-0000-0000-000000003606',
'00000000-0000-0000-0000-000000003608',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-000000003605',
'2026-09-22T08:00:00Z','confirmed'
);

insert into public.order_lines(
id,owner_id,organization_id,order_id,offer_line_id,quantity,quantity_unit,
unit_price,price_unit,canonical_product_id,canonical_product_key,raw_spec_text
) values(
'00000000-0000-0000-0000-000000003611',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003610',
'00000000-0000-0000-0000-000000003609',
10,'PZ',68.38,'M',
'33333333-3333-3333-3333-333333333333',
'tube:v1|family=round_tube|grade=s355j2h|geom=od:273|t=8',
'Order 273x8x12000 - 68.38 EUR/M'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000036a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p1_company_directory(
    '00000000-0000-0000-0000-0000000036f1',
    'PA211',
    100
  )->>'total')::int=1,
  'directory must expose only tenant Company'
);

select pg_temp.assert_true(
  public.p1_company_directory(
    '00000000-0000-0000-0000-0000000036f1',
    'PA211',
    100
  )#>>'{companies,0,verified}'='true'
  and (public.p1_company_directory(
    '00000000-0000-0000-0000-0000000036f1',
    'PA211',
    100
  )#>>'{companies,0,rfq_count}')::int=1
  and (public.p1_company_directory(
    '00000000-0000-0000-0000-0000000036f1',
    'PA211',
    100
  )#>>'{companies,0,order_count}')::int=1,
  'directory must expose verified status and business counts'
);

select pg_temp.assert_true(
  public.p1_company_360('00000000-0000-0000-0000-000000003601')#>>'{company,name}'='PA211 Customer'
  and public.p1_company_360('00000000-0000-0000-0000-000000003601')#>>'{read_model}'='normalized_company_360',
  'Company 360 must return normalized target Company'
);

select pg_temp.assert_true(
  (public.p1_company_360('00000000-0000-0000-0000-000000003601')#>>'{summary,contacts}')::int=1
  and (public.p1_company_360('00000000-0000-0000-0000-000000003601')#>>'{summary,messages}')::int=1
  and (public.p1_company_360('00000000-0000-0000-0000-000000003601')#>>'{summary,rfqs}')::int=1
  and (public.p1_company_360('00000000-0000-0000-0000-000000003601')#>>'{summary,offers}')::int=1
  and (public.p1_company_360('00000000-0000-0000-0000-000000003601')#>>'{summary,orders}')::int=1
  and (public.p1_company_360('00000000-0000-0000-0000-000000003601')#>>'{summary,products}')::int=1
  and (public.p1_company_360('00000000-0000-0000-0000-000000003601')#>>'{summary,priced_lines}')::int=2,
  'Company 360 summary must cover full normalized business chain'
);

select pg_temp.assert_true(
  jsonb_array_length(public.p1_company_360('00000000-0000-0000-0000-000000003601')->'timeline')=4,
  'timeline must combine Message, RFQ, Offer and Order once each'
);

select pg_temp.assert_true(
  public.p1_company_360('00000000-0000-0000-0000-000000003601')#>>'{rfqs,0,provenance,source}'='normalized_rfq'
  and public.p1_company_360('00000000-0000-0000-0000-000000003601')#>>'{messages,0,provenance,source}'='normalized_message'
  and jsonb_array_length(public.p1_company_360('00000000-0000-0000-0000-000000003601')->'price_activity')=2,
  'Company 360 must preserve provenance and price activity'
);

select pg_temp.assert_true(
  public.p1_company_360('00000000-0000-0000-0000-000000003602') is null,
  'cross-tenant Company 360 must be invisible'
);

reset role;
rollback;
