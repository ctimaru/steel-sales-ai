-- PA2.8 exact-email Contact + verified Company resolution acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then
    raise exception 'PA2.8 assertion failed: %',message;
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
('00000000-0000-0000-0000-0000000033a1','pa28@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000033f1',
'PA28 Org',
'pa28-org',
'00000000-0000-0000-0000-0000000033a1',
'completed'
);

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000033f1',
'00000000-0000-0000-0000-0000000033a1',
'admin','sales_director','active',true
);

insert into public.companies(
id,owner_id,organization_id,name,company_type
) values(
'00000000-0000-0000-0000-000000003301',
'00000000-0000-0000-0000-0000000033a1',
'00000000-0000-0000-0000-0000000033f1',
'Verified Customer',
'customer'
);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,status,organization_id
) values(
'00000000-0000-0000-0000-000000003302',
'00000000-0000-0000-0000-0000000033a1',
'00000000-0000-0000-0000-000000003303',
'pa28.eml',
'active',
'00000000-0000-0000-0000-0000000033f1'
);

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,
started_at,last_activity_at,email_count,organization_id
) values(
'00000000-0000-0000-0000-000000003304',
'00000000-0000-0000-0000-0000000033a1',
'00000000-0000-0000-0000-000000003302',
'00000000-0000-0000-0000-000000003305',
'PA28 RFQ','rfq',now(),now(),1,
'00000000-0000-0000-0000-0000000033f1'
);

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
source_filename,source_text,confidence,search_text,organization_id
) values(
33001,
'00000000-0000-0000-0000-0000000033a1',
'00000000-0000-0000-0000-000000003302',
'00000000-0000-0000-0000-000000003304',
'00000000-0000-0000-0000-000000003305',
'requested','inbound','round_tube','S355',273,8,12000,2,'PACCHI',
'pa28.eml','S355 273x8 12000',0.96,'s355 273x8 12000',
'00000000-0000-0000-0000-0000000033f1'
);

insert into public.conversations(
id,owner_id,organization_id,subject,external_thread_id,status,started_at,last_activity_at
) values(
'00000000-0000-0000-0000-000000003306',
'00000000-0000-0000-0000-0000000033a1',
'00000000-0000-0000-0000-0000000033f1',
'PA28 RFQ',
'00000000-0000-0000-0000-000000003305',
'open',now(),now()
);

insert into public.messages(
id,owner_id,organization_id,conversation_id,external_message_id,sender_email,
recipient_emails,sent_at,subject
) values(
'00000000-0000-0000-0000-000000003307',
'00000000-0000-0000-0000-0000000033a1',
'00000000-0000-0000-0000-0000000033f1',
'00000000-0000-0000-0000-000000003306',
'<pa28@example.com>',
'Buyer@Example.COM',
array['sales@steel.example'],
now(),
'PA28 RFQ'
);

insert into public.rfqs(
id,owner_id,organization_id,assigned_to_user_id,created_by_user_id,requested_at,status,priority
) values(
'00000000-0000-0000-0000-000000003308',
'00000000-0000-0000-0000-0000000033a1',
'00000000-0000-0000-0000-0000000033f1',
'00000000-0000-0000-0000-0000000033a1',
'00000000-0000-0000-0000-0000000033a1',
now(),'new','normal'
);

insert into public.rfq_lines(
id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,requested_grade,
min_length_mm,max_length_mm,canonical_product_id,canonical_product_key,
source_observation_id,raw_spec_text
)
select
'00000000-0000-0000-0000-000000003309',
o.owner_id,o.organization_id,
'00000000-0000-0000-0000-000000003308',
o.quantity,o.quantity_unit,o.grade,o.length_mm,o.length_mm,
o.canonical_product_id,o.canonical_product_key,o.id,o.source_text
from public.commercial_observations o
where o.id=33001;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000033a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.record_commercial_entity_promotion(
'00000000-0000-0000-0000-0000000033f1',
33001,
'rfq_line',
'00000000-0000-0000-0000-000000003309',
null,'created','applied',0.96,'deterministic_match',null,null,
'{"phase":"pa28"}'::jsonb
);

select public.resolve_message_business_identity(
'00000000-0000-0000-0000-000000003307'
) as before_contact \gset

select pg_temp.assert_true(
  :'before_contact'::jsonb->>'status'='blocked_missing_verified_contact'
  and (select count(*) from public.contacts)=0,
  'resolver must not invent a Contact from sender email'
);

select public.upsert_verified_contact_identity(
  '00000000-0000-0000-0000-0000000033f1',
  ' BUYER@example.com ',
  'Verified Buyer',
  '00000000-0000-0000-0000-000000003301'
) as verified_contact \gset

select pg_temp.assert_true(
  :'verified_contact'::jsonb->>'status'='created'
  and :'verified_contact'::jsonb->>'email'='buyer@example.com'
  and :'verified_contact'::jsonb->>'company_id'='00000000-0000-0000-0000-000000003301',
  'verified contact registration must normalize exact email and retain explicit company mapping'
);

select public.resolve_message_business_identity(
'00000000-0000-0000-0000-000000003307'
) as resolved \gset

select pg_temp.assert_true(
  :'resolved'::jsonb->>'status'='resolved'
  and :'resolved'::jsonb->>'company_status'='linked_verified_contact_company'
  and (:'resolved'::jsonb->>'rfq_linked_count')::int=1,
  'exact-email resolution must link verified contact/company and one-source-message RFQ'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.messages m
    where m.id='00000000-0000-0000-0000-000000003307'
      and m.sender_contact_id=(:'resolved'::jsonb->>'contact_id')::uuid
      and m.sender_company_id='00000000-0000-0000-0000-000000003301'
  ),
  'message must store exact resolved sender Contact and verified Company'
);

select pg_temp.assert_true(
  exists(
    select 1
    from public.rfqs r
    where r.id='00000000-0000-0000-0000-000000003308'
      and r.conversation_id='00000000-0000-0000-0000-000000003306'
      and r.source_message_id='00000000-0000-0000-0000-000000003307'
      and r.contact_id=(:'resolved'::jsonb->>'contact_id')::uuid
      and r.company_id='00000000-0000-0000-0000-000000003301'
  ),
  'RFQ must inherit only deterministic source message/contact/company links'
);

select public.resolve_message_business_identity(
'00000000-0000-0000-0000-000000003307'
) as second_resolve \gset

select pg_temp.assert_true(
  (select count(*) from public.commercial_identity_resolutions)=2,
  'repeat resolution must not duplicate append-only identity events'
);

insert into public.messages(
id,owner_id,organization_id,conversation_id,external_message_id,sender_email,subject
) values(
'00000000-0000-0000-0000-000000003310',
'00000000-0000-0000-0000-0000000033a1',
'00000000-0000-0000-0000-0000000033f1',
'00000000-0000-0000-0000-000000003306',
'<unknown@same-domain.example>',
'unknown@example.com',
'Unknown sender'
);

select public.resolve_message_business_identity(
'00000000-0000-0000-0000-000000003310'
) as unknown_result \gset

select pg_temp.assert_true(
  :'unknown_result'::jsonb->>'status'='blocked_missing_verified_contact',
  'same/related domain without exact verified Contact must remain blocked'
);

reset role;

select pg_temp.assert_raises(
  $$update public.commercial_identity_resolutions set basis='exact_email' where id=(select min(id) from public.commercial_identity_resolutions)$$,
  'commercial_identity_resolutions is append-only'
);

rollback;
