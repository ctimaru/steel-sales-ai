-- PA2.17 controlled Offer promotion acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.17 assertion failed: %',message; end if;
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
('00000000-0000-0000-0000-0000000032a1','pa217@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values('00000000-0000-0000-0000-0000000032f1','PA217 Org','pa217-org',
'00000000-0000-0000-0000-0000000032a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values('00000000-0000-0000-0000-0000000032f1',
'00000000-0000-0000-0000-0000000032a1','admin','sales_director','active',true);

insert into public.commercial_datasets(id,owner_id,source_run_id,source_filename,organization_id)
values('00000000-0000-0000-0000-000000003201','00000000-0000-0000-0000-0000000032a1',
'00000000-0000-0000-0000-000000003211','pa217.eml','00000000-0000-0000-0000-0000000032f1');

insert into public.commercial_threads(
id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values
('00000000-0000-0000-0000-000000003221','00000000-0000-0000-0000-0000000032a1','00000000-0000-0000-0000-000000003201','00000000-0000-0000-0000-000000003231','complete offer','offer',now(),'00000000-0000-0000-0000-0000000032f1'),
('00000000-0000-0000-0000-000000003222','00000000-0000-0000-0000-0000000032a1','00000000-0000-0000-0000-000000003201','00000000-0000-0000-0000-000000003232','blocked offer','offer',now(),'00000000-0000-0000-0000-0000000032f1');

insert into public.commercial_observations(
id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
price_value,price_unit,currency,source_filename,source_text,confidence,search_text,
canonical_product_id,canonical_product_key,organization_id
) values
(32001,'00000000-0000-0000-0000-0000000032a1','00000000-0000-0000-0000-000000003201','00000000-0000-0000-0000-000000003221','00000000-0000-0000-0000-000000003231','offered','outbound','round_tube','S355',273,8,12000,20,'T',68.38,'M','EUR','pa217.eml','S355 273x8 12000 - 20 t - EUR/M 68.38',0.97,'offer 273x8','33333333-3333-3333-3333-333333333331','tube:v1|family=round_tube|grade=s355|standard=_|material=_|geom=od:273|t=8|process=_','00000000-0000-0000-0000-0000000032f1'),
(32002,'00000000-0000-0000-0000-0000000032a1','00000000-0000-0000-0000-000000003201','00000000-0000-0000-0000-000000003221','00000000-0000-0000-0000-000000003231','offered','outbound','round_tube','S355',323.9,8,12000,20,'T',79.10,'M','EUR','pa217.eml','S355 323.9x8 12000 - 20 t - EUR/M 79.10',0.98,'offer 323x8','33333333-3333-3333-3333-333333333332','tube:v1|family=round_tube|grade=s355|standard=_|material=_|geom=od:323.9|t=8|process=_','00000000-0000-0000-0000-0000000032f1'),
(32003,'00000000-0000-0000-0000-0000000032a1','00000000-0000-0000-0000-000000003201','00000000-0000-0000-0000-000000003222','00000000-0000-0000-0000-000000003232','offered','outbound','round_tube','S355',406.4,8,12000,20,'T',null,null,'EUR','pa217.eml','price missing',0.97,'offer blocked','33333333-3333-3333-3333-333333333333','tube:v1|family=round_tube|grade=s355|standard=_|material=_|geom=od:406.4|t=8|process=_','00000000-0000-0000-0000-0000000032f1'),
(32004,'00000000-0000-0000-0000-0000000032a1','00000000-0000-0000-0000-000000003201','00000000-0000-0000-0000-000000003222','00000000-0000-0000-0000-000000003232','offered','outbound','round_tube','S355',508,10,12000,20,'T',100,'M','EUR','pa217.eml','complete sibling',0.97,'offer sibling','33333333-3333-3333-3333-333333333334','tube:v1|family=round_tube|grade=s355|standard=_|material=_|geom=od:508|t=10|process=_','00000000-0000-0000-0000-0000000032f1');

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000032a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p1_offer_promotion_readiness('00000000-0000-0000-0000-0000000032f1',100)#>>'{summary,ready_threads}')::int=1,
  'exactly one complete outbound Offer thread must be ready'
);

select pg_temp.assert_true(
  exists (
    select 1 from jsonb_array_elements(public.p1_offer_promotion_readiness('00000000-0000-0000-0000-0000000032f1',100)->'threads') x
    where x->>'thread_id'='00000000-0000-0000-0000-000000003222'
      and x->>'readiness_status'='blocked'
      and x->'reasons' ? 'missing_price'
      and x->'reasons' ? 'incomplete_offer_thread'
  ),
  'incomplete Offer thread must expose blockers'
);

select public.p1_promote_ready_offer_thread(
'00000000-0000-0000-0000-0000000032f1','00000000-0000-0000-0000-000000003221') as first_result \gset

select pg_temp.assert_true(
  :'first_result'::jsonb->>'status'='promoted'
  and (:'first_result'::jsonb->>'line_count')::int=2
  and (select count(*) from public.offers)=1
  and (select count(*) from public.offer_lines where offer_id=(:'first_result'::jsonb->>'offer_id')::uuid)=2
  and (select count(*) from public.current_commercial_entity_promotions where observation_id in (32001,32002) and entity_type='offer_line' and status='applied')=2,
  'ready Offer thread must create one Offer, two lines and two immutable promotions'
);

select pg_temp.assert_true(
  exists (
    select 1 from public.offers
    where id=(:'first_result'::jsonb->>'offer_id')::uuid
      and company_id is null
      and rfq_id is null
      and conversation_id is null
      and status='sent'
      and currency='EUR'
  ),
  'Offer promotion must not infer Company, RFQ or normalized Conversation'
);

select public.p1_promote_ready_offer_thread(
'00000000-0000-0000-0000-0000000032f1','00000000-0000-0000-0000-000000003221') as second_result \gset

select pg_temp.assert_true(
  :'second_result'::jsonb->>'status'='already_promoted'
  and :'second_result'::jsonb->>'offer_id'=:'first_result'::jsonb->>'offer_id'
  and (select count(*) from public.offer_lines where offer_id=(:'first_result'::jsonb->>'offer_id')::uuid)=2,
  'repeat Offer promotion must be idempotent'
);

select public.p1_promote_ready_offer_thread(
'00000000-0000-0000-0000-0000000032f1','00000000-0000-0000-0000-000000003222') as blocked_result \gset

select pg_temp.assert_true(
  :'blocked_result'::jsonb->>'status'='blocked'
  and (select count(*) from public.offer_lines where source_observation_id in (32003,32004))=0,
  'blocked Offer thread must create no business entity'
);

rollback;
