-- PA2.12 Company 360 activation after explicit identity confirmation.
-- Synthetic transaction only: proves the integration without touching production identity mappings.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.12 assertion failed: %',message;
  end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000037a1','pa212@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000037f1','PA212 Org','pa212-org',
'00000000-0000-0000-0000-0000000037a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000037f1',
'00000000-0000-0000-0000-0000000037a1',
'admin','sales_director','active',true);

insert into public.companies(
id,owner_id,organization_id,name,company_type,country,vat_number
) values(
'00000000-0000-0000-0000-000000003701',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037f1',
'PA212 Verified Customer','customer','IT','IT77777777777');

insert into public.commercial_company_identity_verifications(
organization_id,company_id,identity_type,identity_value,verification_basis,verified_by
) values(
'00000000-0000-0000-0000-0000000037f1',
'00000000-0000-0000-0000-000000003701',
'vat_number','IT77777777777','vat_document',
'00000000-0000-0000-0000-0000000037a1');

insert into public.contacts(
id,owner_id,organization_id,full_name,email
) values(
'00000000-0000-0000-0000-000000003702',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037f1',
'PA212 Buyer','buyer@pa212.example');

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,status,organization_id
) values(
'00000000-0000-0000-0000-000000003703',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-000000003704',
'pa212.eml','active',
'00000000-0000-0000-0000-0000000037f1');

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,
started_at,last_activity_at,email_count,organization_id
) values(
'00000000-0000-0000-0000-000000003705',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-000000003703',
'00000000-0000-0000-0000-000000003706',
'PA212 RFQ','rfq',now(),now(),1,
'00000000-0000-0000-0000-0000000037f1');

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
source_filename,source_text,confidence,search_text,organization_id
) values(
37001,
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-000000003703',
'00000000-0000-0000-0000-000000003705',
'00000000-0000-0000-0000-000000003706',
'requested','inbound','round_tube','S355J2H',273,8,12000,2,'PACCHI',
'pa212.eml','S355J2H 273x8x12000',0.96,'s355j2h 273x8 12000',
'00000000-0000-0000-0000-0000000037f1');

insert into public.conversations(
id,owner_id,organization_id,subject,external_thread_id,status,started_at,last_activity_at
) values(
'00000000-0000-0000-0000-000000003707',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037f1',
'PA212 RFQ',
'00000000-0000-0000-0000-000000003706',
'open',now(),now());

insert into public.messages(
id,owner_id,organization_id,conversation_id,external_message_id,direction,
sender_email,recipient_emails,sent_at,subject
) values(
'00000000-0000-0000-0000-000000003708',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037f1',
'00000000-0000-0000-0000-000000003707',
'<pa212@example.com>','inbound','buyer@pa212.example',
array['sales@steel.example'],now(),'PA212 RFQ');

insert into public.rfqs(
id,owner_id,organization_id,assigned_to_user_id,created_by_user_id,requested_at,status,priority
) values(
'00000000-0000-0000-0000-000000003709',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037f1',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037a1',
now(),'new','normal');

insert into public.rfq_lines(
id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,requested_grade,
min_length_mm,max_length_mm,canonical_product_id,canonical_product_key,
source_observation_id,raw_spec_text
)
select
'00000000-0000-0000-0000-000000003710',
o.owner_id,o.organization_id,
'00000000-0000-0000-0000-000000003709',
o.quantity,o.quantity_unit,o.grade,o.length_mm,o.length_mm,
o.canonical_product_id,o.canonical_product_key,o.id,o.source_text
from public.commercial_observations o
where o.id=37001;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000037a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.record_commercial_entity_promotion(
'00000000-0000-0000-0000-0000000037f1',
37001,'rfq_line',
'00000000-0000-0000-0000-000000003710',
null,'created','applied',0.96,'deterministic_match',null,null,
'{"phase":"PA2.12"}'::jsonb
);

select pg_temp.assert_true(
  (public.p1_identity_confirmation_queue(
    '00000000-0000-0000-0000-0000000037f1',100
  )#>>'{summary,unresolved_contacts}')::int=1,
  'unresolved Contact must be visible before explicit confirmation'
);

select pg_temp.assert_true(
  (public.p1_company_360(
    '00000000-0000-0000-0000-000000003701'
  )#>>'{summary,contacts}')::int=0
  and (public.p1_company_360(
    '00000000-0000-0000-0000-000000003701'
  )#>>'{summary,messages}')::int=0
  and (public.p1_company_360(
    '00000000-0000-0000-0000-000000003701'
  )#>>'{summary,rfqs}')::int=0,
  'Company 360 must remain empty before human Contact→Company confirmation'
);

select public.confirm_contact_company_mapping(
  '00000000-0000-0000-0000-000000003702',
  '00000000-0000-0000-0000-000000003701',
  '{"source":"pa212_acceptance"}'::jsonb
) as confirmation \gset

select pg_temp.assert_true(
  :'confirmation'::jsonb->>'status'='confirmed'
  and (:'confirmation'::jsonb->>'resolved_messages')::int=1
  and (:'confirmation'::jsonb->>'linked_rfqs')::int=1,
  'explicit confirmation must trigger exact-email Message and promoted RFQ propagation'
);

select pg_temp.assert_true(
  (public.p1_identity_confirmation_queue(
    '00000000-0000-0000-0000-0000000037f1',100
  )#>>'{summary,unresolved_contacts}')::int=0,
  'confirmed Contact must leave the identity backlog immediately'
);

select pg_temp.assert_true(
  (public.p1_company_360(
    '00000000-0000-0000-0000-000000003701'
  )#>>'{summary,contacts}')::int=1
  and (public.p1_company_360(
    '00000000-0000-0000-0000-000000003701'
  )#>>'{summary,messages}')::int=1
  and (public.p1_company_360(
    '00000000-0000-0000-0000-000000003701'
  )#>>'{summary,rfqs}')::int=1
  and (public.p1_company_360(
    '00000000-0000-0000-0000-000000003701'
  )#>>'{summary,conversations}')::int=1
  and jsonb_array_length(public.p1_company_360(
    '00000000-0000-0000-0000-000000003701'
  )->'timeline')=2,
  'Company 360 must activate immediately from normalized links after confirmation'
);

select pg_temp.assert_true(
  exists(
    select 1 from public.rfqs
    where id='00000000-0000-0000-0000-000000003709'
      and company_id='00000000-0000-0000-0000-000000003701'
      and contact_id='00000000-0000-0000-0000-000000003702'
      and source_message_id='00000000-0000-0000-0000-000000003708'
  ),
  'RFQ Company link must come from deterministic source Message propagation'
);

reset role;
rollback;
