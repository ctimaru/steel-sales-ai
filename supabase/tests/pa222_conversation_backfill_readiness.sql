-- PA2.22 controlled Conversation backfill acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.22 assertion failed: %',message; end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000036a1','pa222@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000036f1','PA222 Org','pa222-org',
'00000000-0000-0000-0000-0000000036a1','completed'
);

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-0000000036a1',
'admin','sales_director','active',true
);

insert into public.conversations(
id,owner_id,organization_id,subject,external_thread_id,status
) values
(
'00000000-0000-0000-0000-000000003601',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'Message conversation','pa222-message-thread','open'
),
(
'00000000-0000-0000-0000-000000003602',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'Observation conversation','00000000-0000-0000-0000-000000003632','open'
);

insert into public.messages(
id,owner_id,organization_id,conversation_id,external_message_id,direction,subject
) values(
'00000000-0000-0000-0000-000000003611',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003601',
'pa222-message-1','inbound','Order'
);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,organization_id
) values(
'00000000-0000-0000-0000-000000003621',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-000000003631',
'pa222.eml',
'00000000-0000-0000-0000-0000000036f1'
);

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values(
'00000000-0000-0000-0000-000000003622',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-000000003621',
'00000000-0000-0000-0000-000000003632',
'RFQ source conversation','rfq',now(),
'00000000-0000-0000-0000-0000000036f1'
);

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
source_filename,source_text,confidence,search_text,organization_id
) values(
36001,
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-000000003621',
'00000000-0000-0000-0000-000000003622',
'00000000-0000-0000-0000-000000003632',
'requested','inbound','round_tube','S355',273,8,12000,10,'PZ',
'pa222.eml','RFQ 273x8',0.99,'rfq 273x8',
'00000000-0000-0000-0000-0000000036f1'
);

insert into public.rfqs(
id,owner_id,organization_id,status,priority,requested_at
) values(
'00000000-0000-0000-0000-000000003641',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'new','normal',now()
);

insert into public.rfq_lines(
id,owner_id,organization_id,rfq_id,source_observation_id,raw_spec_text
) values(
'00000000-0000-0000-0000-000000003651',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003641',
36001,'RFQ 273x8'
);

insert into public.orders(
id,owner_id,organization_id,source_message_id,status,ordered_at
) values(
'00000000-0000-0000-0000-000000003642',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003611',
'received',now()
);

insert into public.order_lines(
id,owner_id,organization_id,order_id,raw_spec_text
) values(
'00000000-0000-0000-0000-000000003652',
'00000000-0000-0000-0000-0000000036a1',
'00000000-0000-0000-0000-0000000036f1',
'00000000-0000-0000-0000-000000003642',
'Order from source message'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000036a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p1_conversation_backfill_readiness(
    '00000000-0000-0000-0000-0000000036f1',100
  )#>>'{summary,ready}')::int=2,
  'two entities must be ready from structured Conversation identity'
);

select pg_temp.assert_true(
  exists(
    select 1
    from jsonb_array_elements(public.p1_conversation_backfill_readiness(
      '00000000-0000-0000-0000-0000000036f1',100
    )->'candidates') x
    where x->>'entity_type'='order'
      and x->>'entity_id'='00000000-0000-0000-0000-000000003642'
      and x->>'candidate_conversation_id'='00000000-0000-0000-0000-000000003601'
      and x->>'evidence_type'='source_message'
  ),
  'Order must resolve exactly via source_message_id'
);

select pg_temp.assert_true(
  exists(
    select 1
    from jsonb_array_elements(public.p1_conversation_backfill_readiness(
      '00000000-0000-0000-0000-0000000036f1',100
    )->'candidates') x
    where x->>'entity_type'='rfq'
      and x->>'entity_id'='00000000-0000-0000-0000-000000003641'
      and x->>'candidate_conversation_id'='00000000-0000-0000-0000-000000003602'
      and x->>'evidence_type'='source_conversation_id'
  ),
  'RFQ must resolve exactly via observation source_conversation_id'
);

select public.p1_apply_conversation_backfill(
  '00000000-0000-0000-0000-0000000036f1',
  'order',
  '00000000-0000-0000-0000-000000003642',
  '00000000-0000-0000-0000-000000003601'
) as order_result \gset

select public.p1_apply_conversation_backfill(
  '00000000-0000-0000-0000-0000000036f1',
  'rfq',
  '00000000-0000-0000-0000-000000003641',
  '00000000-0000-0000-0000-000000003602'
) as rfq_result \gset

select pg_temp.assert_true(
  :'order_result'::jsonb->>'status'='applied'
  and :'rfq_result'::jsonb->>'status'='applied',
  'both explicit backfills must apply'
);

select pg_temp.assert_true(
  (select conversation_id from public.orders
   where id='00000000-0000-0000-0000-000000003642')
   ='00000000-0000-0000-0000-000000003601'
  and
  (select conversation_id from public.rfqs
   where id='00000000-0000-0000-000000003641')
   ='00000000-0000-0000-0000-000000003602',
  'normalized entities must receive only the expected Conversation IDs'
);

select pg_temp.assert_true(
  (select count(*) from public.commercial_conversation_backfills
   where organization_id='00000000-0000-0000-0000-0000000036f1')=2,
  'two immutable backfill audit rows must be recorded'
);

select public.p1_apply_conversation_backfill(
  '00000000-0000-0000-0000-0000000036f1',
  'order',
  '00000000-0000-0000-0000-000000003642',
  '00000000-0000-0000-0000-000000003601'
) as repeat_result \gset

select pg_temp.assert_true(
  :'repeat_result'::jsonb->>'status'='already_applied'
  and (select count(*) from public.commercial_conversation_backfills
       where organization_id='00000000-0000-0000-0000-0000000036f1')=2,
  'Conversation backfill must be idempotent'
);

rollback;
