-- PA2.9 verified Company identity + Contact mapping acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.9 assertion failed: %',message;
  end if;
end;
$$;

create or replace function pg_temp.assert_raises(statement text, expected_fragment text)
returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm)=0 then raise; end if;
    return;
  end;
  raise exception 'Expected failure: %',expected_fragment;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000034a1','pa29@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000034f1',
'PA29 Org',
'pa29-org',
'00000000-0000-0000-0000-0000000034a1',
'completed'
);

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000034f1',
'00000000-0000-0000-0000-0000000034a1',
'admin','sales_director','active',true
);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,status,organization_id
) values(
'00000000-0000-0000-0000-000000003401',
'00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-000000003402',
'pa29.eml','active',
'00000000-0000-0000-0000-0000000034f1'
);

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,
started_at,last_activity_at,email_count,organization_id
) values(
'00000000-0000-0000-0000-000000003403',
'00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-000000003401',
'00000000-0000-0000-0000-000000003404',
'PA29 RFQ','rfq',now(),now(),1,
'00000000-0000-0000-0000-0000000034f1'
);

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
source_filename,source_text,confidence,search_text,organization_id
) values(
34001,
'00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-000000003401',
'00000000-0000-0000-0000-000000003403',
'00000000-0000-0000-0000-000000003404',
'requested','inbound','round_tube','S355',273,8,12000,2,'PACCHI',
'pa29.eml','S355 273x8 12000',0.96,'s355 273x8 12000',
'00000000-0000-0000-0000-0000000034f1'
);

insert into public.conversations(
id,owner_id,organization_id,subject,external_thread_id,status,started_at,last_activity_at
) values(
'00000000-0000-0000-0000-000000003405',
'00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-0000000034f1',
'PA29 RFQ',
'00000000-0000-0000-0000-000000003404',
'open',now(),now()
);

insert into public.messages(
id,owner_id,organization_id,conversation_id,external_message_id,sender_email,
recipient_emails,sent_at,subject
) values(
'00000000-0000-0000-0000-000000003406',
'00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-0000000034f1',
'00000000-0000-0000-0000-000000003405',
'<pa29@example.com>',
'buyer@verified.example',
array['sales@steel.example'],now(),'PA29 RFQ'
);

insert into public.rfqs(
id,owner_id,organization_id,assigned_to_user_id,created_by_user_id,requested_at,status,priority
) values(
'00000000-0000-0000-0000-000000003407',
'00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-0000000034f1',
'00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-0000000034a1',
now(),'new','normal'
);

insert into public.rfq_lines(
id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,requested_grade,
min_length_mm,max_length_mm,canonical_product_id,canonical_product_key,
source_observation_id,raw_spec_text
)
select
'00000000-0000-0000-0000-000000003408',
o.owner_id,o.organization_id,
'00000000-0000-0000-0000-000000003407',
o.quantity,o.quantity_unit,o.grade,o.length_mm,o.length_mm,
o.canonical_product_id,o.canonical_product_key,o.id,o.source_text
from public.commercial_observations o where o.id=34001;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000034a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.record_commercial_entity_promotion(
'00000000-0000-0000-0000-0000000034f1',
34001,'rfq_line',
'00000000-0000-0000-0000-000000003408',
null,'created','applied',0.96,'deterministic_match',null,null,'{"phase":"pa29"}'::jsonb
);

select public.upsert_verified_contact_identity(
'00000000-0000-0000-0000-0000000034f1',
'buyer@verified.example',
'Verified Buyer',
null
) as contact_result \gset

select public.resolve_message_business_identity(
'00000000-0000-0000-0000-000000003406'
) as contact_only \gset

select pg_temp.assert_true(
  :'contact_only'::jsonb->>'company_status'='blocked_missing_verified_company_mapping',
  'exact Contact without verified Company mapping must remain company-blocked'
);

insert into public.companies(
id,owner_id,organization_id,name,company_type
) values(
'00000000-0000-0000-0000-000000003409',
'00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-0000000034f1',
'Unverified Company','customer'
);

