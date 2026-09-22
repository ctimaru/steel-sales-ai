-- PA2.12 Company 360 activation + deterministic search-link acceptance.
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
'PA212 Customer','customer','IT','IT77777777777');

insert into public.commercial_company_identity_verifications(
organization_id,company_id,identity_type,identity_value,verification_basis,verified_by
) values(
'00000000-0000-0000-0000-0000000037f1',
'00000000-0000-0000-0000-000000003701',
'vat_number','IT77777777777','vat_document',
'00000000-0000-0000-0000-0000000037a1');

insert into public.contacts(
id,owner_id,organization_id,full_name,email
) values
(
'00000000-0000-0000-0000-000000003702',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037f1',
'Buyer Activate','buyer.activate@example.com'
),
(
'00000000-0000-0000-0000-000000003705',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037f1',
'Buyer Still Pending','buyer.pending@example.com'
);

insert into public.conversations(
id,owner_id,organization_id,subject,external_thread_id,status,started_at,last_activity_at
) values(
'00000000-0000-0000-0000-000000003703',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037f1',
'PA212 RFQ',
'00000000-0000-0000-0000-000000003730',
'open','2026-09-22T09:00:00Z','2026-09-22T09:00:00Z');

insert into public.messages(
id,owner_id,organization_id,conversation_id,external_message_id,direction,
sender_email,recipient_emails,sent_at,subject
) values
(
'00000000-0000-0000-0000-000000003704',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037f1',
'00000000-0000-0000-0000-000000003703',
'<pa212-activate@example.com>','inbound',
'buyer.activate@example.com',array['sales@example.com'],
'2026-09-22T09:00:00Z','PA212 RFQ'
),
(
'00000000-0000-0000-0000-000000003706',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037f1',
null,
'<pa212-pending@example.com>','inbound',
'buyer.pending@example.com',array['sales@example.com'],
'2026-09-22T09:05:00Z','Pending identity'
);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,organization_id
) values(
'00000000-0000-0000-0000-000000003710',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-000000003711',
'pa212.eml',
'00000000-0000-0000-0000-0000000037f1');

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values(
'00000000-0000-0000-0000-000000003720',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-000000003710',
'00000000-0000-0000-0000-000000003730',
'PA212 S355 273x8 12000','rfq','2026-09-22T09:00:00Z',
'00000000-0000-0000-0000-0000000037f1');

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,standard,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
source_filename,source_text,confidence,search_text,organization_id
) values(
37001,
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-000000003710',
'00000000-0000-0000-0000-000000003720',
'00000000-0000-0000-0000-000000003730',
'requested','inbound','round_tube','S355J2H','EN 10219',273,8,12000,10,'PZ',
'pa212.eml','S355J2H EN10219 273x8x12000 - 10 PZ',0.98,
's355j2h en10219 273x8 12000',
'00000000-0000-0000-0000-0000000037f1');

insert into public.rfqs(
id,owner_id,organization_id,contact_id,assigned_to_user_id,created_by_user_id,
requested_at,status,priority
) values(
'00000000-0000-0000-0000-000000003741',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037f1',
'00000000-0000-0000-0000-000000003702',
'00000000-0000-0000-0000-0000000037a1',
'00000000-0000-0000-0000-0000000037a1',
'2026-09-22T09:00:00Z','new','normal');

insert into public.rfq_lines(
id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,requested_grade,
requested_standard,min_length_mm,max_length_mm,source_observation_id,raw_spec_text,
canonical_product_id,canonical_product_key
) select
'00000000-0000-0000-0000-000000003742',
o.owner_id,o.organization_id,
'00000000-0000-0000-0000-000000003741',
o.quantity,o.quantity_unit,o.grade,o.standard,o.length_mm,o.length_mm,o.id,o.source_text,
o.canonical_product_id,o.canonical_product_key
from public.commercial_observations o
where o.id=37001;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000037a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.record_commercial_entity_promotion(
'00000000-0000-0000-0000-0000000037f1',
37001,'rfq_line',
'00000000-0000-0000-0000-000000003742',
null,'created','applied',0.98,'deterministic_match',null,null,
'{"phase":"PA2.12","fixture":"activation"}'::jsonb
);

select pg_temp.assert_true(
  (public.p1_identity_confirmation_queue(
    '00000000-0000-0000-0000-0000000037f1',1
  )#>>'{summary,unresolved_contacts}')::int=2,
  'summary must count the full unresolved backlog even when queue rows are limited'
);

select pg_temp.assert_true(
  jsonb_array_length(
    public.p1_identity_confirmation_queue(
      '00000000-0000-0000-0000-0000000037f1',1
    )->'contacts'
  )=1,
  'identity queue row limit must remain effective independently of summary count'
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
  'Company 360 must not attribute unresolved Contact activity before explicit confirmation'
);

select public.confirm_contact_company_mapping(
  '00000000-0000-0000-0000-000000003702',
  '00000000-0000-0000-0000-000000003701',
  '{"source":"pa212_acceptance"}'::jsonb
) as confirmation \gset

select pg_temp.assert_true(
  :'confirmation'::jsonb->>'status'='confirmed'
  and (:'confirmation'::jsonb->>'linked_rfqs')::int=1,
  'explicit confirmation must propagate the verified Company into the linked normalized RFQ'
);

select pg_temp.assert_true(
  (select company_id from public.contacts where id='00000000-0000-0000-0000-000000003702')
    ='00000000-0000-0000-0000-000000003701'::uuid
  and (select sender_company_id from public.messages where id='00000000-0000-0000-0000-000000003704')
    ='00000000-0000-0000-0000-000000003701'::uuid
  and (select company_id from public.rfqs where id='00000000-0000-0000-0000-000000003741')
    ='00000000-0000-0000-0000-000000003701'::uuid,
  'confirmation must activate Contact, Message and RFQ Company links atomically'
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
  )#>>'{summary,rfqs}')::int=1,
  'Company 360 must update immediately after explicit identity confirmation'
);

select pg_temp.assert_true(
  jsonb_array_length(public.p1_company_360(
    '00000000-0000-0000-0000-000000003701'
  )->'timeline')=2,
  'activated Company 360 timeline must immediately include Message and RFQ'
);

select pg_temp.assert_true(
  (public.p1_identity_confirmation_queue(
    '00000000-0000-0000-0000-0000000037f1',1
  )#>>'{summary,unresolved_contacts}')::int=1,
  'confirmed Contact must leave the unresolved total while other pending identities remain'
);

reset role;

select pg_temp.assert_true(
  public.p1_global_structured_search_bridge(
    '00000000-0000-0000-0000-0000000037f1',
    'S355J2H 273x8 12000',
    array['rfq'],
    '{}'::jsonb,
    50
  )#>>'{results,0,metadata,company_id}'
    ='00000000-0000-0000-0000-000000003701',
  'normalized RFQ search result must expose deterministic Company 360 id'
);

select pg_temp.assert_true(
  public.p1_global_structured_search_bridge(
    '00000000-0000-0000-0000-0000000037f1',
    'S355J2H 273x8 12000',
    array['rfq'],
    '{}'::jsonb,
    50
  )#>>'{results,0,metadata,company_link_source}'
    ='normalized_business_entity',
  'search Company link must declare normalized business-entity provenance'
);

rollback;
