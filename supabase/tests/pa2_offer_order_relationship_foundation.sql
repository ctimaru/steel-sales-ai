-- PA2.2d Offer/Order relationship acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'PA2.2d assertion failed: %', message;
  end if;
end;
$$;

create or replace function pg_temp.assert_raises(statement text, expected_fragment text)
returns void
language plpgsql
as $$
begin
  begin
    execute statement;
  exception when others then
    if position(expected_fragment in sqlerrm) = 0 then
      raise exception 'PA2.2d expected error containing "%", got "%"', expected_fragment, sqlerrm;
    end if;
    return;
  end;
  raise exception 'PA2.2d statement unexpectedly succeeded: %', statement;
end;
$$;

select pg_temp.assert_true(
  (
    select count(*)
    from information_schema.columns
    where table_schema='public' and table_name='offers'
      and column_name = any(array['rfq_id','created_by_user_id','assigned_to_user_id','source_message_id'])
  ) = 4,
  'offer header relationship columns must exist'
);

select pg_temp.assert_true(
  (
    select count(*)
    from information_schema.columns
    where table_schema='public' and table_name='offer_lines'
      and column_name = any(array['rfq_line_id','canonical_product_id','canonical_product_key','source_observation_id','raw_spec_text'])
  ) = 5,
  'offer line relationship/evidence columns must exist'
);

select pg_temp.assert_true(
  (
    select count(*)
    from information_schema.columns
    where table_schema='public' and table_name='orders'
      and column_name = any(array['rfq_id','offer_id','created_by_user_id','assigned_to_user_id','source_message_id'])
  ) = 5,
  'order header relationship columns must exist'
);

