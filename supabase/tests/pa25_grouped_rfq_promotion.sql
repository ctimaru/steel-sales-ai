-- PA2.5 grouped / multi-line RFQ promotion acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.5 assertion failed: %',message; end if;
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
  raise exception 'Expected failure: %', expected_fragment;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000030a1','pa25@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values(
'00000000-0000-0000-0000-0000000030f1','PA25 Org','pa25-org',
'00000000-0000-0000-0000-0000000030a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values(
'00000000-0000-0000-0000-0000000030f1',
'00000000-0000-0000-0000-0000000030a1',
'admin','sales_director','active',true);

insert into public.commercial_datasets(
id,owner_id,source_run_id,source_filename,organization_id
) values(
'00000000-0000-0000-0000-000000003001',
'00000000-0000-0000-0000-0000000030a1',
'00000000-0000-0000-0000-000000003011',
'pa25.eml',
'00000000-0000-0000-0000-0000000030f1');

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
('00000000-0000-0000-0000-000000003021','00000000-0000-0000-0000-0000000030a1','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003031','ready multi','rfq',now(),'00000000-0000-0000-0000-0000000030f1'),
('00000000-0000-0000-0000-000000003022','00000000-0000-0000-0000-0000000030a1','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003032','blocked multi','rfq',now(),'00000000-0000-0000-0000-0000000030f1'),
('00000000-0000-0000-0000-000000003023','00000000-0000-0000-0000-0000000030a1','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003033','partial multi','rfq',now(),'00000000-0000-0000-0000-0000000030f1');

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,width_mm,height_mm,thickness_mm,length_mm,
quantity,quantity_unit,source_filename,source_text,confidence,search_text,organization_id
) values
(30001,'00000000-0000-0000-0000-0000000030a1','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003021','00000000-0000-0000-0000-000000003031','requested','inbound','round_tube','S355',273,null,null,8,12000,2,'PACCHI','pa25.eml','S355 273x8 12000 2 pacchi',0.96,'s355 273x8 12000','00000000-0000-0000-0000-0000000030f1'),
(30002,'00000000-0000-0000-0000-0000000030a1','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003021','00000000-0000-0000-0000-000000003031','requested','inbound','square_tube','S355',null,100,100,6,6000,10,'PZ','pa25.eml','S355 100x100x6 6000 10 pz',0.97,'s355 100x100x6 6000','00000000-0000-0000-0000-0000000030f1'),
(30003,'00000000-0000-0000-0000-0000000030a1','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003022','00000000-0000-0000-0000-000000003032','requested','inbound','round_tube','S355',323.9,null,null,8,null,1,'PZ','pa25.eml','missing length',0.96,'s355 323.9x8','00000000-0000-0000-0000-0000000030f1'),
(30004,'00000000-0000-0000-0000-0000000030a1','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003022','00000000-0000-0000-0000-000000003032','requested','inbound','round_tube','S355',406.4,null,null,8,12000,1,'PZ','pa25.eml','complete sibling',0.96,'s355 406.4x8','00000000-0000-0000-0000-0000000030f1'),
(30005,'00000000-0000-0000-0000-0000000030a1','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003023','00000000-0000-0000-0000-000000003033','requested','inbound','round_tube','S355',508,null,null,10,12000,1,'PZ','pa25.eml','partial first',0.96,'s355 508x10','00000000-0000-0000-0000-0000000030f1'),
(30006,'00000000-0000-0000-0000-0000000030a1','00000000-0000-0000-0000-000000003001','00000000-0000-0000-0000-000000003023','00000000-0000-0000-0000-000000003033','requested','inbound','round_tube','S355',610,null,null,12,12000,1,'PZ','pa25.eml','partial second',0.96,'s355 610x12','00000000-0000-0000-0000-0000000030f1');

