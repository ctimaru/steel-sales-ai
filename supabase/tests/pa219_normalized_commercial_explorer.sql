-- PA2.19 normalized Commercial Explorer union acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok,false) then raise exception 'PA2.19 assertion failed: %',message; end if;
end;
$$;

insert into auth.users(id,email) values
('00000000-0000-0000-0000-0000000034a1','pa219@example.com');

insert into public.organizations(id,name,slug,created_by,onboarding_status)
values('00000000-0000-0000-0000-0000000034f1','PA219 Org','pa219-org',
'00000000-0000-0000-0000-0000000034a1','completed');

insert into public.organization_memberships(
organization_id,user_id,role,business_role,status,is_default
) values('00000000-0000-0000-0000-0000000034f1',
'00000000-0000-0000-0000-0000000034a1','admin','sales_director','active',true);

insert into public.rfqs(id,owner_id,organization_id,requested_at,status,priority)
values('00000000-0000-0000-0000-000000003401','00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-0000000034f1','2026-09-01T10:00:00Z','new','normal');

insert into public.rfq_lines(
id,owner_id,organization_id,rfq_id,requested_grade,requested_standard,raw_spec_text,canonical_product_key
) values(
'00000000-0000-0000-0000-000000003411','00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-0000000034f1','00000000-0000-0000-0000-000000003401',
'S355J2H','EN 10219','RFQ 120x80x6','tube:test:rfq'
);

insert into public.offers(id,owner_id,organization_id,offered_at,status,currency)
values('00000000-0000-0000-0000-000000003402','00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-0000000034f1','2026-09-02T10:00:00Z','sent','EUR');

insert into public.offer_lines(
id,owner_id,organization_id,offer_id,raw_spec_text,canonical_product_key,price_value,price_unit,confidence
) values(
'00000000-0000-0000-0000-000000003412','00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-0000000034f1','00000000-0000-0000-0000-000000003402',
'Offer 406.4x6.3','tube:test:offer',68.38,'M',0.98
);

insert into public.orders(id,owner_id,organization_id,ordered_at,status)
values('00000000-0000-0000-0000-000000003403','00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-0000000034f1','2026-09-03T10:00:00Z','received');

insert into public.order_lines(
id,owner_id,organization_id,order_id,raw_spec_text,canonical_product_key,unit_price,price_unit
) values(
'00000000-0000-0000-0000-000000003413','00000000-0000-0000-0000-0000000034a1',
'00000000-0000-0000-0000-0000000034f1','00000000-0000-0000-0000-000000003403',
'Order 323.9x8','tube:test:order',79.10,'M'
);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000034a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select pg_temp.assert_true(
  (public.p1_normalized_commercial_explorer(
    '00000000-0000-0000-0000-0000000034f1',null,null,null,null,50,0
  )->>'total')::int=3,
  'Explorer must union exactly RFQ, Offer and Order normalized lines'
);

select pg_temp.assert_true(
  (select count(distinct x->>'role')
   from jsonb_array_elements(public.p1_normalized_commercial_explorer(
    '00000000-0000-0000-0000-0000000034f1',null,null,null,null,50,0
   )->'rows') x)=3,
  'Explorer must expose three operational roles'
);

select pg_temp.assert_true(
  (public.p1_normalized_commercial_explorer(
    '00000000-0000-0000-0000-0000000034f1',null,'ordered',null,null,50,0
  )->>'total')::int=1,
  'role filter must isolate normalized Orders'
);

select pg_temp.assert_true(
  (public.p1_normalized_commercial_explorer(
    '00000000-0000-0000-0000-0000000034f1','406.4',null,null,null,50,0
  )->>'total')::int=1,
  'text filter must search normalized product text'
);

select pg_temp.assert_true(
  (public.p1_normalized_commercial_explorer(
    '00000000-0000-0000-0000-0000000034f1',null,'requested','S355J2H','EN 10219',50,0
  )->>'total')::int=1,
  'grade and standard filters must work on normalized RFQ data'
);

select pg_temp.assert_true(
  public.p1_normalized_commercial_explorer(
    '00000000-0000-0000-0000-0000000034f1',null,null,null,null,50,0
  )#>>'{policy,operational_source}'='normalized_entities'
  and (public.p1_normalized_commercial_explorer(
    '00000000-0000-0000-0000-0000000034f1',null,null,null,null,50,0
  )#>>'{policy,delivery_included}')::boolean=false,
  'policy must make normalized source and Delivery exclusion explicit'
);

rollback;
