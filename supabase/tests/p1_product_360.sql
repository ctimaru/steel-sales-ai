-- P1.7 Product 360 acceptance. Disposable CI database only.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000017a1'::uuid, 'product-a@p1-test.example'),
  ('00000000-0000-0000-0000-0000000017b1'::uuid, 'product-b@p1-test.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status)
values
  ('00000000-0000-0000-0000-0000000017f1', 'Product Tenant A', 'product-tenant-a', '00000000-0000-0000-0000-0000000017a1', 'completed'),
  ('00000000-0000-0000-0000-0000000017f2', 'Product Tenant B', 'product-tenant-b', '00000000-0000-0000-0000-0000000017b1', 'completed');

insert into public.organization_memberships (organization_id, user_id, role, status, is_default)
values
  ('00000000-0000-0000-0000-0000000017f1', '00000000-0000-0000-0000-0000000017a1', 'admin', 'active', true),
  ('00000000-0000-0000-0000-0000000017f2', '00000000-0000-0000-0000-0000000017b1', 'admin', 'active', true);

insert into public.commercial_datasets (id, owner_id, source_run_id, source_filename, organization_id)
values
  ('00000000-0000-0000-0000-000000001701', '00000000-0000-0000-0000-0000000017a1', '00000000-0000-0000-0000-000000001711', 'product-a.eml', '00000000-0000-0000-0000-0000000017f1'),
  ('00000000-0000-0000-0000-000000001702', '00000000-0000-0000-0000-0000000017b1', '00000000-0000-0000-0000-000000001712', 'product-b.eml', '00000000-0000-0000-0000-0000000017f2');

insert into public.commercial_threads (
  id, owner_id, dataset_id, source_conversation_id, subject, classification, last_activity_at, organization_id
) values
  ('00000000-0000-0000-0000-000000001721', '00000000-0000-0000-0000-0000000017a1', '00000000-0000-0000-0000-000000001701', '00000000-0000-0000-0000-000000001731', 'RFQ P265GH 406,4', 'rfq', '2026-09-01T10:00:00Z', '00000000-0000-0000-0000-0000000017f1'),
  ('00000000-0000-0000-0000-000000001722', '00000000-0000-0000-0000-0000000017a1', '00000000-0000-0000-0000-000000001701', '00000000-0000-0000-0000-000000001732', 'Offerta P265GH 68,38', 'offer', '2026-09-05T10:00:00Z', '00000000-0000-0000-0000-0000000017f1'),
  ('00000000-0000-0000-0000-000000001723', '00000000-0000-0000-0000-0000000017a1', '00000000-0000-0000-0000-000000001701', '00000000-0000-0000-0000-000000001733', 'Offerta P265GH 72', 'offer', '2026-09-10T10:00:00Z', '00000000-0000-0000-0000-0000000017f1'),
  ('00000000-0000-0000-0000-000000001724', '00000000-0000-0000-0000-0000000017b1', '00000000-0000-0000-0000-000000001702', '00000000-0000-0000-0000-000000001734', 'Other tenant P265GH', 'offer', '2026-09-12T10:00:00Z', '00000000-0000-0000-0000-0000000017f2');

insert into public.commercial_observations (
  id, owner_id, dataset_id, thread_id, source_conversation_id, item_role, direction,
  product_type, grade, standard, outer_diameter_mm, thickness_mm, length_mm,
  quantity, quantity_unit, price_value, price_unit, currency, source_filename, source_text,
  confidence, search_text, organization_id
) values
  (17001, '00000000-0000-0000-0000-0000000017a1', '00000000-0000-0000-0000-000000001701', '00000000-0000-0000-0000-000000001721', '00000000-0000-0000-0000-000000001731', 'requested', 'inbound', 'round_tube', 'P265GH', 'EN 10224', 406.4, 6.3, 12000, 100, 'M', null, null, null, 'rfq-p265gh.eml', 'Richiesta P265GH 406,4 x 6,3', 0.98, 'p265gh 406.4x6.3 en10224 richiesta', '00000000-0000-0000-0000-0000000017f1'),
  (17002, '00000000-0000-0000-0000-0000000017a1', '00000000-0000-0000-0000-000000001701', '00000000-0000-0000-0000-000000001722', '00000000-0000-0000-0000-000000001732', 'offered', 'outbound', 'round_tube', 'P265GH', 'EN 10224', 406.4, 6.3, 12000, 100, 'M', 68.38, 'M', 'EUR', 'offer-68.eml', 'Offerta 68,38 EUR/mt', 0.99, 'p265gh 406.4x6.3 en10224 68.38 eur', '00000000-0000-0000-0000-0000000017f1'),
  (17003, '00000000-0000-0000-0000-0000000017a1', '00000000-0000-0000-0000-000000001701', '00000000-0000-0000-0000-000000001723', '00000000-0000-0000-0000-000000001733', 'offered', 'outbound', 'round_tube', 'P265GH', 'EN 10224', 406.4, 6.3, 12000, 80, 'M', 72.00, 'M', 'EUR', 'offer-72.eml', 'Offerta 72 EUR/mt', 0.99, 'p265gh 406.4x6.3 en10224 72 eur', '00000000-0000-0000-0000-0000000017f1'),
  (17004, '00000000-0000-0000-0000-0000000017b1', '00000000-0000-0000-0000-000000001702', '00000000-0000-0000-0000-000000001724', '00000000-0000-0000-0000-000000001734', 'offered', 'outbound', 'round_tube', 'P265GH', 'EN 10224', 406.4, 6.3, 12000, 1, 'M', 40.00, 'M', 'EUR', 'other-tenant.eml', 'Other tenant offer', 0.99, 'p265gh 406.4x6.3 en10224 40 eur', '00000000-0000-0000-0000-0000000017f2');

create or replace function pg_temp.p17_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'P1.7 assertion failed: %', message; end if;
end;
$$;

select pg_temp.p17_assert(
  not has_function_privilege('authenticated', 'public.p1_product_catalog(uuid,text,integer)', 'EXECUTE'),
  'authenticated browser role must not call product catalog directly'
);
select pg_temp.p17_assert(
  not has_function_privilege('authenticated', 'public.p1_product_360(uuid,uuid,integer)', 'EXECUTE'),
  'authenticated browser role must not call Product 360 directly'
);
select pg_temp.p17_assert(
  has_function_privilege('service_role', 'public.p1_product_360(uuid,uuid,integer)', 'EXECUTE'),
  'service role must execute Product 360'
);

select pg_temp.p17_assert(
  (public.p1_product_catalog('00000000-0000-0000-0000-0000000017f1', 'P265GH', 50)->>'total')::int = 1,
  'tenant A catalog must contain exactly one matching canonical product'
);
select pg_temp.p17_assert(
  ((public.p1_product_catalog('00000000-0000-0000-0000-0000000017f1', 'P265GH', 50)->'results'->0->>'event_count')::int) = 3,
  'catalog event count must exclude tenant B'
);

select pg_temp.p17_assert(
  ((public.p1_product_360(
    '00000000-0000-0000-0000-0000000017f1',
    (select canonical_product_id from public.commercial_observations where id=17001),
    100
  )->'summary'->>'requested_count')::int) = 1,
  'Product 360 must count the RFQ'
);
select pg_temp.p17_assert(
  ((public.p1_product_360(
    '00000000-0000-0000-0000-0000000017f1',
    (select canonical_product_id from public.commercial_observations where id=17001),
    100
  )->'summary'->>'offered_count')::int) = 2,
  'Product 360 must count both offers without tenant leakage'
);
select pg_temp.p17_assert(
  ((public.p1_product_360(
    '00000000-0000-0000-0000-0000000017f1',
    (select canonical_product_id from public.commercial_observations where id=17001),
    100
  )->'latest_price'->>'value')::numeric) = 72.00,
  'latest price must be the most recent offered price'
);
select pg_temp.p17_assert(
  jsonb_array_length(public.p1_product_360(
    '00000000-0000-0000-0000-0000000017f1',
    (select canonical_product_id from public.commercial_observations where id=17001),
    100
  )->'price_history') = 2,
  'price history must expose the two tenant A offers'
);
select pg_temp.p17_assert(
  jsonb_array_length(public.p1_product_360(
    '00000000-0000-0000-0000-0000000017f1',
    (select canonical_product_id from public.commercial_observations where id=17001),
    100
  )->'timeline') = 3,
  'timeline must expose the three tenant A lifecycle events'
);
select pg_temp.p17_assert(
  (public.p1_product_360(
    '00000000-0000-0000-0000-0000000017f2',
    (select canonical_product_id from public.commercial_observations where id=17001),
    100
  )->>'found')::boolean is true,
  'same canonical product may exist in tenant B but detail remains scoped to tenant B data'
);
select pg_temp.p17_assert(
  ((public.p1_product_360(
    '00000000-0000-0000-0000-0000000017f2',
    (select canonical_product_id from public.commercial_observations where id=17001),
    100
  )->'summary'->>'event_count')::int) = 1,
  'tenant B Product 360 must contain only tenant B event'
);

rollback;
