-- PA2.2c RFQ relationship/status acceptance.
begin;

create or replace function pg_temp.assert_true(ok boolean, message text)
returns void
language plpgsql
as $$
begin
  if not coalesce(ok, false) then
    raise exception 'PA2.2c assertion failed: %', message;
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
      raise exception 'PA2.2c expected error containing "%", got "%"', expected_fragment, sqlerrm;
    end if;
    return;
  end;
  raise exception 'PA2.2c statement unexpectedly succeeded: %', statement;
end;
$$;

-- Contract shape.
select pg_temp.assert_true(
  (
    select count(*)
    from information_schema.columns
    where table_schema='public'
      and table_name='rfqs'
      and column_name = any(array[
        'contact_id','assigned_to_user_id','source_message_id','due_at','priority','created_by_user_id'
      ])
  ) = 6,
  'RFQ header relationship columns must exist'
);

select pg_temp.assert_true(
  (
    select count(*)
    from information_schema.columns
    where table_schema='public'
      and table_name='rfq_lines'
      and column_name = any(array[
        'canonical_product_id','canonical_product_key','source_observation_id',
        'requested_delivery_date','raw_spec_text'
      ])
  ) = 5,
  'RFQ line identity/evidence columns must exist'
);

select pg_temp.assert_true(
  (
    select column_default
    from information_schema.columns
    where table_schema='public' and table_name='rfqs' and column_name='status'
  ) = '''new''::text',
  'RFQ default status must be new'
);

select pg_temp.assert_true(
  exists (
    select 1
    from pg_constraint
    where conrelid='public.rfqs'::regclass
      and conname='rfqs_status_check'
      and pg_get_constraintdef(oid) like '%closed_won%'
      and pg_get_constraintdef(oid) like '%review_needed%'
  ),
  'RFQ status taxonomy must include v2 workflow statuses'
);

-- Two organizations and users.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000023a1', 'director-a@pa22c.example'),
  ('00000000-0000-0000-0000-0000000023a2', 'sales-a@pa22c.example'),
  ('00000000-0000-0000-0000-0000000023b1', 'sales-b@pa22c.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status)
values
  ('00000000-0000-0000-0000-0000000023f1', 'PA22C Org A', 'pa22c-org-a', '00000000-0000-0000-0000-0000000023a1', 'completed'),
  ('00000000-0000-0000-0000-0000000023f2', 'PA22C Org B', 'pa22c-org-b', '00000000-0000-0000-0000-0000000023b1', 'completed');

insert into public.organization_memberships (
  organization_id, user_id, role, business_role, status, is_default
) values
  ('00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-0000000023a1','admin','sales_director','active',true),
  ('00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-0000000023a2','member','salesperson','active',false),
  ('00000000-0000-0000-0000-0000000023f2','00000000-0000-0000-0000-0000000023b1','member','salesperson','active',true);

insert into public.companies (id, owner_id, organization_id, name, company_type)
values
  ('00000000-0000-0000-0000-000000002301','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','Customer A','customer'),
  ('00000000-0000-0000-0000-000000002302','00000000-0000-0000-0000-0000000023b1','00000000-0000-0000-0000-0000000023f2','Customer B','customer');

insert into public.contacts (id, owner_id, organization_id, company_id, full_name, email)
values
  ('00000000-0000-0000-0000-000000002311','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002301','Buyer A','buyer-a@example.com'),
  ('00000000-0000-0000-0000-000000002312','00000000-0000-0000-0000-0000000023b1','00000000-0000-0000-0000-0000000023f2','00000000-0000-0000-0000-000000002302','Buyer B','buyer-b@example.com');

insert into public.conversations (id, owner_id, organization_id, company_id, subject)
values
  ('00000000-0000-0000-0000-000000002321','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002301','RFQ A');

insert into public.messages (
  id, owner_id, organization_id, conversation_id, direction, sender_email, subject
) values
  ('00000000-0000-0000-0000-000000002322','00000000-0000-0000-0000-0000000023a1','00000000-0000-0000-0000-0000000023f1','00000000-0000-0000-0000-000000002321','inbound','buyer-a@example.com','RFQ A');

-- Valid same-org RFQ with salesperson assignment.
insert into public.rfqs (
  id, owner_id, organization_id, conversation_id, company_id, contact_id,
  assigned_to_user_id, source_message_id, created_by_user_id,
  requested_at, due_at, priority
) values (
  '00000000-0000-0000-0000-000000002331',
  '00000000-0000-0000-0000-0000000023a1',
  '00000000-0000-0000-0000-0000000023f1',
  '00000000-0000-0000-0000-000000002321',
  '00000000-0000-0000-0000-000000002301',
  '00000000-0000-0000-0000-000000002311',
  '00000000-0000-0000-0000-0000000023a2',
  '00000000-0000-0000-0000-000000002322',
  '00000000-0000-0000-0000-0000000023a1',
  now(),
  now() + interval '2 days',
  'high'
);

select pg_temp.assert_true(
  exists (
    select 1 from public.rfqs
    where id='00000000-0000-0000-0000-000000002331'
      and status='new'
      and priority='high'
      and assigned_to_user_id='00000000-0000-0000-0000-0000000023a2'
  ),
  'valid RFQ must retain default status and same-org assignee'
);

-- Cross-org contact is rejected by composite FK.
select pg_temp.assert_raises(
  $stmt$
    insert into public.rfqs (
      id, owner_id, organization_id, company_id, contact_id, requested_at
    ) values (
      '00000000-0000-0000-0000-000000002332',
      '00000000-0000-0000-0000-0000000023a1',
      '00000000-0000-0000-0000-0000000023f1',
      '00000000-0000-0000-0000-000000002301',
      '00000000-0000-0000-0000-000000002312',
      now()
    )
  $stmt$,
  'rfqs_org_contact_fkey'
);

-- User from another organization cannot be assigned even though auth user exists.
select pg_temp.assert_raises(
  $stmt$
    insert into public.rfqs (
      id, owner_id, organization_id, company_id, assigned_to_user_id, requested_at
    ) values (
      '00000000-0000-0000-0000-000000002333',
      '00000000-0000-0000-0000-0000000023a1',
      '00000000-0000-0000-0000-0000000023f1',
      '00000000-0000-0000-0000-000000002301',
      '00000000-0000-0000-0000-0000000023b1',
      now()
    )
  $stmt$,
  'RFQ assigned user must be an active member of the organization'
);

-- Invalid status/priority are rejected.
select pg_temp.assert_raises(
  $stmt$
    insert into public.rfqs (
      id, owner_id, organization_id, company_id, requested_at, status
    ) values (
      '00000000-0000-0000-0000-000000002334',
      '00000000-0000-0000-0000-0000000023a1',
      '00000000-0000-0000-0000-0000000023f1',
      '00000000-0000-0000-0000-000000002301',
      now(),
      'open'
    )
  $stmt$,
  'rfqs_status_check'
);

select pg_temp.assert_raises(
  $stmt$
    insert into public.rfqs (
      id, owner_id, organization_id, company_id, requested_at, priority
    ) values (
      '00000000-0000-0000-0000-000000002335',
      '00000000-0000-0000-0000-0000000023a1',
      '00000000-0000-0000-0000-0000000023f1',
      '00000000-0000-0000-0000-000000002301',
      now(),
      'critical'
    )
  $stmt$,
  'rfqs_priority_check'
);

-- RFQ line retains raw request snapshot alongside optional technical identity.
insert into public.rfq_lines (
  id, owner_id, organization_id, rfq_id,
  requested_quantity, quantity_unit, requested_grade, requested_standard,
  min_length_mm, max_length_mm, requested_delivery_date, raw_spec_text,
  canonical_product_id, canonical_product_key
) values (
  '00000000-0000-0000-0000-000000002341',
  '00000000-0000-0000-0000-0000000023a1',
  '00000000-0000-0000-0000-0000000023f1',
  '00000000-0000-0000-0000-000000002331',
  2, 'PACCHI', 'S355', null,
  12000, 12000, current_date + 7,
  'Tubo tondo 273x8 a 12000 | 2 pacchi | s355',
  '11111111-1111-1111-1111-111111111111',
  'round_tube|273|8|s355'
);

select pg_temp.assert_true(
  exists (
    select 1 from public.rfq_lines
    where id='00000000-0000-0000-0000-000000002341'
      and raw_spec_text like 'Tubo tondo 273x8%'
      and canonical_product_key='round_tube|273|8|s355'
      and requested_delivery_date is not null
  ),
  'RFQ line must preserve raw specification and optional technical identity'
);

rollback;
