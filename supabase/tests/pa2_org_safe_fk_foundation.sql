-- PA2.2b organization-safe ownership / same-org FK acceptance.
-- Runs only on disposable CI database and rolls back.

begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'PA2.2b assertion failed: %', message;
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
      raise exception 'PA2.2b expected error containing "%", got "%"', expected_fragment, sqlerrm;
    end if;
    return;
  end;
  raise exception 'PA2.2b statement unexpectedly succeeded: %', statement;
end;
$$;

-- All normalized private tables must now require organization_id.
select pg_temp.assert_true(
  (
    select count(*)
    from information_schema.columns
    where table_schema='public'
      and table_name = any(array[
        'companies','contacts','conversations','messages','documents','products',
        'rfqs','rfq_lines','offers','offer_lines','orders','order_lines','price_history'
      ])
      and column_name='organization_id'
      and is_nullable='NO'
  ) = 13,
  'all normalized private tables must require organization_id'
);

-- The expected same-org composite FK set must exist.
select pg_temp.assert_true(
  (
    select count(*)
    from pg_constraint
    where conname = any(array[
      'contacts_org_company_fkey',
      'conversations_org_company_fkey',
      'messages_org_conversation_fkey',
      'documents_org_conversation_fkey',
      'documents_org_message_fkey',
      'documents_org_company_fkey',
      'rfqs_org_conversation_fkey',
      'rfqs_org_company_fkey',
      'rfq_lines_org_rfq_fkey',
      'rfq_lines_org_product_fkey',
      'offers_org_conversation_fkey',
      'offers_org_company_fkey',
      'offer_lines_org_offer_fkey',
      'offer_lines_org_product_fkey',
      'orders_org_conversation_fkey',
      'orders_org_company_fkey',
      'order_lines_org_order_fkey',
      'order_lines_org_product_fkey',
      'price_history_org_company_fkey',
      'price_history_org_product_fkey',
      'price_history_org_offer_line_fkey'
    ])
  ) = 21,
  'all same-org composite foreign keys must exist'
);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000022a1', 'owner-a@pa22b.example'),
  ('00000000-0000-0000-0000-0000000022b1', 'owner-b@pa22b.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status)
values
  ('00000000-0000-0000-0000-0000000022f1', 'PA22B Org A', 'pa22b-org-a', '00000000-0000-0000-0000-0000000022a1', 'completed'),
  ('00000000-0000-0000-0000-0000000022f2', 'PA22B Org B', 'pa22b-org-b', '00000000-0000-0000-0000-0000000022b1', 'completed');

insert into public.organization_memberships (
  organization_id, user_id, role, business_role, status, is_default
) values
  (
    '00000000-0000-0000-0000-0000000022f1',
    '00000000-0000-0000-0000-0000000022a1',
    'admin',
    'sales_director',
    'active',
    true
  ),
  (
    '00000000-0000-0000-0000-0000000022f2',
    '00000000-0000-0000-0000-0000000022b1',
    'admin',
    'sales_director',
    'active',
    true
  );

insert into public.companies (id, owner_id, organization_id, name, company_type)
values
  ('00000000-0000-0000-0000-000000002201', '00000000-0000-0000-0000-0000000022a1', '00000000-0000-0000-0000-0000000022f1', 'Customer A', 'customer'),
  ('00000000-0000-0000-0000-000000002202', '00000000-0000-0000-0000-0000000022b1', '00000000-0000-0000-0000-0000000022f2', 'Customer B', 'customer');

-- Same-organization relation succeeds.
insert into public.contacts (id, owner_id, organization_id, company_id, full_name)
values (
  '00000000-0000-0000-0000-000000002211',
  '00000000-0000-0000-0000-0000000022a1',
  '00000000-0000-0000-0000-0000000022f1',
  '00000000-0000-0000-0000-000000002201',
  'Contact A'
);

-- Cross-organization relation fails even though the target ID itself exists.
select pg_temp.assert_raises(
  $stmt$
    insert into public.contacts (id, owner_id, organization_id, company_id, full_name)
    values (
      '00000000-0000-0000-0000-000000002212',
      '00000000-0000-0000-0000-0000000022a1',
      '00000000-0000-0000-0000-0000000022f1',
      '00000000-0000-0000-0000-000000002202',
      'Cross Tenant Contact'
    )
  $stmt$,
  'contacts_org_company_fkey'
);

insert into public.conversations (id, owner_id, organization_id, company_id, subject)
values (
  '00000000-0000-0000-0000-000000002221',
  '00000000-0000-0000-0000-0000000022a1',
  '00000000-0000-0000-0000-0000000022f1',
  '00000000-0000-0000-0000-000000002201',
  'RFQ A'
);

select pg_temp.assert_raises(
  $stmt$
    insert into public.messages (
      id, owner_id, organization_id, conversation_id, direction, sender_email, subject
    ) values (
      '00000000-0000-0000-0000-000000002222',
      '00000000-0000-0000-0000-0000000022b1',
      '00000000-0000-0000-0000-0000000022f2',
      '00000000-0000-0000-0000-000000002221',
      'inbound',
      'buyer@example.com',
      'Cross Tenant Message'
    )
  $stmt$,
  'messages_org_conversation_fkey'
);

insert into public.products (
  id, owner_id, organization_id, product_type, grade, outer_diameter_mm, thickness_mm
) values
  (
    '00000000-0000-0000-0000-000000002231',
    '00000000-0000-0000-0000-0000000022a1',
    '00000000-0000-0000-0000-0000000022f1',
    'round_tube', 'S355', 273, 8
  ),
  (
    '00000000-0000-0000-0000-000000002232',
    '00000000-0000-0000-0000-0000000022b1',
    '00000000-0000-0000-0000-0000000022f2',
    'round_tube', 'S355', 323.9, 8
  );

insert into public.rfqs (
  id, owner_id, organization_id, conversation_id, company_id, requested_at
) values (
  '00000000-0000-0000-0000-000000002241',
  '00000000-0000-0000-0000-0000000022a1',
  '00000000-0000-0000-0000-0000000022f1',
  '00000000-0000-0000-0000-000000002221',
  '00000000-0000-0000-0000-000000002201',
  now()
);

insert into public.rfq_lines (
  id, owner_id, organization_id, rfq_id, product_id, requested_quantity, quantity_unit
) values (
  '00000000-0000-0000-0000-000000002242',
  '00000000-0000-0000-0000-0000000022a1',
  '00000000-0000-0000-0000-0000000022f1',
  '00000000-0000-0000-0000-000000002241',
  '00000000-0000-0000-0000-000000002231',
  2,
  'PACCHI'
);

select pg_temp.assert_raises(
  $stmt$
    insert into public.rfq_lines (
      id, owner_id, organization_id, rfq_id, product_id, requested_quantity, quantity_unit
    ) values (
      '00000000-0000-0000-0000-000000002243',
      '00000000-0000-0000-0000-0000000022a1',
      '00000000-0000-0000-0000-0000000022f1',
      '00000000-0000-0000-0000-000000002241',
      '00000000-0000-0000-0000-000000002232',
      1,
      'PZ'
    )
  $stmt$,
  'rfq_lines_org_product_fkey'
);

insert into public.offers (
  id, owner_id, organization_id, conversation_id, company_id, offered_at
) values (
  '00000000-0000-0000-0000-000000002251',
  '00000000-0000-0000-0000-0000000022a1',
  '00000000-0000-0000-0000-0000000022f1',
  '00000000-0000-0000-0000-000000002221',
  '00000000-0000-0000-0000-000000002201',
  now()
);

insert into public.offer_lines (
  id, owner_id, organization_id, offer_id, product_id, quantity, quantity_unit,
  price_value, price_unit
) values (
  '00000000-0000-0000-0000-000000002252',
  '00000000-0000-0000-0000-0000000022a1',
  '00000000-0000-0000-0000-0000000022f1',
  '00000000-0000-0000-0000-000000002251',
  '00000000-0000-0000-0000-000000002231',
  100,
  'MT',
  68.38,
  'MT'
);

select pg_temp.assert_raises(
  $stmt$
    insert into public.price_history (
      id, owner_id, organization_id, company_id, product_id, offer_line_id,
      price_value, price_unit
    ) values (
      '00000000-0000-0000-0000-000000002253',
      '00000000-0000-0000-0000-0000000022a1',
      '00000000-0000-0000-0000-0000000022f1',
      '00000000-0000-0000-0000-000000002202',
      '00000000-0000-0000-0000-000000002231',
      '00000000-0000-0000-0000-000000002252',
      68.38,
      'MT'
    )
  $stmt$,
  'price_history_org_company_fkey'
);

insert into public.orders (
  id, owner_id, organization_id, conversation_id, company_id, ordered_at
) values (
  '00000000-0000-0000-0000-000000002261',
  '00000000-0000-0000-0000-0000000022a1',
  '00000000-0000-0000-0000-0000000022f1',
  '00000000-0000-0000-0000-000000002221',
  '00000000-0000-0000-0000-000000002201',
  now()
);

select pg_temp.assert_raises(
  $stmt$
    insert into public.order_lines (
      id, owner_id, organization_id, order_id, product_id, quantity, quantity_unit
    ) values (
      '00000000-0000-0000-0000-000000002262',
      '00000000-0000-0000-0000-0000000022a1',
      '00000000-0000-0000-0000-0000000022f1',
      '00000000-0000-0000-0000-000000002261',
      '00000000-0000-0000-0000-000000002232',
      10,
      'PZ'
    )
  $stmt$,
  'order_lines_org_product_fkey'
);

rollback;
