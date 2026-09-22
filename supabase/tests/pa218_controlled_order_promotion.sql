-- PA2.18 controlled Order promotion acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.18 assertion failed: %',message; end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000033a1','pa218@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values('00000000-0000-0000-0000-0000000033f1','PA218 Org','pa218-org',
'00000000-0000-0000-0000-0000000033a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values('00000000-0000-0000-0000-0000000033f1',
'00000000-0000-0000-0000-0000000033a1','admin','sales_director','active',true);

insert into public.commercial_datasets(id,owner_id,source_run_id,source_filename,organization_id)
values('00000000-0000-0000-0000-000000003301','00000000-0000-0000-0000-0000000033a1',
'00000000-0000-0000-0000-000000003311','pa218.eml','00000000-0000-0000-0000-0000000033f1');

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
('00000000-0000-0000-0000-000000003321','00000000-0000-0000-0000-0000000033a1','00000000-0000-0000-0000-000000003301','00000000-0000-0000-0000-000000003331','complete order','order',now(),'00000000-0000-0000-0000-0000000033f1'),
('00000000-0000-0000-0000-000000003322','00000000-0000-0000-0000-0000000033a1','00000000-0000-0000-0000-000000003301','00000000-0000-0000-0000-000000003332','blocked order','order',now(),'00000000-0000-0000-0000-0000000033f1');

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
price_value,price_unit,currency,source_filename,source_text,confidence,search_text,
organization_id
) values
(33001,'00000000-0000-0000-0000-0000000033a1','00000000-0000-0000-0000-000000003301','00000000-0000-0000-0000-000000003321','00000000-0000-0000-0000-000000003331','ordered','inbound','round_tube','S355',273,8,12000,20,'T',68.38,'M','EUR','pa218.eml','Order S355 273x8 12000 - 20 t - EUR/M 68.38',0.97,'order 273x8','00000000-0000-0000-0000-0000000033f1'),
(33002,'00000000-0000-0000-0000-0000000033a1','00000000-0000-0000-0000-000000003301','00000000-0000-0000-0000-000000003321','00000000-0000-0000-0000-000000003331','ordered','inbound','round_tube','S355',323.9,8,12000,10,'PZ',null,null,null,'pa218.eml','Order S355 323.9x8 12000 - 10 pezzi',0.98,'order 323x8','00000000-0000-0000-0000-0000000033f1'),
(33003,'00000000-0000-0000-0000-0000000033a1','00000000-0000-0000-0000-000000003301','00000000-0000-0000-0000-000000003322','00000000-0000-0000-0000-000000003332','ordered','inbound','round_tube','S355',406.4,8,12000,null,null,null,null,null,'pa218.eml','Order quantity missing',0.97,'order blocked','00000000-0000-0000-0000-0000000033f1'),
(33004,'00000000-0000-0000-0000-0000000033a1','00000000-0000-0000-0000-000000003301','00000000-0000-0000-0000-000000003322','00000000-0000-0000-0000-000000003332','ordered','inbound','round_tube','S355',508,10,12000,5,'T',null,null,null,'pa218.eml','Complete sibling order',0.97,'order sibling','00000000-0000-0000-0000-0000000033f1');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000033a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p1_order_promotion_readiness('00000000-0000-0000-0000-0000000033f1',100)#>>'{summary,ready_threads}')::int=1,
  'exactly one complete inbound Order thread must be ready'
);

select pg_temp.assert_true(
  exists (
    select 1 from jsonb_array_elements(public.p1_order_promotion_readiness('00000000-0000-0000-0000-0000000033f1',100)->'threads') x
    where x->>'thread_id'='00000000-0000-0000-0000-000000003322'
      and x->>'readiness_status'='blocked'
      and x->'reasons' ? 'missing_quantity'
      and x->'reasons' ? 'incomplete_order_thread'
  ),
  'incomplete Order thread must expose blockers'
);

select public.p1_promote_ready_order_thread(
'00000000-0000-0000-0000-0000000033f1','00000000-0000-0000-0000-000000003321') as first_result \gset

select pg_temp.assert_true(
  :'first_result'::jsonb->>'status'='promoted'
  and (:'first_result'::jsonb->>'line_count')::int=2
  and (select count(*) from public.orders)=1
  and (select count(*) from public.order_lines where order_id=(:'first_result'::jsonb->>'order_id')::uuid)=2
  and (select count(*) from public.current_commercial_entity_promotions where observation_id in (33001,33002) and entity_type='order_line' and status='applied')=2,
  'ready Order thread must create one Order, two lines and two immutable promotions'
);

select pg_temp.assert_true(
  exists (
    select 1 from public.orders
    where id=(:'first_result'::jsonb->>'order_id')::uuid
      and company_id is null and rfq_id is null and offer_id is null
      and conversation_id is null and status='received'
  ),
  'Order promotion must not infer Company, RFQ, Offer or normalized Conversation'
);

select pg_temp.assert_true(
  exists(select 1 from public.order_lines where source_observation_id=33001 and unit_price=68.38 and price_unit='M')
  and exists(select 1 from public.order_lines where source_observation_id=33002 and unit_price is null and price_unit is null),
  'optional price must be preserved when present and remain null when absent'
);

select public.p1_promote_ready_order_thread(
'00000000-0000-0000-0000-0000000033f1','00000000-0000-0000-0000-000000003321') as second_result \gset

select pg_temp.assert_true(
  :'second_result'::jsonb->>'status'='already_promoted'
  and :'second_result'::jsonb->>'order_id'=:'first_result'::jsonb->>'order_id'
  and (select count(*) from public.order_lines where order_id=(:'first_result'::jsonb->>'order_id')::uuid)=2,
  'repeat Order promotion must be idempotent'
);

select public.p1_promote_ready_order_thread(
'00000000-0000-0000-0000-0000000033f1','00000000-0000-0000-0000-000000003322') as blocked_result \gset

select pg_temp.assert_true(
  :'blocked_result'::jsonb->>'status'='blocked'
  and (select count(*) from public.order_lines where source_observation_id in (33003,33004))=0,
  'blocked Order thread must create no business entity'
);

rollback;