select pg_temp.assert_raises(
  format(
    'select public.link_contact_to_verified_company(%L::uuid,%L::uuid,%L,%L::jsonb)',
    :'contact_result'::jsonb->>'contact_id',
    '00000000-0000-0000-0000-000000003409',
    'human_confirmed',
    '{}'
  ),
  'Company has no verified business identity'
);

select public.upsert_verified_company_identity(
  '00000000-0000-0000-0000-0000000034f1',
  'Verified Steel Customer',
  'vat_number',
  ' IT 123-456-78901 ',
  null,
  'IT',
  'customer',
  'vat_document',
  '{"source":"verified VAT document"}'::jsonb
) as company_result \gset

select pg_temp.assert_true(
  :'company_result'::jsonb->>'status'='created'
  and :'company_result'::jsonb->>'identity_value'='IT12345678901',
  'VAT identity must normalize and create a verified Company'
);

select public.upsert_verified_company_identity(
  '00000000-0000-0000-0000-0000000034f1',
  'Verified Steel Customer',
  'vat_number',
  'IT12345678901',
  null,
  'IT',
  'customer',
  'vat_document',
  '{}'::jsonb
) as repeat_company \gset

select pg_temp.assert_true(
  :'repeat_company'::jsonb->>'status'='existing'
  and :'repeat_company'::jsonb->>'company_id'=:'company_result'::jsonb->>'company_id'
  and (select count(*) from public.commercial_company_identity_verifications)=1,
  'repeated verified Company identity must be idempotent'
);

select public.link_contact_to_verified_company(
  (:'contact_result'::jsonb->>'contact_id')::uuid,
  (:'company_result'::jsonb->>'company_id')::uuid,
  'human_confirmed',
  '{"review":"PA2.9 acceptance"}'::jsonb
) as mapping_result \gset

select pg_temp.assert_true(
  :'mapping_result'::jsonb->>'status'='linked'
  and (select company_id from public.contacts where id=(:'contact_result'::jsonb->>'contact_id')::uuid)
      =(:'company_result'::jsonb->>'company_id')::uuid,
  'Contact must link only to already verified Company'
);

select public.resolve_message_business_identity(
'00000000-0000-0000-0000-000000003406'
) as company_resolved \gset

select pg_temp.assert_true(
  :'company_resolved'::jsonb->>'company_status'='linked_verified_contact_company'
  and :'company_resolved'::jsonb->>'company_id'=:'company_result'::jsonb->>'company_id',
  'rerun must deterministically propagate verified Company to Message'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.rfqs r
    where r.id='00000000-0000-0000-0000-000000003407'
      and r.company_id=(:'company_result'::jsonb->>'company_id')::uuid
      and r.contact_id=(:'contact_result'::jsonb->>'contact_id')::uuid
      and r.source_message_id='00000000-0000-0000-0000-000000003406'
  ),
  'RFQ must inherit verified Company only through Contact mapping'
);

select public.link_contact_to_verified_company(
  (:'contact_result'::jsonb->>'contact_id')::uuid,
  (:'company_result'::jsonb->>'company_id')::uuid,
  'human_confirmed',
  '{}'::jsonb
) as repeat_mapping \gset

select pg_temp.assert_true(
  :'repeat_mapping'::jsonb->>'status'='existing'
  and (select count(*) from public.commercial_contact_company_mappings)=1,
  'Contact→Company mapping repeat must be idempotent'
);

select pg_temp.assert_raises(
  $$select public.upsert_verified_company_identity(
    '00000000-0000-0000-0000-0000000034f1'::uuid,
    'Invalid Name Only',
    'human_confirmed',
    'verified.example',
    null,null,'customer','human_review','{}'::jsonb
  )$$,
  'Unsupported company identity type'
);

reset role;

select pg_temp.assert_raises(
  $$update public.commercial_company_identity_verifications
    set verification_basis='human_review'
    where id=(select min(id) from public.commercial_company_identity_verifications)$$,
  'company identity audit ledger is append-only'
);

select pg_temp.assert_raises(
  $$delete from public.commercial_contact_company_mappings
    where id=(select min(id) from public.commercial_contact_company_mappings)$$,
  'company identity audit ledger is append-only'
);

rollback;
