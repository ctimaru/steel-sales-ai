-- PA2.21 controlled operational relationship activation acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.21 assertion failed: %',message; end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000035a1','pa221@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values('00000000-0000-0000-0000-0000000035f1','PA221 Org','pa221-org',
'00000000-0000-0000-0000-0000000035a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values('00000000-0000-0000-0000-0000000035f1',
'00000000-0000-0000-0000-0000000035a1','admin','sales_director','active',true);

insert into public.conversations(
id,owner_id,organization_id,subject,external_thread_id,status
) values(
'00000000-0000-0000-0000-000000003501',
'00000000-0000-0000-0000-0000000035a1',
'00000000-0000-0000-0000-0000000035f1',
'PA221 chain','pa221-thread','open'
);

insert into public.rfqs(
id,owner_id,organization_id,conversation_id,status,priority,requested_at
) values(
'00000000-0000-0000-0000-000000003511',
'00000000-0000-0000-0000-0000000035a1',
'00000000-0000-0000-0000-0000000035f1',
'00000000-0000-0000-0000-000000003501',
'new','normal',now()
);

insert into public.rfq_lines(
id,owner_id,organization_id,rfq_id,canonical_product_key,raw_spec_text
) values(
'00000000-0000-0000-0000-000000003521',
'00000000-0000-0000-0000-0000000035a1',
'00000000-0000-0000-0000-0000000035f1',
'00000000-0000-0000-0000-000000003511',
'tube:v1|family=round_tube|grade=s355|standard=en10219|material=_|geom=od:273|t=8|process=_',
'RFQ 273x8'
);

insert into public.offers(
id,owner_id,organization_id,conversation_id,status,currency,offered_at
) values(
'00000000-0000-0000-0000-000000003512',
'00000000-0000-0000-0000-0000000035a1',
'00000000-0000-0000-0000-0000000035f1',
'00000000-0000-0000-0000-000000003501',
'sent','EUR',now()
);

insert into public.offer_lines(
id,owner_id,organization_id,offer_id,canonical_product_key,raw_spec_text
) values(
'00000000-0000-0000-0000-000000003522',
'00000000-0000-0000-0000-0000000035a1',
'00000000-0000-0000-0000-0000000035f1',
'00000000-0000-0000-0000-000000003512',
'tube:v1|family=round_tube|grade=s355|standard=en10219|material=_|geom=od:273|t=8|process=_',
'Offer 273x8'
);

insert into public.orders(
id,owner_id,organization_id,conversation_id,status,ordered_at
) values(
'00000000-0000-0000-0000-000000003513',
'00000000-0000-0000-0000-0000000035a1',
'00000000-0000-0000-0000-0000000035f1',
'00000000-0000-0000-0000-000000003501',
'received',now()
);

insert into public.order_lines(
id,owner_id,organization_id,order_id,canonical_product_key,raw_spec_text
) values(
'00000000-0000-0000-0000-000000003523',
'00000000-0000-0000-0000-0000000035a1',
'00000000-0000-0000-0000-0000000035f1',
'00000000-0000-0000-0000-000000003513',
'tube:v1|family=round_tube|grade=s355|standard=en10219|material=_|geom=od:273|t=8|process=_',
'Order 273x8'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000035a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p1_operational_relationship_readiness(
    '00000000-0000-0000-0000-0000000035f1',100
  )#>>'{summary,ready_total}')::int=3,
  'shared normalized conversation + exact product must expose three unique ready relationships'
);

select public.p1_activate_operational_relationship(
  '00000000-0000-0000-0000-0000000035f1',
  'offer_rfq',
  '00000000-0000-0000-0000-000000003512',
  '00000000-0000-0000-0000-000000003511'
) as offer_rfq_result \gset

select public.p1_activate_operational_relationship(
  '00000000-0000-0000-0000-0000000035f1',
  'order_offer',
  '00000000-0000-0000-0000-000000003513',
  '00000000-0000-0000-0000-000000003512'
) as order_offer_result \gset

select public.p1_activate_operational_relationship(
  '00000000-0000-0000-0000-0000000035f1',
  'order_rfq',
  '00000000-0000-0000-0000-000000003513',
  '00000000-0000-0000-0000-000000003511'
) as order_rfq_result \gset

select pg_temp.assert_true(
  :'offer_rfq_result'::jsonb->>'status'='applied'
  and :'order_offer_result'::jsonb->>'status'='applied'
  and :'order_rfq_result'::jsonb->>'status'='applied',
  'all three explicit activations must apply'
);

select pg_temp.assert_true(
  (select rfq_id from public.offers where id='00000000-0000-0000-0000-000000003512')
    ='00000000-0000-0000-0000-000000003511'
  and (select rfq_line_id from public.offer_lines where id='00000000-0000-0000-0000-000000003522')
    ='00000000-0000-0000-0000-000000003521',
  'Offer must link to RFQ and exact RFQ line'
);

select pg_temp.assert_true(
  (select offer_id from public.orders where id='00000000-0000-0000-0000-000000003513')
    ='00000000-0000-0000-0000-000000003512'
  and (select rfq_id from public.orders where id='00000000-0000-0000-0000-000000003513')
    ='00000000-0000-0000-0000-000000003511'
  and (select offer_line_id from public.order_lines where id='00000000-0000-0000-0000-000000003523')
    ='00000000-0000-0000-0000-000000003522',
  'Order must link to Offer, RFQ and exact Offer line'
);

select pg_temp.assert_true(
  (select count(*) from public.commercial_relationship_activations
   where organization_id='00000000-0000-0000-0000-0000000035f1')=3,
  'three immutable activation audit rows must be recorded'
);

select public.p1_activate_operational_relationship(
  '00000000-0000-0000-0000-0000000035f1',
  'offer_rfq',
  '00000000-0000-0000-0000-000000003512',
  '00000000-0000-0000-0000-000000003511'
) as repeat_result \gset

select pg_temp.assert_true(
  :'repeat_result'::jsonb->>'status'='already_applied'
  and (select count(*) from public.commercial_relationship_activations
       where organization_id='00000000-0000-0000-0000-0000000035f1')=3,
  'relationship activation must be idempotent'
);

rollback;
