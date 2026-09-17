-- P1.8 Price History acceptance. Disposable CI database only.
begin;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000018a1'::uuid, 'price-a@p1-test.example'),
  ('00000000-0000-0000-0000-0000000018b1'::uuid, 'price-b@p1-test.example');

insert into public.organizations (id, name, slug, created_by, onboarding_status)
values
  ('00000000-0000-0000-0000-0000000018f1', 'Price Tenant A', 'price-tenant-a', '00000000-0000-0000-0000-0000000018a1', 'completed'),
  ('00000000-0000-0000-0000-0000000018f2', 'Price Tenant B', 'price-tenant-b', '00000000-0000-0000-0000-0000000018b1', 'completed');

insert into public.organization_memberships (organization_id, user_id, role, status, is_default)
values
  ('00000000-0000-0000-0000-0000000018f1', '00000000-0000-0000-0000-0000000018a1', 'admin', 'active', true),
  ('00000000-0000-0000-0000-0000000018f2', '00000000-0000-0000-0000-0000000018b1', 'admin', 'active', true);

insert into public.commercial_datasets (id, owner_id, source_run_id, source_filename, organization_id)
values
  ('00000000-0000-0000-0000-000000001801', '00000000-0000-0000-0000-0000000018a1', '00000000-0000-0000-0000-000000001811', 'prices-a.eml', '00000000-0000-0000-0000-0000000018f1'),
  ('00000000-0000-0000-0000-000000001802', '00000000-0000-0000-0000-0000000018b1', '00000000-0000-0000-0000-000000001812', 'prices-b.eml', '00000000-0000-0000-0000-0000000018f2');

insert into public.conversations (id, owner_id, subject, organization_id) values
  ('00000000-0000-0000-0000-000000001831', '00000000-0000-0000-0000-0000000018a1', 'Target quote conversation', '00000000-0000-0000-0000-0000000018f1');
insert into public.offers (id, owner_id, conversation_id, offered_at, delivery_term, payment_terms, organization_id)
values ('00000000-0000-0000-0000-000000001841', '00000000-0000-0000-0000-0000000018a1', '00000000-0000-0000-0000-000000001831', '2026-09-10T10:00:00Z', 'EXW Torino', '30 gg DF', '00000000-0000-0000-0000-0000000018f1');

insert into public.commercial_threads (
  id, owner_id, dataset_id, source_conversation_id, subject, classification, last_activity_at, organization_id
) values
  ('00000000-0000-0000-0000-000000001821', '00000000-0000-0000-0000-0000000018a1', '00000000-0000-0000-0000-000000001801', '00000000-0000-0000-0000-000000001831', 'Quote old 10 EUR/m', 'offer', '2026-09-01T10:00:00Z', '00000000-0000-0000-0000-0000000018f1'),
  ('00000000-0000-0000-0000-000000001822', '00000000-0000-0000-0000-0000000018a1', '00000000-0000-0000-0000-000000001801', '00000000-0000-0000-0000-000000001831', 'Quote latest 12 EUR/m', 'offer', '2026-09-10T10:00:00Z', '00000000-0000-0000-0000-0000000018f1'),
  ('00000000-0000-0000-0000-000000001823', '00000000-0000-0000-0000-0000000018a1', '00000000-0000-0000-0000-000000001801', null, 'Order 900 EUR/t', 'order', '2026-09-12T10:00:00Z', '00000000-0000-0000-0000-0000000018f1'),
  ('00000000-0000-0000-0000-000000001824', '00000000-0000-0000-0000-0000000018a1', '00000000-0000-0000-0000-000000001801', null, 'Comparable 120x80x5', 'order', '2026-09-13T10:00:00Z', '00000000-0000-0000-0000-0000000018f1'),
  ('00000000-0000-0000-0000-000000001825', '00000000-0000-0000-0000-0000000018b1', '00000000-0000-0000-0000-000000001802', null, 'Other tenant target', 'offer', '2026-09-14T10:00:00Z', '00000000-0000-0000-0000-0000000018f2');

