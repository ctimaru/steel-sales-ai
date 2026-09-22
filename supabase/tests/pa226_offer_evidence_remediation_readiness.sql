-- PA2.26 Offer evidence remediation readiness acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.26 assertion failed: %',message; end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000039a1','pa226@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000039f1','PA226 Org','pa226-org',
'00000000-0000-0000-0000-0000000039a1','completed'
);

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000039f1',
'00000000-0000-0000-0000-0000000039a1',
'admin','sales_director','active',true
);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,organization_id
) values(
'00000000-0000-0000-0000-000000003901',
'00000000-0000-0000-0000-0000000039a1',
'00000000-0000-0000-0000-000000003911',
'pa226.eml',
'00000000-0000-0000-0000-0000000039f1'
);

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,started_at,last_activity_at,email_count,organization_id
) values
('00000000-0000-0000-0000-000000003921','00000000-0000-0000-0000-0000000039a1','00000000-0000-0000-0000-000000003901','00000000-0000-0000-0000-000000003931','Direction conflict','offer',now(),now(),1,'00000000-0000-0000-0000-0000000039f1'),
('00000000-0000-0000-0000-000000003922','00000000-0000-0000-0000-0000000039a1','00000000-0000-0000-0000-000000003901','00000000-0000-0000-0000-000000003932','Mixed scope','offer',now(),now(),1,'00000000-0000-0000-0000-0000000039f1'),
('00000000-0000-0000-0000-000000003923','00000000-0000-0000-0000-0000000039a1','00000000-0000-0000-0000-000000003901','00000000-0000-0000-0000-000000003933','Product gap','offer',now(),now(),1,'00000000-0000-0000-0000-0000000039f1'),
('00000000-0000-0000-0000-000000003924','00000000-0000-0000-0000-0000000039a1','00000000-0000-0000-0000-000000003901','00000000-0000-0000-0000-000000003934','Source reparse','offer',now(),now(),1,'00000000-0000-0000-0000-0000000039f1');

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,quantity,quantity_unit,
price_value,price_unit,currency,source_filename,source_text,confidence,search_text,organization_id
) values
(39001,'00000000-0000-0000-0000-0000000039a1','00000000-0000-0000-0000-000000003901','00000000-0000-0000-0000-000000003921','00000000-0000-0000-0000-000000003931','offered','inbound','round_tube','S355',193.7,10,25,'T',40.77,'M','EUR','pa226.eml','complete values but inbound',0.98,'direction conflict','00000000-0000-0000-0000-0000000039f1'),
(39002,'00000000-0000-0000-0000-0000000039a1','00000000-0000-0000-0000-000000003901','00000000-0000-0000-0000-000000003922','00000000-0000-0000-0000-000000003932','offered','outbound','round_tube','S355',273,8,10,'T',20,'M','EUR','pa226.eml','complete line',0.98,'mixed complete','00000000-0000-0000-0000-0000000039f1'),
(39003,'00000000-0000-0000-0000-0000000039a1','00000000-0000-0000-0000-000000003901','00000000-0000-0000-0000-000000003922','00000000-0000-0000-0000-000000003932','offered','outbound','round_tube','S355',323.9,8,5,'T',null,null,null,'pa226.eml','unique incomplete line',0.98,'mixed incomplete','00000000-0000-0000-0000-0000000039f1'),
(39004,'00000000-0000-0000-0000-0000000039a1','00000000-0000-0000-0000-000000003901','00000000-0000-0000-0000-000000003923','00000000-0000-0000-0000-000000003933','offered','outbound',null,null,null,null,null,null,null,null,null,'pa226.eml','unresolved product evidence',0.98,'product gap','00000000-0000-0000-0000-0000000039f1'),
(39005,'00000000-0000-0000-0000-0000000039a1','00000000-0000-0000-0000-000000003901','00000000-0000-0000-0000-000000003924','00000000-0000-0000-0000-000000003934','offered','outbound','round_tube','S355',406.4,6.3,null,null,null,null,null,'pa226.eml','406,4x6,3 available',0.98,'source reparse','00000000-0000-0000-0000-0000000039f1');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000039a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p1_offer_evidence_remediation_readiness(
    '00000000-0000-0000-0000-0000000039f1',100
  )#>>'{summary,blocked_threads}')::int=4,
  'four blocked Offer threads must be classified'
);

select pg_temp.assert_true(
  (public.p1_offer_evidence_remediation_readiness('00000000-0000-0000-0000-0000000039f1',100)#>>'{summary,direction_conflict}')::int=1
  and (public.p1_offer_evidence_remediation_readiness('00000000-0000-0000-0000-0000000039f1',100)#>>'{summary,mixed_complete_unique_incomplete}')::int=1
  and (public.p1_offer_evidence_remediation_readiness('00000000-0000-0000-0000-0000000039f1',100)#>>'{summary,product_identity_gap}')::int=1
  and (public.p1_offer_evidence_remediation_readiness('00000000-0000-0000-0000-0000000039f1',100)#>>'{summary,source_reparse_required}')::int=1,
  'exclusive remediation categories must classify one thread each'
);

select public.p1_enqueue_offer_remediation_thread(
  '00000000-0000-0000-0000-0000000039f1',
  '00000000-0000-0000-0000-000000003924'
) as first_result \gset

select pg_temp.assert_true(
  :'first_result'::jsonb->>'status'='enqueued'
  and :'first_result'::jsonb->>'category'='source_reparse_required'
  and :'first_result'::jsonb->>'recommended_action'='source_email_reparse',
  'source reparse thread must enqueue with the expected action'
);

select pg_temp.assert_true(
  (select count(*) from public.commercial_offer_remediation_queue
   where organization_id='00000000-0000-0000-0000-0000000039f1')=1
  and (select price_value from public.commercial_observations where id=39005) is null,
  'queue enrollment must not mutate Offer evidence'
);

select public.p1_enqueue_offer_remediation_thread(
  '00000000-0000-0000-0000-0000000039f1',
  '00000000-0000-0000-0000-000000003924'
) as repeat_result \gset

select pg_temp.assert_true(
  :'repeat_result'::jsonb->>'status'='already_enqueued'
  and (select count(*) from public.commercial_offer_remediation_queue
       where organization_id='00000000-0000-0000-0000-0000000039f1')=1,
  'queue enrollment must be idempotent'
);

rollback;
