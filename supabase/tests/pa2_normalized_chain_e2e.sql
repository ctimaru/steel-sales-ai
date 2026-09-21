-- PA2.2f normalized business chain + promotion ledger end-to-end acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'PA2.2f assertion failed: %', message;
  end if;
end;
$$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000026a1', 'director@pa22f.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status)
values (
  '00000000-0000-0000-0000-0000000026f1',
  'PA22F Org',
  'pa22f-org',
  '00000000-0000-0000-0000-0000000026a1',
  'completed'
);

insert into public.organization_memberships (
  organization_id,user_id,role,business_role,status,is_default
) values (
  '00000000-0000-0000-0000-0000000026f1',
  '00000000-0000-0000-0000-0000000026a1',
  'admin',
  'sales_director',
  'active',
  true
);

insert into public.commercial_datasets (
  id,owner_id,source_run_id,source_filename,organization_id
) values (
  '00000000-0000-0000-0000-000000002601',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-000000002611',
  'pa22f-flow.eml',
  '00000000-0000-0000-0000-0000000026f1'
);

insert into public.commercial_threads (
  id,owner_id,dataset_id,source_conversation_id,subject,classification,last_activity_at,organization_id
) values (
  '00000000-0000-0000-0000-000000002621',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-000000002601',
  '00000000-0000-0000-0000-000000002631',
  'PA22F requested-offered-ordered flow',
  'rfq',
  '2026-09-21T15:30:00Z',
  '00000000-0000-0000-0000-0000000026f1'
);

insert into public.commercial_observations (
  id,owner_id,dataset_id,thread_id,source_conversation_id,item_role,direction,
  product_type,grade,outer_diameter_mm,thickness_mm,length_mm,quantity,quantity_unit,
  price_value,price_unit,currency,source_filename,source_text,confidence,search_text,
  organization_id
) values
(
  26001,
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-000000002601',
  '00000000-0000-0000-0000-000000002621',
  '00000000-0000-0000-0000-000000002631',
  'requested','inbound','round_tube','S355',273,8,12000,2,'PACCHI',
  null,null,null,'pa22f-flow.eml','Tubo tondo 273x8 a 12000 | 2 pacchi | s355',0.95,
  's355 273 8 12000 2 pacchi',
  '00000000-0000-0000-0000-0000000026f1'
),
(
  26002,
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-000000002601',
  '00000000-0000-0000-0000-000000002621',
  '00000000-0000-0000-0000-000000002631',
  'offered','outbound','round_tube','S355',273,8,12000,100,'MT',
  68.38,'MT','EUR','pa22f-flow.eml','Offerta S355 273x8 12000 - EUR/MT 68,38',0.97,
  's355 273 8 12000 100 mt 68.38 eur',
  '00000000-0000-0000-0000-0000000026f1'
),
(
  26003,
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-000000002601',
  '00000000-0000-0000-0000-000000002621',
  '00000000-0000-0000-0000-000000002631',
  'ordered','inbound','round_tube','S355',273,8,12000,100,'MT',
  68.38,'MT','EUR','pa22f-flow.eml','Ordine confermato S355 273x8 12000 - 100 MT',0.99,
  's355 273 8 12000 100 mt order',
  '00000000-0000-0000-0000-0000000026f1'
);

insert into public.companies (
  id,owner_id,organization_id,name,company_type
) values (
  '00000000-0000-0000-0000-000000002641',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  'PA22F Customer',
  'customer'
);

insert into public.rfqs (
  id,owner_id,organization_id,company_id,assigned_to_user_id,created_by_user_id,
  requested_at,status,priority
) values (
  '00000000-0000-0000-0000-000000002651',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  '00000000-0000-0000-0000-000000002641',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026a1',
  now(),
  'in_progress',
  'normal'
);

insert into public.rfq_lines (
  id,owner_id,organization_id,rfq_id,requested_quantity,quantity_unit,requested_grade,
  min_length_mm,max_length_mm,canonical_product_id,canonical_product_key,
  source_observation_id,raw_spec_text
) values (
  '00000000-0000-0000-0000-000000002652',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  '00000000-0000-0000-0000-000000002651',
  2,'PACCHI','S355',12000,12000,
  '33333333-3333-3333-3333-333333333333',
  'tube:v1|family=round_tube|grade=s355|standard=_|material=_|geom=od:273|t=8|process=_',
  26001,
  'Tubo tondo 273x8 a 12000 | 2 pacchi | s355'
);

insert into public.offers (
  id,owner_id,organization_id,company_id,rfq_id,created_by_user_id,assigned_to_user_id,
  offered_at,status,currency
) values (
  '00000000-0000-0000-0000-000000002661',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  '00000000-0000-0000-0000-000000002641',
  '00000000-0000-0000-0000-000000002651',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026a1',
  now(),
  'sent',
  'EUR'
);