insert into public.commercial_observations (
  id, owner_id, dataset_id, thread_id, source_conversation_id, item_role, direction,
  product_type, grade, standard, width_mm, height_mm, thickness_mm, length_mm,
  quantity, quantity_unit, price_value, price_unit, currency, source_filename, source_text,
  confidence, search_text, organization_id
) values
  (18001, '00000000-0000-0000-0000-0000000018a1', '00000000-0000-0000-0000-000000001801', '00000000-0000-0000-0000-000000001821', '00000000-0000-0000-0000-000000001831', 'offered', 'outbound', 'rectangular_tube', 'S355J2H', 'EN 10219', 120, 80, 6, 12000, 100, 'M', 10, 'M', 'EUR', 'quote-old.eml', 'Old quote', 0.99, 's355j2h 120x80x6 10 eur m', '00000000-0000-0000-0000-0000000018f1'),
  (18002, '00000000-0000-0000-0000-0000000018a1', '00000000-0000-0000-0000-000000001801', '00000000-0000-0000-0000-000000001822', '00000000-0000-0000-0000-000000001831', 'offered', 'outbound', 'rectangular_tube', 'S355J2H', 'EN 10219', 120, 80, 6, 12000, 80, 'M', 12, 'M', 'EUR', 'quote-latest.eml', 'Latest quote', 0.99, 's355j2h 120x80x6 12 eur m', '00000000-0000-0000-0000-0000000018f1'),
  (18003, '00000000-0000-0000-0000-0000000018a1', '00000000-0000-0000-0000-000000001801', '00000000-0000-0000-0000-000000001823', null, 'ordered', 'outbound', 'rectangular_tube', 'S355J2H', 'EN 10219', 120, 80, 6, 12000, 5, 'T', 900, 'T', 'EUR', 'order.eml', 'Confirmed order', 0.99, 's355j2h 120x80x6 900 eur t', '00000000-0000-0000-0000-0000000018f1'),
  (18004, '00000000-0000-0000-0000-0000000018a1', '00000000-0000-0000-0000-000000001801', '00000000-0000-0000-0000-000000001824', null, 'ordered', 'outbound', 'rectangular_tube', 'S355J2H', 'EN 10219', 120, 80, 5, 12000, 4, 'T', 850, 'T', 'EUR', 'comparable.eml', 'Comparable order', 0.99, 's355j2h 120x80x5 850 eur t', '00000000-0000-0000-0000-0000000018f1'),
  (18005, '00000000-0000-0000-0000-0000000018b1', '00000000-0000-0000-0000-000000001802', '00000000-0000-0000-0000-000000001825', null, 'offered', 'outbound', 'rectangular_tube', 'S355J2H', 'EN 10219', 120, 80, 6, 12000, 1, 'M', 1, 'M', 'EUR', 'other-tenant.eml', 'Other tenant', 0.99, 's355j2h 120x80x6 1 eur m', '00000000-0000-0000-0000-0000000018f2');

create or replace function pg_temp.p18_assert(ok boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'P1.8 assertion failed: %', message; end if;
end;
$$;

select pg_temp.p18_assert(
  not has_function_privilege('authenticated', 'public.p1_price_history(uuid,uuid,integer,integer)', 'EXECUTE'),
  'authenticated browser role must not call Price History directly'
);
select pg_temp.p18_assert(
  has_function_privilege('service_role', 'public.p1_price_history(uuid,uuid,integer,integer)', 'EXECUTE'),
  'service role must execute Price History'
);

select pg_temp.p18_assert(
  abs(((public.p1_price_history(
    '00000000-0000-0000-0000-0000000018f1',
    (select canonical_product_id from public.commercial_observations where id=18001), 100, 20
  )->'product'->>'theoretical_weight_kg_m')::numeric) - 17.7096) < 0.0001,
  '120x80x6 theoretical weight must be transparent and deterministic'
);
select pg_temp.p18_assert(
  ((public.p1_price_history(
    '00000000-0000-0000-0000-0000000018f1',
    (select canonical_product_id from public.commercial_observations where id=18001), 100, 20
  )->'latest_quote'->>'value')::numeric) = 12,
  'latest quote must be separate from order price'
);
select pg_temp.p18_assert(
  ((public.p1_price_history(
    '00000000-0000-0000-0000-0000000018f1',
    (select canonical_product_id from public.commercial_observations where id=18001), 100, 20
  )->'latest_order'->>'value')::numeric) = 900,
  'latest order price must be separate from quote price'
);
select pg_temp.p18_assert(
  abs(((public.p1_price_history(
    '00000000-0000-0000-0000-0000000018f1',
    (select canonical_product_id from public.commercial_observations where id=18001), 100, 20
  )->'latest_quote'->>'normalized_per_tonne')::numeric) - 677.5986) < 0.01,
  'EUR/m quote must normalize to EUR/t using theoretical section weight'
);
select pg_temp.p18_assert(
  ((public.p1_price_history(
    '00000000-0000-0000-0000-0000000018f1',
    (select canonical_product_id from public.commercial_observations where id=18001), 100, 20
  )->'trend'->'quote'->>'delta_pct')::numeric) = 20.00,
  'quote trend must compare latest normalized quote to previous quote'
);
select pg_temp.p18_assert(
  (public.p1_price_history(
    '00000000-0000-0000-0000-0000000018f1',
    (select canonical_product_id from public.commercial_observations where id=18001), 100, 20
  )->'latest_quote'->>'delivery_term') = 'EXW Torino',
  'structured delivery term must be surfaced without text inference'
);
select pg_temp.p18_assert(
  jsonb_array_length(public.p1_price_history(
    '00000000-0000-0000-0000-0000000018f1',
    (select canonical_product_id from public.commercial_observations where id=18001), 100, 20
  )->'comparables') >= 1,
  'same-family same-grade nearby product must appear as a comparable'
);
select pg_temp.p18_assert(
  ((public.p1_price_history(
    '00000000-0000-0000-0000-0000000018f1',
    (select canonical_product_id from public.commercial_observations where id=18001), 100, 20
  )->'comparables'->0->>'comparability_score')::numeric) >= 90,
  '120x80x5 must score as a high comparable to 120x80x6'
);
select pg_temp.p18_assert(
  jsonb_array_length(public.p1_price_history(
    '00000000-0000-0000-0000-0000000018f1',
    (select canonical_product_id from public.commercial_observations where id=18001), 100, 20
  )->'history') = 3,
  'tenant A exact product history must exclude comparable product and tenant B'
);

rollback;