select pg_temp.assert_true(
  (
    select count(*)
    from information_schema.columns
    where table_schema='public' and table_name='order_lines'
      and column_name = any(array['offer_line_id','canonical_product_id','canonical_product_key','source_observation_id','raw_spec_text'])
  ) = 5,
  'order line relationship/evidence columns must exist'
);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000024a1', 'director-a@pa22d.example'),
  ('00000000-0000-0000-0000-0000000024a2', 'sales-a@pa22d.example'),
  ('00000000-0000-0000-0000-0000000024b1', 'sales-b@pa22d.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status)
values
  ('00000000-0000-0000-0000-0000000024f1', 'PA22D Org A', 'pa22d-org-a', '00000000-0000-0000-0000-0000000024a1', 'completed'),
  ('00000000-0000-0000-0000-0000000024f2', 'PA22D Org B', 'pa22d-org-b', '00000000-0000-0000-0000-0000000024b1', 'completed');

insert into public.organization_memberships (
  organization_id, user_id, role, business_role, status, is_default
) values
  ('00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-0000000024a1','admin','sales_director','active',true),
  ('00000000-0000-0000-0000-0000000024f1','00000000-0000-0000-0000-0000000024a2','member','salesperson','active',false),
  ('00000000-0000-0000-0000-0000000024f2','00000000-0000-0000-0000-0000000024b1','member','salesperson','active',true);

insert into public.companies (id, owner_id, organization_id, name, company_type)
values
  ('00000000-0000-0000-0000-000000002401','00000000-0000-0000-0000-0000000024a1','00000000-0000-0000-0000-0000000024f1','Customer A','customer'),
  ('00000000-0000-0000-0000-000000002402','00000000-0000-0000-0000-0000000024b1','00000000-0000-0000-0000-0000000024f2','Customer B','customer');

insert into public.conversations (id, owner_id, organization_id, company_id, subject)
values (
  '00000000-0000-0000-0000-000000002411',
  '00000000-0000-0000-0000-0000000024a1',
  '00000000-0000-0000-0000-0000000024f1',
  '00000000-0000-0000-0000-000000002401',
  'Sales flow A'
);

insert into public.messages (
  id, owner_id, organization_id, conversation_id, direction, sender_email, subject
) values (
  '00000000-0000-0000-0000-000000002412',
  '00000000-0000-0000-0000-0000000024a1',
  '00000000-0000-0000-0000-0000000024f1',
  '00000000-0000-0000-0000-000000002411',
  'outbound',
  'sales@org-a.example',
  'Offer A'
);

insert into public.rfqs (
  id, owner_id, organization_id, conversation_id, company_id,
  assigned_to_user_id, created_by_user_id, requested_at
) values (
  '00000000-0000-0000-0000-000000002421',
  '00000000-0000-0000-0000-0000000024a1',
  '00000000-0000-0000-0000-0000000024f1',
  '00000000-0000-0000-0000-000000002411',
  '00000000-0000-0000-0000-000000002401',
  '00000000-0000-0000-0000-0000000024a2',
  '00000000-0000-0000-0000-0000000024a1',
  now()
);

insert into public.rfq_lines (
  id, owner_id, organization_id, rfq_id, requested_quantity, quantity_unit,
  requested_grade, raw_spec_text
) values (
  '00000000-0000-0000-0000-000000002422',
  '00000000-0000-0000-0000-0000000024a1',
  '00000000-0000-0000-0000-0000000024f1',
  '00000000-0000-0000-0000-000000002421',
  100, 'MT', 'S355', '273x8 S355'
);

-- Valid Offer linked to RFQ and same-org workflow users.
insert into public.offers (
  id, owner_id, organization_id, conversation_id, company_id,
  rfq_id, created_by_user_id, assigned_to_user_id, source_message_id,
  offered_at, status
) values (
  '00000000-0000-0000-0000-000000002431',
  '00000000-0000-0000-0000-0000000024a1',
  '00000000-0000-0000-0000-0000000024f1',
  '00000000-0000-0000-0000-000000002411',
  '00000000-0000-0000-0000-000000002401',
  '00000000-0000-0000-0000-000000002421',
  '00000000-0000-0000-0000-0000000024a1',
  '00000000-0000-0000-0000-0000000024a2',
  '00000000-0000-0000-0000-000000002412',
  now(),
  'sent'
);

select pg_temp.assert_true(
  exists (
    select 1 from public.offers
    where id='00000000-0000-0000-0000-000000002431'
      and rfq_id='00000000-0000-0000-0000-000000002421'
      and assigned_to_user_id='00000000-0000-0000-0000-0000000024a2'
      and status='sent'
  ),
  'offer must retain RFQ and same-org workflow links'
);

select pg_temp.assert_raises(
  $stmt$
    insert into public.offers (
      id, owner_id, organization_id, company_id, assigned_to_user_id, offered_at
    ) values (
      '00000000-0000-0000-0000-000000002432',
      '00000000-0000-0000-0000-0000000024a1',
      '00000000-0000-0000-0000-0000000024f1',
      '00000000-0000-0000-0000-000000002401',
      '00000000-0000-0000-0000-0000000024b1',
      now()
    )
  $stmt$,
  'offers assigned user must be an active member of the organization'
);

insert into public.offer_lines (
  id, owner_id, organization_id, offer_id, rfq_line_id,
  quantity, quantity_unit, price_value, price_unit,
  canonical_product_id, canonical_product_key, raw_spec_text
) values (
  '00000000-0000-0000-0000-000000002441',
  '00000000-0000-0000-0000-0000000024a1',
  '00000000-0000-0000-0000-0000000024f1',
  '00000000-0000-0000-0000-000000002431',
  '00000000-0000-0000-0000-000000002422',
  100, 'MT', 68.38, 'MT',
  '22222222-2222-2222-2222-222222222222',
  'round_tube|273|8|s355',
  'S355 273x8 offered at 68.38 EUR/MT'
);

select pg_temp.assert_true(
  exists (
    select 1 from public.offer_lines
    where id='00000000-0000-0000-0000-000000002441'
      and rfq_line_id='00000000-0000-0000-0000-000000002422'
      and raw_spec_text like 'S355 273x8%'
  ),
  'offer line must link to RFQ line and preserve offered snapshot'
);

-- Cross-org RFQ cannot be linked to offer in Org A.
insert into public.rfqs (
  id, owner_id, organization_id, company_id, requested_at
) values (
  '00000000-0000-0000-0000-000000002423',
  '00000000-0000-0000-0000-0000000024b1',
  '00000000-0000-0000-0000-0000000024f2',
  '00000000-0000-0000-0000-000000002402',
  now()
);

select pg_temp.assert_raises(
  $stmt$
    insert into public.offers (
      id, owner_id, organization_id, company_id, rfq_id, offered_at
    ) values (
      '00000000-0000-0000-0000-000000002433',
      '00000000-0000-0000-0000-0000000024a1',
      '00000000-0000-0000-0000-0000000024f1',
      '00000000-0000-0000-0000-000000002401',
      '00000000-0000-0000-0000-000000002423',
      now()
    )
  $stmt$,
  'offers_org_rfq_fkey'
);

-- Valid order linked to RFQ + Offer.
insert into public.orders (
  id, owner_id, organization_id, conversation_id, company_id,
  rfq_id, offer_id, created_by_user_id, assigned_to_user_id, source_message_id,
  ordered_at, status
) values (
  '00000000-0000-0000-0000-000000002451',
  '00000000-0000-0000-0000-0000000024a1',
  '00000000-0000-0000-0000-0000000024f1',
  '00000000-0000-0000-0000-000000002411',
  '00000000-0000-0000-0000-000000002401',
  '00000000-0000-0000-0000-000000002421',
  '00000000-0000-0000-0000-000000002431',
  '00000000-0000-0000-0000-0000000024a1',
  '00000000-0000-0000-0000-0000000024a2',
  '00000000-0000-0000-0000-000000002412',
  now(),
  'confirmed'
);

insert into public.order_lines (
  id, owner_id, organization_id, order_id, offer_line_id,
  quantity, quantity_unit, unit_price, price_unit,
  canonical_product_id, canonical_product_key, raw_spec_text
) values (
  '00000000-0000-0000-0000-000000002452',
  '00000000-0000-0000-0000-0000000024a1',
  '00000000-0000-0000-0000-0000000024f1',
  '00000000-0000-0000-0000-000000002451',
  '00000000-0000-0000-0000-000000002441',
  100, 'MT', 68.38, 'MT',
  '22222222-2222-2222-2222-222222222222',
  'round_tube|273|8|s355',
  'S355 273x8 ordered at 68.38 EUR/MT'
);

select pg_temp.assert_true(
  exists (
    select 1 from public.orders o
    join public.order_lines l on l.order_id=o.id
    where o.id='00000000-0000-0000-0000-000000002451'
      and o.rfq_id='00000000-0000-0000-0000-000000002421'
      and o.offer_id='00000000-0000-0000-0000-000000002431'
      and l.offer_line_id='00000000-0000-0000-0000-000000002441'
  ),
  'order flow must link RFQ → Offer → Offer Line → Order Line'
);

-- Cross-org offer line cannot be linked into order line.
insert into public.offers (
  id, owner_id, organization_id, company_id, offered_at
) values (
  '00000000-0000-0000-0000-000000002434',
  '00000000-0000-0000-0000-0000000024b1',
  '00000000-0000-0000-0000-0000000024f2',
  '00000000-0000-0000-0000-000000002402',
  now()
);

insert into public.offer_lines (
  id, owner_id, organization_id, offer_id, quantity, quantity_unit, price_value, price_unit
) values (
  '00000000-0000-0000-0000-000000002442',
  '00000000-0000-0000-0000-0000000024b1',
  '00000000-0000-0000-0000-0000000024f2',
  '00000000-0000-0000-0000-000000002434',
  1, 'PZ', 1, 'PZ'
);

select pg_temp.assert_raises(
  $stmt$
    insert into public.order_lines (
      id, owner_id, organization_id, order_id, offer_line_id,
      quantity, quantity_unit
    ) values (
      '00000000-0000-0000-0000-000000002453',
      '00000000-0000-0000-0000-0000000024a1',
      '00000000-0000-0000-0000-0000000024f1',
      '00000000-0000-0000-0000-000000002451',
      '00000000-0000-0000-0000-000000002442',
      1, 'PZ'
    )
  $stmt$,
  'order_lines_org_offer_line_fkey'
);

rollback;