-- Seed a partial promotion state on one line of thread 30023.
insert into public.rfqs(
id,owner_id,organization_id,assigned_to_user_id,created_by_user_id,requested_at,status,priority
) values(
'00000000-0000-0000-0000-000000003041',
'00000000-0000-0000-0000-0000000030a1',
'00000000-0000-0000-0000-0000000030f1',
'00000000-0000-0000-0000-0000000030a1',
'00000000-0000-0000-0000-0000000030a1',
now(),'new','normal');

insert into public.rfq_lines(
id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,requested_grade,
min_length_mm,max_length_mm,canonical_product_id,canonical_product_key,source_observation_id,raw_spec_text
)
select
'00000000-0000-0000-0000-000000003042',
o.owner_id,o.organization_id,
'00000000-0000-0000-0000-000000003041',
o.quantity,o.quantity_unit,o.grade,o.length_mm,o.length_mm,o.canonical_product_id,o.canonical_product_key,o.id,o.source_text
from public.commercial_observations o where o.id=30005;

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000030a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.record_commercial_entity_promotion(
'00000000-0000-0000-0000-0000000030f1',30005,'rfq_line',
'00000000-0000-0000-0000-000000003042',
null,'created','applied',0.96,'deterministic_match',null,null,'{"phase":"fixture"}'::jsonb
);

reset role;

select pg_temp.assert_true(
  (public.p1_grouped_rfq_readiness('00000000-0000-0000-0000-0000000030f1',100)#>>'{summary,ready}')::int=1,
  'one multi-line thread must be ready'
);

select pg_temp.assert_true(
  exists (
    select 1 from jsonb_array_elements(public.p1_grouped_rfq_readiness('00000000-0000-0000-0000-0000000030f1',100)->'threads') x
    where x->>'thread_id'='00000000-0000-0000-0000-000000003022'
      and x->>'readiness_status'='blocked'
      and x->'reasons' ? 'missing_length'
  ),
  'blocked group must expose line blocker reasons'
);

select pg_temp.assert_true(
  exists (
    select 1 from jsonb_array_elements(public.p1_grouped_rfq_readiness('00000000-0000-0000-0000-0000000030f1',100)->'threads') x
    where x->>'thread_id'='00000000-0000-0000-0000-000000003023'
      and x->>'readiness_status'='partial_promoted'
      and x->'reasons' ? 'partial_promotion_state'
  ),
  'partial group must be explicitly blocked'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000030a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.promote_requested_thread('00000000-0000-0000-0000-000000003021') as first_result \gset

select pg_temp.assert_true(
  :'first_result'::jsonb->>'status'='promoted'
  and (:'first_result'::jsonb->>'line_count')::int=2
  and (select count(*) from public.rfqs)=2
  and (select count(*) from public.rfq_lines where rfq_id=(:'first_result'::jsonb->>'rfq_id')::uuid)=2
  and (select count(*) from public.commercial_entity_promotions where observation_id in (30001,30002))=2,
  'ready multi-line thread must become one RFQ with two lines and two promotions'
);

select public.promote_requested_thread('00000000-0000-0000-0000-000000003021') as second_result \gset

select pg_temp.assert_true(
  :'second_result'::jsonb->>'status'='already_promoted'
  and :'second_result'::jsonb->>'rfq_id'=:'first_result'::jsonb->>'rfq_id'
  and (select count(*) from public.rfq_lines where rfq_id=(:'first_result'::jsonb->>'rfq_id')::uuid)=2,
  'repeat grouped promotion must be idempotent'
);

select public.promote_requested_thread('00000000-0000-0000-0000-000000003022') as blocked_result \gset

select pg_temp.assert_true(
  :'blocked_result'::jsonb->>'status'='blocked'
  and (:'blocked_result'::jsonb->>'eligible_line_count')::int=1,
  'blocked thread must create nothing'
);

select pg_temp.assert_raises(
  $$select public.promote_requested_thread('00000000-0000-0000-0000-000000003023')$$,
  'Partial promotion state blocks grouped promotion'
);

reset role;
rollback;
