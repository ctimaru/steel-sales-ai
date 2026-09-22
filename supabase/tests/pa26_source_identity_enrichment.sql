-- PA2.6 source identity enrichment acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.6 assertion failed: %',message; end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000031a1','pa26@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000031f1','PA26 Org','pa26-org',
'00000000-0000-0000-0000-0000000031a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000031f1',
'00000000-0000-0000-0000-0000000031a1',
'admin','sales_director','active',true);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,organization_id
) values(
'00000000-0000-0000-0000-000000003101',
'00000000-0000-0000-0000-0000000031a1',
'00000000-0000-0000-0000-000000003111',
'pa26.eml',
'00000000-0000-0000-0000-0000000031f1');

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,started_at,last_activity_at,organization_id
) values(
'00000000-0000-0000-0000-000000003121',
'00000000-0000-0000-0000-0000000031a1',
'00000000-0000-0000-0000-000000003101',
'00000000-0000-0000-0000-000000003131',
'PA26 RFQ source',
'rfq',
now()-interval '1 day',
now(),
'00000000-0000-0000-0000-0000000031f1');

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
source_filename,source_text,confidence,search_text,organization_id
) values
(31001,'00000000-0000-0000-0000-0000000031a1','00000000-0000-0000-0000-000000003101','00000000-0000-0000-0000-000000003121','00000000-0000-0000-0000-000000003131','requested','inbound','round_tube','S355',273,8,12000,2,'PACCHI','pa26.eml','S355 273x8 12000',0.96,'s355 273x8 12000','00000000-0000-0000-0000-0000000031f1'),
(31002,'00000000-0000-0000-0000-0000000031a1','00000000-0000-0000-0000-000000003101','00000000-0000-0000-0000-000000003121','00000000-0000-0000-0000-000000003131','requested','inbound','round_tube','S355',323.9,8,12000,1,'PZ','pa26.eml','S355 323.9x8 12000',0.96,'s355 323.9x8 12000','00000000-0000-0000-0000-0000000031f1');

insert into public.rfqs(
id,owner_id,organization_id,assigned_to_user_id,created_by_user_id,requested_at,status,priority
) values(
'00000000-0000-0000-0000-000000003141',
'00000000-0000-0000-0000-0000000031a1',
'00000000-0000-0000-0000-0000000031f1',
'00000000-0000-0000-0000-0000000031a1',
'00000000-0000-0000-0000-0000000031a1',
now(),'new','normal');

insert into public.rfq_lines(
id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,requested_grade,
min_length_mm,max_length_mm,canonical_product_id,canonical_product_key,source_observation_id,raw_spec_text
)
select
case when o.id=31001 then '00000000-0000-0000-0000-000000003142'::uuid
     else '00000000-0000-0000-0000-000000003143'::uuid end,
o.owner_id,o.organization_id,'00000000-0000-0000-0000-000000003141',
o.quantity,o.quantity_unit,o.grade,o.length_mm,o.length_mm,o.canonical_product_id,o.canonical_product_key,o.id,o.source_text
from public.commercial_observations o
where o.id in (31001,31002);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000031a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.record_commercial_entity_promotion(
'00000000-0000-0000-0000-0000000031f1',31001,'rfq_line',
'00000000-0000-0000-0000-000000003142',
null,'created','applied',0.96,'deterministic_match',null,null,'{"phase":"pa26"}'::jsonb
);

select public.record_commercial_entity_promotion(
'00000000-0000-0000-0000-0000000031f1',31002,'rfq_line',
'00000000-0000-0000-0000-000000003143',
null,'created','applied',0.96,'deterministic_match',null,null,'{"phase":"pa26"}'::jsonb
);

reset role;

select pg_temp.assert_true(
  (public.p1_rfq_identity_readiness('00000000-0000-0000-0000-0000000031f1',100)#>>'{summary,conversation_ready}')::int=1,
  'promoted RFQ must be conversation-ready before enrichment'
);

select pg_temp.assert_true(
  (public.p1_rfq_identity_readiness('00000000-0000-0000-0000-0000000031f1',100)#>>'{summary,message_linked}')::int=0
  and (public.p1_rfq_identity_readiness('00000000-0000-0000-0000-0000000031f1',100)#>>'{summary,company_linked}')::int=0
  and (public.p1_rfq_identity_readiness('00000000-0000-0000-0000-0000000031f1',100)#>>'{summary,contact_linked}')::int=0,
  'message/company/contact must remain unlinked without structured evidence'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000031a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.enrich_promoted_rfq_source('00000000-0000-0000-0000-000000003141') as first_result \gset

select pg_temp.assert_true(
  :'first_result'::jsonb->>'status'='enriched'
  and (select count(*) from public.conversations)=1
  and (select conversation_id is not null from public.rfqs where id='00000000-0000-0000-0000-000000003141')
  and (select count(*) from public.messages)=0
  and (select count(*) from public.companies)=0
  and (select count(*) from public.contacts)=0,
  'enrichment must create only one normalized conversation and link the RFQ'
);

select public.enrich_promoted_rfq_source('00000000-0000-0000-0000-000000003141') as second_result \gset

select pg_temp.assert_true(
  :'second_result'::jsonb->>'status'='already_enriched'
  and :'second_result'::jsonb->>'conversation_id'=:'first_result'::jsonb->>'conversation_id'
  and (select count(*) from public.conversations)=1,
  'repeat enrichment must be idempotent'
);

reset role;

select pg_temp.assert_true(
  (public.p1_rfq_identity_readiness('00000000-0000-0000-0000-0000000031f1',100)#>>'{summary,conversation_linked}')::int=1,
  'readiness must reflect linked conversation after enrichment'
);

rollback;