insert into public.offer_lines (
  id,owner_id,organization_id,offer_id,rfq_line_id,quantity,quantity_unit,
  price_value,price_unit,canonical_product_id,canonical_product_key,
  source_observation_id,raw_spec_text
) values (
  '00000000-0000-0000-0000-000000002662',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  '00000000-0000-0000-0000-000000002661',
  '00000000-0000-0000-0000-000000002652',
  100,'MT',68.38,'MT',
  '33333333-3333-3333-3333-333333333333',
  'tube:v1|family=round_tube|grade=s355|standard=_|material=_|geom=od:273|t=8|process=_',
  26002,
  'Offerta S355 273x8 12000 - EUR/MT 68,38'
);

insert into public.orders (
  id,owner_id,organization_id,company_id,rfq_id,offer_id,created_by_user_id,assigned_to_user_id,
  ordered_at,status
) values (
  '00000000-0000-0000-0000-000000002671',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  '00000000-0000-0000-0000-000000002641',
  '00000000-0000-0000-0000-000000002651',
  '00000000-0000-0000-0000-000000002661',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026a1',
  now(),
  'confirmed'
);

insert into public.order_lines (
  id,owner_id,organization_id,order_id,offer_line_id,quantity,quantity_unit,
  unit_price,price_unit,canonical_product_id,canonical_product_key,
  source_observation_id,raw_spec_text
) values (
  '00000000-0000-0000-0000-000000002672',
  '00000000-0000-0000-0000-0000000026a1',
  '00000000-0000-0000-0000-0000000026f1',
  '00000000-0000-0000-0000-000000002671',
  '00000000-0000-0000-0000-000000002662',
  100,'MT',68.38,'MT',
  '33333333-3333-3333-3333-333333333333',
  'tube:v1|family=round_tube|grade=s355|standard=_|material=_|geom=od:273|t=8|process=_',
  26003,
  'Ordine confermato S355 273x8 12000 - 100 MT'
);

-- Record evidence→business links only via controlled writer.
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000026a1',true);
select set_config('request.jwt.claim.role','authenticated',true);

select public.record_commercial_entity_promotion(
  '00000000-0000-0000-0000-0000000026f1',26001,'rfq_line',
  '00000000-0000-0000-0000-000000002652',null,'created','applied',0.95,
  'deterministic_match',null,null,'{"phase":"pa2.2f"}'::jsonb
);

select public.record_commercial_entity_promotion(
  '00000000-0000-0000-0000-0000000026f1',26002,'offer_line',
  '00000000-0000-0000-0000-000000002662',null,'created','applied',0.97,
  'deterministic_match',null,null,'{"phase":"pa2.2f"}'::jsonb
);

select public.record_commercial_entity_promotion(
  '00000000-0000-0000-0000-0000000026f1',26003,'order_line',
  '00000000-0000-0000-0000-000000002672',null,'created','applied',0.99,
  'deterministic_match',null,null,'{"phase":"pa2.2f"}'::jsonb
);

reset role;

select pg_temp.assert_true(
  exists (
    select 1
    from public.rfqs r
    join public.rfq_lines rl on rl.rfq_id=r.id and rl.organization_id=r.organization_id
    join public.offers o on o.rfq_id=r.id and o.organization_id=r.organization_id
    join public.offer_lines ol on ol.offer_id=o.id
      and ol.rfq_line_id=rl.id
      and ol.organization_id=r.organization_id
    join public.orders ord on ord.offer_id=o.id
      and ord.rfq_id=r.id
      and ord.organization_id=r.organization_id
    join public.order_lines odl on odl.order_id=ord.id
      and odl.offer_line_id=ol.id
      and odl.organization_id=r.organization_id
    where r.id='00000000-0000-0000-0000-000000002651'
      and rl.source_observation_id=26001
      and ol.source_observation_id=26002
      and odl.source_observation_id=26003
      and ol.price_value=68.38
      and odl.unit_price=68.38
  ),
  'normalized RFQ→Offer→Order chain must preserve line relationships and source observations'
);

select pg_temp.assert_true(
  (
    select count(*)
    from public.commercial_entity_promotions
    where organization_id='00000000-0000-0000-0000-0000000026f1'
      and observation_id in (26001,26002,26003)
      and promotion_action='created'
      and status='applied'
  ) = 3,
  'ledger must contain exactly one promotion for each requested/offered/ordered observation'
);

select pg_temp.assert_true(
  exists (
    select 1
    from public.commercial_entity_promotions p
    join public.rfq_lines rl on p.entity_type='rfq_line' and p.entity_id=rl.id
    where p.observation_id=26001
      and rl.raw_spec_text like 'Tubo tondo 273x8%'
  )
  and exists (
    select 1
    from public.commercial_entity_promotions p
    join public.offer_lines ol on p.entity_type='offer_line' and p.entity_id=ol.id
    where p.observation_id=26002
      and ol.price_value=68.38
  )
  and exists (
    select 1
    from public.commercial_entity_promotions p
    join public.order_lines odl on p.entity_type='order_line' and p.entity_id=odl.id
    where p.observation_id=26003
      and odl.unit_price=68.38
  ),
  'each business line must remain traceable to its supporting observation through the ledger'
);

rollback;
